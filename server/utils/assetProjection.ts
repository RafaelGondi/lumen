import type {
  Asset,
  AssetMovementKind,
  AssetProjectionPoint,
  AssetProjectionReport,
  AssetStatement,
  AssetStatementEntry,
  AssetType,
} from '~/types/asset'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'

type AssetRow = {
  id: number
  type: AssetType
  name: string
  currentBalance: number
  monthlyContribution: number
  annualYieldRate: number
  balanceDate: string
  notes: string | null
  hasMovements: number
}

type MovementRow = {
  id: number
  assetId: number
  kind: AssetMovementKind
  amount: number
  movementDate: string
  scheduledDate: string | null
  notes: string | null
}

type SimulationEvent = {
  id: number | null
  key: string
  kind: AssetMovementKind
  date: string
  scheduledDate: string | null
  amount: number | null
  automatic: boolean
  notes: string | null
}

const kindLabels: Record<AssetMovementKind, string> = {
  contribution: 'Aporte mensal',
  yield: 'Rendimento',
  withdrawal: 'Saque',
  adjustment_credit: 'Ajuste positivo',
  adjustment_debit: 'Ajuste negativo',
  balance_confirmation: 'Saldo confirmado',
}

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[value! - 1]}/${String(year!).slice(-2)}`
}

function monthlyRate(annualRate: number) {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1
}

function completedMonthsBetween(from: string, to: string) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  const calendarMonths = (toYear! - fromYear!) * 12 + toMonth! - fromMonth!
  if (calendarMonths <= 0) return 0
  return addMonthsLocal(from, calendarMonths) <= to ? calendarMonths : calendarMonths - 1
}

function projectBalance(row: AssetRow, startingBalance: number, months: number) {
  let balance = startingBalance
  let earnings = 0
  for (let index = 0; index < months; index += 1) {
    const monthEarnings = balance * monthlyRate(row.annualYieldRate)
    earnings += monthEarnings
    balance += monthEarnings + row.monthlyContribution
  }
  return { balance: roundMoney(balance), earnings: roundMoney(earnings) }
}

function movementRows(assetId?: number) {
  const where = assetId ? 'WHERE asset_id = ?' : ''
  return useDb().prepare(
    `SELECT id, asset_id AS assetId, kind, amount,
            movement_date AS movementDate, scheduled_date AS scheduledDate, notes
     FROM asset_movements
     ${where}
     ORDER BY movement_date, id`,
  ).all(...(assetId ? [assetId] : [])) as MovementRow[]
}

function assetRows(assetId?: number) {
  const where = assetId ? 'AND id = ?' : ''
  return useDb().prepare(
    `SELECT id, type, name,
            current_balance AS currentBalance,
            monthly_contribution AS monthlyContribution,
            annual_yield_rate AS annualYieldRate,
            balance_date AS balanceDate,
            notes,
            EXISTS (SELECT 1 FROM asset_movements movement WHERE movement.asset_id = assets.id) AS hasMovements
     FROM assets
     WHERE active = 1 ${where}
     ORDER BY
       CASE type
         WHEN 'fgts' THEN 1
         WHEN 'reserve' THEN 2
         WHEN 'investment' THEN 3
         WHEN 'property' THEN 4
         WHEN 'vehicle' THEN 5
         ELSE 6
       END,
       name COLLATE NOCASE`,
  ).all(...(assetId ? [assetId] : [])) as AssetRow[]
}

function eventPriority(kind: AssetMovementKind) {
  if (kind === 'yield') return 1
  if (kind === 'contribution') return 2
  if (kind === 'withdrawal') return 3
  if (kind === 'adjustment_credit' || kind === 'adjustment_debit') return 4
  return 5
}

function effectFor(kind: AssetMovementKind, amount: number, balance: number) {
  if (kind === 'withdrawal' || kind === 'adjustment_debit') return -amount
  if (kind === 'balance_confirmation') return amount - balance
  return amount
}

function simulateAsset(row: AssetRow, movements: MovementRow[], targetDate: string, withStatement = false) {
  const relevant = movements.filter(
    movement => movement.assetId === row.id
      && movement.movementDate >= row.balanceDate
      && movement.movementDate <= targetDate,
  )
  const overrides = new Set(
    relevant
      .filter(movement => movement.scheduledDate)
      .map(movement => `${movement.kind}|${movement.scheduledDate}`),
  )
  const events: SimulationEvent[] = relevant.map(movement => ({
    id: movement.id,
    key: `movement-${movement.id}`,
    kind: movement.kind,
    date: movement.movementDate,
    scheduledDate: movement.scheduledDate,
    amount: movement.amount,
    automatic: false,
    notes: movement.notes,
  }))

  const elapsedMonths = completedMonthsBetween(row.balanceDate, targetDate)
  for (let index = 1; index <= elapsedMonths; index += 1) {
    const date = addMonthsLocal(row.balanceDate, index)
    if (!overrides.has(`yield|${date}`)) {
      events.push({ id: null, key: `automatic-yield-${date}`, kind: 'yield', date, scheduledDate: date, amount: null, automatic: true, notes: null })
    }
    if (!overrides.has(`contribution|${date}`)) {
      events.push({ id: null, key: `automatic-contribution-${date}`, kind: 'contribution', date, scheduledDate: date, amount: row.monthlyContribution, automatic: true, notes: null })
    }
  }

  events.sort((left, right) =>
    left.date.localeCompare(right.date)
      || eventPriority(left.kind) - eventPriority(right.kind)
      || (left.id ?? 0) - (right.id ?? 0),
  )

  let balance = row.currentBalance
  let contributions = 0
  let earnings = 0
  const entries: AssetStatementEntry[] = withStatement
    ? [{ id: null, key: 'initial-balance', kind: 'initial_balance', label: 'Saldo inicial confirmado', movementDate: row.balanceDate, scheduledDate: null, amount: row.currentBalance, effect: row.currentBalance, balance: row.currentBalance, status: 'confirmed', source: 'initial', notes: null }]
    : []

  for (const event of events) {
    const amount = event.amount ?? balance * monthlyRate(row.annualYieldRate)
    const effect = effectFor(event.kind, amount, balance)
    balance = event.kind === 'balance_confirmation' ? amount : balance + effect
    if (event.kind === 'contribution') contributions += amount
    if (event.kind === 'yield') earnings += amount

    if (withStatement) {
      entries.push({
        id: event.id,
        key: event.key,
        kind: event.kind,
        label: kindLabels[event.kind],
        movementDate: event.date,
        scheduledDate: event.scheduledDate,
        amount: roundMoney(amount),
        effect: roundMoney(effect),
        balance: roundMoney(balance),
        status: event.automatic ? 'estimated' : 'confirmed',
        source: event.automatic ? 'automatic' : 'manual',
        notes: event.notes,
      })
    }
  }

  return { balance: roundMoney(balance), contributions: roundMoney(contributions), earnings: roundMoney(earnings), elapsedMonths, entries }
}

function assetFromSimulation(row: AssetRow, simulation: ReturnType<typeof simulateAsset>, months: number): Asset {
  return {
    ...row,
    hasMovements: Boolean(row.hasMovements),
    elapsedMonths: simulation.elapsedMonths,
    estimatedCurrentBalance: simulation.balance,
    accruedContributions: simulation.contributions,
    accruedEarnings: simulation.earnings,
    projectedBalance: projectBalance(row, simulation.balance, months).balance,
  }
}

export function buildAssetStatement(assetId: number): AssetStatement {
  const row = assetRows(assetId)[0]
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  const asOf = todayLocal()
  const simulation = simulateAsset(row, movementRows(assetId), asOf, true)
  return { asset: assetFromSimulation(row, simulation, 12), asOf, entries: simulation.entries.slice().reverse() }
}

export function buildAssetProjection(months: number, assetId?: number): AssetProjectionReport {
  const asOf = todayLocal()
  const rows = assetRows(assetId)
  if (assetId && !rows.length) {
    throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  }
  const movements = movementRows(assetId)
  const simulations = rows.map(row => simulateAsset(row, movements, asOf))
  const registeredTotal = roundMoney(rows.reduce((sum, row) => sum + row.currentBalance, 0))
  const monthlyContribution = roundMoney(rows.reduce((sum, row) => sum + row.monthlyContribution, 0))
  const assets = rows.map((row, index) => assetFromSimulation(row, simulations[index]!, months))
  const currentTotal = roundMoney(assets.reduce((sum, asset) => sum + asset.estimatedCurrentBalance, 0))
  const accruedContributions = roundMoney(assets.reduce((sum, asset) => sum + asset.accruedContributions, 0))
  const accruedEarnings = roundMoney(assets.reduce((sum, asset) => sum + asset.accruedEarnings, 0))

  const points: AssetProjectionPoint[] = []
  let balances = assets.map(asset => asset.estimatedCurrentBalance)
  let accumulatedContributions = 0
  let accumulatedEarnings = 0
  points.push({ month: asOf.slice(0, 7), label: 'Hoje', balance: currentTotal, contributed: 0, earnings: 0 })

  for (let index = 1; index <= months; index += 1) {
    balances = balances.map((balance, assetIndex) => {
      const row = rows[assetIndex]!
      const earnings = balance * monthlyRate(row.annualYieldRate)
      accumulatedEarnings += earnings
      accumulatedContributions += row.monthlyContribution
      return balance + earnings + row.monthlyContribution
    })
    const month = addMonthsLocal(`${asOf.slice(0, 7)}-01`, index).slice(0, 7)
    points.push({
      month,
      label: monthLabel(month),
      balance: roundMoney(balances.reduce((sum, balance) => sum + balance, 0)),
      contributed: roundMoney(accumulatedContributions),
      earnings: roundMoney(accumulatedEarnings),
    })
  }

  const last = points.at(-1)!
  return {
    asOf,
    months,
    registeredTotal,
    currentTotal,
    accruedContributions,
    accruedEarnings,
    monthlyContribution,
    projectedTotal: last.balance,
    projectedContributions: last.contributed,
    projectedEarnings: last.earnings,
    assets,
    points,
  }
}
