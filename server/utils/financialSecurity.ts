import type Database from 'better-sqlite3'
import type { FinancialSecurityReport } from '~/types/financialSecurity'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { assetBalanceAtDate, buildAssetProjection } from './assetProjection'
import { buildMonthlyResultReport } from './monthlyResult'
import { allAccountBalancesAtCutoff } from './occurrences'
import { getProjectedMonthlyExpenses, getSaldoBancarioTotal } from './cashFlow'
import { buildProjectionPoints } from './projection'

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[value! - 1]}/${String(year!).slice(-2)}`
}

function selectedAssetIds(db: Database.Database) {
  const rows = db.prepare(
    `SELECT a.id, a.type, f.enabled
     FROM assets a
     LEFT JOIN financial_security_assets f ON f.asset_id = a.id
     WHERE a.active = 1`,
  ).all() as Array<{ id: number; type: string; enabled: number | null }>

  return new Set(rows
    .filter(row => row.enabled === null
      ? ['reserve', 'investment'].includes(row.type)
      : Boolean(row.enabled))
    .map(row => row.id))
}

function costHistory(db: Database.Database, asOf: string) {
  const currentMonth = `${asOf.slice(0, 7)}-01`
  return [-3, -2, -1].map((offset) => {
    const month = addMonthsLocal(currentMonth, offset).slice(0, 7)
    const report = buildMonthlyResultReport(db, month, 'category')
    return { month, label: monthLabel(month), amount: report.expenseTotal }
  })
}

function monthEnd(month: string) {
  const [year, value] = month.split('-').map(Number)
  const day = new Date(year!, value!, 0).getDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

function rollingMonthlyCost(db: Database.Database, month: string) {
  const amounts = [-2, -1, 0].map((offset) => {
    const key = addMonthsLocal(`${month}-01`, offset).slice(0, 7)
    return buildMonthlyResultReport(db, key, 'category').expenseTotal
  }).filter(amount => amount > 0)
  if (!amounts.length) return 0
  return roundMoney(amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length)
}

export function saveFinancialSecuritySettings(
  db: Database.Database,
  assetIds: number[],
  costMode: 'historical' | 'projected',
) {
  const activeIds = new Set((db.prepare('SELECT id FROM assets WHERE active = 1').all() as Array<{ id: number }>).map(row => row.id))
  if (assetIds.some(id => !activeIds.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Patrimônio inválido.' })
  }
  if (!['historical', 'projected'].includes(costMode)) {
    throw createError({ statusCode: 400, statusMessage: 'Critério de custo inválido.' })
  }

  const now = new Date().toISOString()
  const selected = new Set(assetIds)
  const save = db.transaction(() => {
    const statement = db.prepare(
      `INSERT INTO financial_security_assets (asset_id, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(asset_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`,
    )
    for (const id of activeIds) statement.run(id, selected.has(id) ? 1 : 0, now, now)
    db.prepare(
      `INSERT INTO financial_security_settings (id, monthly_cost_override, cost_mode, updated_at)
       VALUES (1, NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET monthly_cost_override = NULL,
         cost_mode = excluded.cost_mode, updated_at = excluded.updated_at`,
    ).run(costMode, now)
  })
  save()
}

export function buildFinancialSecurityReport(
  db: Database.Database,
  costModeOverride?: 'historical' | 'projected',
): FinancialSecurityReport {
  const months = 18
  const allAssets = buildAssetProjection(months)
  const selectedIds = selectedAssetIds(db)
  const costMonths = costHistory(db, allAssets.asOf)
  const automaticMonthlyCost = roundMoney(costMonths.reduce((sum, item) => sum + item.amount, 0) / costMonths.length)
  const setting = db.prepare(
    'SELECT cost_mode AS costMode FROM financial_security_settings WHERE id = 1',
  ).get() as { costMode: 'historical' | 'projected' } | undefined
  const costMode = costModeOverride ?? setting?.costMode ?? 'historical'
  const currentMonth = allAssets.asOf.slice(0, 7)
  const nextMonth = addMonthsLocal(`${currentMonth}-01`, 1).slice(0, 7)
  const projectedExpenses = getProjectedMonthlyExpenses(db, nextMonth, months + 2)
  const projectedCostMonths = projectedExpenses.slice(0, 3).map(item => ({
    ...item,
    label: monthLabel(item.month),
  }))
  const projectedCostAt = (index: number) => {
    const start = Math.max(0, index - 1)
    const window = projectedExpenses.slice(start, start + 3)
    const value = roundMoney(window.reduce((sum, item) => sum + item.amount, 0) / 3)
    return value > 0 ? value : automaticMonthlyCost
  }
  const monthlyCost = costMode === 'projected' ? projectedCostAt(0) : automaticMonthlyCost
  const currentAccountTotal = getSaldoBancarioTotal(db, allAssets.asOf)

  const projections = allAssets.assets.map(asset => ({
    asset,
    report: buildAssetProjection(months, asset.id),
  }))
  const selected = projections.filter(item => selectedIds.has(item.asset.id))
  const currentTotal = roundMoney(
    selected.reduce((sum, item) => sum + item.asset.estimatedCurrentBalance, 0) + currentAccountTotal,
  )
  const monthlyContribution = roundMoney(selected.reduce((sum, item) => sum + item.asset.monthlyContribution, 0))
  const cashProjection = new Map(buildProjectionPoints(db, currentMonth, months + 1)
    .map(point => [point.month, point.worstBalance]))
  const selectedAssetDates = new Map((db.prepare(
    'SELECT id, balance_date AS balanceDate FROM assets WHERE active = 1',
  ).all() as Array<{ id: number; balanceDate: string }>).map(row => [row.id, row.balanceDate]))
  const history = Array.from({ length: 6 }, (_, index) => {
    const month = addMonthsLocal(`${allAssets.asOf.slice(0, 7)}-01`, index - 6).slice(0, 7)
    const cutoff = monthEnd(month)
    const hasUnknownAsset = [...selectedIds].some(id => (selectedAssetDates.get(id) ?? cutoff) > cutoff)
    if (hasUnknownAsset) return null
    const balances = allAccountBalancesAtCutoff(db, cutoff)
    const accountTotal = [...balances.values()].reduce((sum, balance) => sum + balance, 0)
    const assetTotal = [...selectedIds].reduce((sum, id) => sum + (assetBalanceAtDate(id, cutoff) ?? 0), 0)
    const cost = rollingMonthlyCost(db, month)
    if (cost <= 0) return null
    const balance = roundMoney(accountTotal + assetTotal)
    return {
      month,
      label: monthLabel(month),
      balance,
      monthlyCost: cost,
      coverageMonths: cost > 0 ? Math.round((balance / cost) * 10) / 10 : 0,
      kind: 'historical' as const,
    }
  }).filter(point => point !== null)

  const future = Array.from({ length: months + 1 }, (_, index) => {
    const template = allAssets.points[index]
    const month = template?.month ?? addMonthsLocal(`${currentMonth}-01`, index).slice(0, 7)
    const assetBalance = selected.reduce((sum, item) => sum + (item.report.points[index]?.balance ?? 0), 0)
    const accumulatedCash = index === 0
      ? currentAccountTotal
      : cashProjection.get(month) ?? currentAccountTotal
    const balance = roundMoney(assetBalance + accumulatedCash)
    const pointCost = costMode === 'projected' ? projectedCostAt(index) : automaticMonthlyCost
    return {
      month,
      label: index === 0 ? 'Hoje' : template?.label ?? '',
      balance,
      monthlyCost: pointCost,
      coverageMonths: pointCost > 0 ? Math.round((balance / pointCost) * 10) / 10 : 0,
      kind: index === 0 ? 'current' as const : 'projected' as const,
    }
  })
  const points = [...history, ...future]
  const independence = future.find(point => point.coverageMonths >= 12)

  return {
    asOf: allAssets.asOf,
    costMode,
    monthlyCost,
    automaticMonthlyCost,
    monthlyCostOverride: null,
    costMonths,
    projectedCostMonths,
    currentTotal,
    monthlyContribution,
    coverageMonths: monthlyCost > 0 ? Math.round((currentTotal / monthlyCost) * 10) / 10 : 0,
    targetSixMonths: roundMoney(monthlyCost * 6),
    targetTwelveMonths: roundMoney(monthlyCost * 12),
    twelveMonthGap: roundMoney(Math.max(0, monthlyCost * 12 - currentTotal)),
    independenceMonth: independence?.month ?? null,
    independenceLabel: independence?.label ?? null,
    assets: projections.map(({ asset }) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      balance: asset.estimatedCurrentBalance,
      monthlyContribution: asset.monthlyContribution,
      enabled: selectedIds.has(asset.id),
    })),
    points,
  }
}
