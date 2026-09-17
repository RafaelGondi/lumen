import type Database from 'better-sqlite3'
import type { Card } from '~/types/card'
import type {
  DebtEvolutionItem,
  DebtCashProjectionPoint,
  DebtMonthlyImpact,
  DebtEvolutionPoint,
  DebtEvolutionReport,
  DebtCardSourceOption,
  DebtSourceOption,
} from '~/types/debtEvolution'
import type { EntryOccurrence } from '~/types/entry'
import type { ManualDebt } from '~/types/manualDebt'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { cardUsageSummary } from './cardInvoice'
import { occurrencesForCompetenceMonth } from './occurrences'
import { buildProjectionPoints } from './projection'

const MONTH_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]
const MONTH_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
type EntryCandidateRow = Omit<DebtSourceOption, 'enabled' | 'suggested'> & {
  enabled: number | null
}

type CardRow = Omit<Card, 'active' | 'usedAmount' | 'estimatedPayoffLabel'> & {
  active: number
}

type ManualDebtRow = Omit<ManualDebt, 'enabled'> & { enabled: number }

function shiftMonth(month: string, offset: number) {
  return addMonthsLocal(`${month}-01`, offset).slice(0, 7)
}

function monthLabel(month: string, full = false) {
  const [year, value] = month.split('-').map(Number)
  return full
    ? `${MONTH_LONG[value! - 1]} de ${year}`
    : `${MONTH_SHORT[value! - 1]}/${String(year).slice(-2)}`
}

export function loadDebtSourceOptions(db: Database.Database): DebtSourceOption[] {
  const rows = db.prepare(
    `SELECT
       e.id AS entryId,
       e.description,
       c.name AS categoryName,
       c.color AS categoryColor,
       c.icon AS categoryIcon,
       e.recurrence,
       e.amount,
       e.date AS startDate,
       e.end_date AS endDate,
       e.installment_count AS installmentCount,
       ds.enabled
     FROM entries e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN debt_sources ds ON ds.entry_id = e.id
     WHERE e.type = 'expense'
       AND e.card_id IS NULL
       AND e.track_as_debt = 1
     ORDER BY e.date DESC, e.id DESC`,
  ).all() as EntryCandidateRow[]

  const now = new Date().toISOString()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO debt_sources (entry_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  )
  const initialize = db.transaction(() => {
    for (const row of rows) {
      insert.run(row.entryId, 1, now, now)
    }
  })
  initialize()

  const enabled = new Map(
    (db.prepare('SELECT entry_id AS entryId, enabled FROM debt_sources').all() as {
      entryId: number
      enabled: number
    }[]).map((row) => [row.entryId, Boolean(row.enabled)]),
  )

  return rows.map((row) => ({
    entryId: row.entryId,
    description: row.description,
    categoryName: row.categoryName,
    categoryColor: row.categoryColor,
    categoryIcon: row.categoryIcon,
    recurrence: row.recurrence,
    amount: roundMoney(row.amount),
    startDate: row.startDate,
    endDate: row.endDate,
    installmentCount: row.installmentCount,
    enabled: enabled.get(row.entryId) ?? false,
    suggested: true,
  }))
}

export function loadDebtCardSourceOptions(db: Database.Database): DebtCardSourceOption[] {
  const cards = loadCards(db)
  const now = new Date().toISOString()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO debt_card_sources (card_id, enabled, created_at, updated_at)
     VALUES (?, 1, ?, ?)`,
  )
  db.transaction(() => {
    for (const card of cards) insert.run(card.id, now, now)
  })()

  const enabled = new Map(
    (db.prepare('SELECT card_id AS cardId, enabled FROM debt_card_sources').all() as {
      cardId: number
      enabled: number
    }[]).map((row) => [row.cardId, Boolean(row.enabled)]),
  )

  return cards.map((card) => ({
    cardId: card.id,
    name: card.name,
    bankKey: card.bankKey,
    bankName: card.bankName,
    color: card.color,
    enabled: enabled.get(card.id) ?? true,
  }))
}

export function saveDebtSources(db: Database.Database, entryIds: number[]) {
  const options = loadDebtSourceOptions(db)
  const allowed = new Set(options.map((option) => option.entryId))
  if (entryIds.some((id) => !allowed.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida inválida.' })
  }
  const selected = new Set(entryIds)
  const now = new Date().toISOString()
  const update = db.prepare(
    'UPDATE debt_sources SET enabled = ?, updated_at = ? WHERE entry_id = ?',
  )
  db.transaction(() => {
    for (const option of options) {
      update.run(selected.has(option.entryId) ? 1 : 0, now, option.entryId)
    }
  })()
}

export function saveDebtCardSources(db: Database.Database, cardIds: number[]) {
  const options = loadDebtCardSourceOptions(db)
  const allowed = new Set(options.map((option) => option.cardId))
  if (cardIds.some((id) => !allowed.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Cartão inválido.' })
  }
  const selected = new Set(cardIds)
  const now = new Date().toISOString()
  const update = db.prepare(
    'UPDATE debt_card_sources SET enabled = ?, updated_at = ? WHERE card_id = ?',
  )
  db.transaction(() => {
    for (const option of options) {
      update.run(selected.has(option.cardId) ? 1 : 0, now, option.cardId)
    }
  })()
}

export function loadManualDebtOptions(db: Database.Database): ManualDebt[] {
  const rows = db.prepare(
    `SELECT d.id, d.name, d.creditor, d.current_balance AS currentBalance,
            d.start_date AS startDate, d.target_date AS targetDate,
            d.category_id AS categoryId, c.name AS categoryName,
            c.color AS categoryColor, c.icon AS categoryIcon,
            d.notes, d.enabled
     FROM manual_debts d
     LEFT JOIN categories c ON c.id = d.category_id
     WHERE d.active = 1
     ORDER BY d.name COLLATE NOCASE`,
  ).all() as ManualDebtRow[]
  return rows.map((row) => ({
    ...row,
    currentBalance: roundMoney(row.currentBalance),
    enabled: Boolean(row.enabled),
  }))
}

export function saveManualDebtSources(db: Database.Database, debtIds: number[]) {
  const options = loadManualDebtOptions(db)
  const allowed = new Set(options.map((option) => option.id))
  if (debtIds.some((id) => !allowed.has(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida avulsa inválida.' })
  }
  const selected = new Set(debtIds)
  const now = new Date().toISOString()
  const update = db.prepare(
    'UPDATE manual_debts SET enabled = ?, updated_at = ? WHERE id = ?',
  )
  db.transaction(() => {
    for (const option of options) {
      update.run(selected.has(option.id) ? 1 : 0, now, option.id)
    }
  })()
}

function loadCards(db: Database.Database) {
  const rows = db.prepare(
    `SELECT id, name, bank_key AS bankKey, bank_name AS bankName, color,
            last_four AS lastFour, credit_limit AS creditLimit,
            closing_day AS closingDay, due_day AS dueDay, active,
            created_at AS createdAt
     FROM cards WHERE active = 1 ORDER BY name COLLATE NOCASE`,
  ).all() as CardRow[]
  return rows.map((row): Card => ({
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }))
}

function payoffMonthForSource(source: DebtSourceOption) {
  if (source.recurrence === 'single') return source.startDate.slice(0, 7)
  if (source.endDate) return source.endDate.slice(0, 7)
  if (source.recurrence === 'installment' && source.installmentCount) {
    return addMonthsLocal(source.startDate, source.installmentCount - 1).slice(0, 7)
  }
  return null
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0
}

export function buildDebtEvolutionReport(db: Database.Database): DebtEvolutionReport {
  const today = todayLocal()
  const currentMonth = today.slice(0, 7)
  const sources = loadDebtSourceOptions(db)
  const selected = sources.filter((source) => source.enabled)
  const manualDebts = loadManualDebtOptions(db)
  const selectedManualDebts = manualDebts.filter((debt) => debt.enabled)
  const selectedIds = new Set(selected.map((source) => source.entryId))
  const cardSources = loadDebtCardSourceOptions(db)
  const selectedCardIds = new Set(
    cardSources.filter((card) => card.enabled).map((card) => card.cardId),
  )
  const cards = loadCards(db).filter((card) => selectedCardIds.has(card.id))
  const cardItems = cards.map((card) => {
    const summary = cardUsageSummary(db, card, currentMonth)
    return { card, ...summary }
  }).filter((item) => item.usedAmount > 0)
  const openCardMonths = Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(currentMonth, index)
    return {
      month,
      amount: roundMoney(cardItems.reduce((sum, item) =>
        sum + (item.projection.find((point) => point.month === month)?.amount ?? 0), 0)),
    }
  })

  const payoffMonths = selected
    .map(payoffMonthForSource)
    .filter((month): month is string => Boolean(month))
  const lastCardMonth = [...openCardMonths].reverse().find((item) => item.amount > 0)?.month
  const manualTargetMonths = selectedManualDebts
    .map((debt) => debt.targetDate?.slice(0, 7))
    .filter((month): month is string => Boolean(month))
  const furthest = [...payoffMonths, ...manualTargetMonths, ...(lastCardMonth ? [lastCardMonth] : [])]
    .sort()
    .at(-1) ?? shiftMonth(currentMonth, 12)
  const rawHorizon = Math.max(18, Math.min(60,
    (Number(furthest.slice(0, 4)) - Number(currentMonth.slice(0, 4))) * 12 +
    Number(furthest.slice(5, 7)) - Number(currentMonth.slice(5, 7)),
  ))

  const occurrenceMonths = Array.from({ length: rawHorizon + 1 }, (_, index) =>
    shiftMonth(currentMonth, index),
  )
  const occurrences = occurrenceMonths.flatMap((month) =>
    occurrencesForCompetenceMonth(db, month).filter(
      (item) => selectedIds.has(item.parentId) && !item.settled,
    ),
  )
  const bySource = new Map<number, EntryOccurrence[]>()
  for (const occurrence of occurrences) {
    const list = bySource.get(occurrence.parentId) ?? []
    list.push(occurrence)
    bySource.set(occurrence.parentId, list)
  }

  const entryBalance = (entryId: number) => roundMoney(
    (bySource.get(entryId) ?? []).reduce((sum, item) => sum + item.amount, 0),
  )
  const cardTotal = roundMoney(cardItems.reduce((sum, item) => sum + item.usedAmount, 0))
  const entryTotal = roundMoney(selected.reduce((sum, source) => sum + entryBalance(source.entryId), 0))
  const manualTotal = roundMoney(selectedManualDebts.reduce((sum, debt) => sum + debt.currentBalance, 0))
  const currentTotal = roundMoney(cardTotal + entryTotal + manualTotal)

  const dueEntriesThisMonth = occurrences
    .filter((item) => item.dueDate.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + item.amount, 0)
  const dueCardsThisMonth = openCardMonths.find((item) => item.month === currentMonth)?.amount ?? 0
  const dueManualThisMonth = selectedManualDebts
    .filter((debt) => debt.targetDate?.slice(0, 7) === currentMonth)
    .reduce((sum, debt) => sum + debt.currentBalance, 0)
  const dueThisMonth = roundMoney(dueEntriesThisMonth + dueCardsThisMonth + dueManualThisMonth)

  const monthlyImpacts: DebtMonthlyImpact[] = occurrenceMonths.map((month) => {
    const cardImpact = cardItems.map(({ card, projection }) => ({
      id: `card:${card.id}`,
      name: card.name,
      amount: roundMoney(
        projection.find((point) => point.month === month)?.amount ?? 0,
      ),
      type: 'card' as const,
      color: card.color,
    }))
    const entryImpact = selected.map((source) => ({
      id: `entry:${source.entryId}`,
      name: source.description,
      amount: roundMoney(
        (bySource.get(source.entryId) ?? [])
          .filter((item) => item.dueDate.slice(0, 7) === month)
          .reduce((sum, item) => sum + item.amount, 0),
      ),
      type: 'entry' as const,
      color: source.categoryColor ?? '#647a91',
    }))
    const manualImpact = selectedManualDebts.map((debt) => ({
      id: `manual:${debt.id}`,
      name: debt.name,
      amount: debt.targetDate?.slice(0, 7) === month ? debt.currentBalance : 0,
      type: 'manual' as const,
      color: debt.categoryColor ?? '#647a91',
    }))
    const items = [...cardImpact, ...entryImpact, ...manualImpact]
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    return {
      month,
      label: monthLabel(month),
      total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)),
      items,
    }
  })

  const composition: DebtEvolutionItem[] = [
    ...cardItems.map(({ card, usedAmount, estimatedPayoffLabel }) => ({
      id: `card:${card.id}`,
      name: card.name,
      support: `${card.bankName} · cartão`,
      type: 'card' as const,
      balance: usedAmount,
      percent: percent(usedAmount, currentTotal),
      payoffMonth: estimatedPayoffLabel,
      bankKey: card.bankKey,
      color: card.color,
      categoryIcon: null,
    })),
    ...selected.map((source) => {
      const balance = entryBalance(source.entryId)
      return {
        id: `entry:${source.entryId}`,
        name: source.description,
        support: source.categoryName ?? (source.recurrence === 'fixed' ? 'Dívida fixa' : 'Dívida parcelada'),
        type: 'entry' as const,
        balance,
        percent: percent(balance, currentTotal),
        payoffMonth: payoffMonthForSource(source),
        bankKey: null,
        color: source.categoryColor ?? '#647a91',
        categoryIcon: source.categoryIcon,
      }
    }).filter((item) => item.balance > 0),
    ...selectedManualDebts.map((debt) => ({
      id: `manual:${debt.id}`,
      name: debt.name,
      support: [debt.creditor, debt.categoryName ?? 'Dívida sem parcelas'].filter(Boolean).join(' · '),
      type: 'manual' as const,
      balance: debt.currentBalance,
      percent: percent(debt.currentBalance, currentTotal),
      payoffMonth: debt.targetDate?.slice(0, 7) ?? null,
      bankKey: null,
      color: debt.categoryColor ?? '#647a91',
      categoryIcon: debt.categoryIcon,
    })).filter((item) => item.balance > 0),
  ].sort((a, b) => b.balance - a.balance)

  const breakdownJson = JSON.stringify(composition.map((item) => ({ id: item.id, balance: item.balance })))
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO debt_snapshots (month, total, breakdown_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET total = excluded.total,
       breakdown_json = excluded.breakdown_json, updated_at = excluded.updated_at`,
  ).run(currentMonth, currentTotal, breakdownJson, now, now)

  const snapshots = db.prepare(
    `SELECT month, total FROM debt_snapshots WHERE month < ? ORDER BY month`,
  ).all(currentMonth) as { month: string; total: number }[]
  const points: DebtEvolutionPoint[] = snapshots.slice(-12).map((snapshot) => ({
    key: `snapshot:${snapshot.month}`,
    month: snapshot.month,
    label: monthLabel(snapshot.month),
    balance: roundMoney(snapshot.total),
    kind: 'actual',
  }))
  points.push({
    key: `actual:${currentMonth}`,
    month: currentMonth,
    label: 'Hoje',
    balance: currentTotal,
    kind: 'actual',
  })

  const remainingAfterMonth = (month: string) => {
    const cardsRemaining = openCardMonths
      .filter((item) => item.month > month)
      .reduce((sum, item) => sum + item.amount, 0)
    const entriesRemaining = occurrences
      .filter((item) => item.dueDate.slice(0, 7) > month)
      .reduce((sum, item) => sum + item.amount, 0)
    const manualRemaining = selectedManualDebts
      .filter((debt) => !debt.targetDate || debt.targetDate.slice(0, 7) > month)
      .reduce((sum, debt) => sum + debt.currentBalance, 0)
    return roundMoney(cardsRemaining + entriesRemaining + manualRemaining)
  }
  for (const month of occurrenceMonths) {
    points.push({
      key: `projected:${month}`,
      month,
      label: monthLabel(month),
      balance: remainingAfterMonth(month),
      kind: 'projected',
    })
  }

  const projected = points.filter((point) => point.kind === 'projected')
  const projectedDebtByMonth = new Map(
    projected.map((point) => [point.month, point.balance]),
  )
  const cashProjection: DebtCashProjectionPoint[] = buildProjectionPoints(
    db,
    currentMonth,
    occurrenceMonths.length,
  ).map((point) => ({
    month: point.month,
    label: monthLabel(point.month),
    balance: roundMoney(point.worstBalance ?? point.balance),
  }))
  const breakEvenPoint = cashProjection.find((point) => {
    const debtBalance = projectedDebtByMonth.get(point.month)
    return debtBalance !== undefined && point.balance >= debtBalance
  })
  const payoffPoint = projected.find((point) => point.balance <= 0.005)
  const hasOpenEndedDebt = selectedManualDebts.some((debt) => debt.currentBalance > 0 && !debt.targetDate)
  const estimatedPayoffMonth = hasOpenEndedDebt ? null : payoffPoint?.month ?? null
  const endCurrentMonth = projected.find((point) => point.month === currentMonth)?.balance ?? currentTotal

  return {
    asOf: today,
    currentTotal,
    dueThisMonth,
    reductionThisMonth: roundMoney(Math.max(0, currentTotal - endCurrentMonth)),
    estimatedPayoffMonth,
    estimatedPayoffLabel: estimatedPayoffMonth ? monthLabel(estimatedPayoffMonth, true) : null,
    historyStarted: snapshots.length > 0,
    points,
    monthlyImpacts,
    cashProjection,
    breakEvenMonth: breakEvenPoint?.month ?? null,
    breakEvenLabel: breakEvenPoint
      ? monthLabel(breakEvenPoint.month, true)
      : null,
    hasOpenEndedDebt,
    composition,
    sources,
    cards: cardSources,
    manualDebts,
  }
}
