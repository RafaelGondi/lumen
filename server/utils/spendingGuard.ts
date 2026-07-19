import type Database from 'better-sqlite3'
import type {
  SpendingGuardBreakdownGroup,
  SpendingGuardBreakdownItem,
  SpendingGuardCardDeferred,
  SpendingGuardPace,
  SpendingGuardReport,
  SpendingGuardStatus,
} from '~/types/spendingGuard'
import type { SpendingCalendarItem } from '~/types/spendingCalendar'
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'
import { roundMoney } from '~/utils/dateMoney'
import { occurrencesForCashMonth } from './occurrences'
import { buildSpendingCalendar } from './spendingCalendar'
import { resolveGlobalSpendingSettings } from './limits'

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function statusFor(
  expectedIncome: number,
  spentPercent: number,
  committedPercent: number,
): SpendingGuardStatus {
  if (expectedIncome <= 0) return 'no-income'
  const riskPercent = Math.max(spentPercent, committedPercent)
  if (riskPercent >= 100) return 'exceeded'
  if (riskPercent >= 90) return 'critical'
  if (riskPercent >= 75) return 'attention'
  return 'healthy'
}

function paceFor(delta: number): SpendingGuardPace {
  if (delta <= -5) return 'below'
  if (delta <= 5) return 'on-track'
  if (delta <= 15) return 'slightly-above'
  return 'above'
}

/**
 * Pagamentos de fatura já são a liquidação em caixa de compras reconhecidas
 * pela data da transação. Excluí-los evita contar compra + pagamento.
 */
function invoicePaymentEntryIds(db: Database.Database) {
  const rows = db
    .prepare('SELECT entry_id AS entryId FROM card_invoice_payments')
    .all() as { entryId: number }[]
  return new Set(rows.map((row) => row.entryId))
}

function monthEnd(month: string) {
  const [year, value] = month.split('-').map(Number)
  const day = new Date(year!, value!, 0).getDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

function totalsBySource(
  items: {
    source: 'account' | 'card'
    amount: number
  }[],
) {
  return items.reduce(
    (totals, item) => {
      totals[item.source] = roundMoney(totals[item.source] + item.amount)
      return totals
    },
    { account: 0, card: 0 },
  )
}

function shortMonthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `${MONTH_SHORT[value! - 1]}/${year}`
}

function loadCardClosingDays(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, closing_day AS closingDay
       FROM cards
       WHERE active = 1`,
    )
    .all() as { id: number; closingDay: number }[]
  return new Map(rows.map((row) => [row.id, row.closingDay]))
}

function buildCardDeferred(
  items: SpendingCalendarItem[],
  month: string,
  closingDays: Map<number, number>,
): SpendingGuardCardDeferred {
  const byInvoiceMonth = new Map<string, number>()

  for (const item of items) {
    if (item.source !== 'card' || !item.cardId) continue
    const closingDay = closingDays.get(item.cardId)
    if (closingDay === undefined) continue

    const invoiceMonth = transacaoFaturaMonth(item.date, closingDay)
    if (invoiceMonth === month) continue

    byInvoiceMonth.set(
      invoiceMonth,
      roundMoney((byInvoiceMonth.get(invoiceMonth) ?? 0) + item.amount),
    )
  }

  let invoiceMonthLabel: string | null = null
  let amount = 0
  for (const [invoiceMonth, value] of byInvoiceMonth) {
    if (value > amount) {
      amount = value
      invoiceMonthLabel = shortMonthLabel(invoiceMonth)
    }
  }

  return { amount, invoiceMonthLabel }
}

function buildBreakdownGroups(
  items: SpendingCalendarItem[],
  month: string,
  closingDays: Map<number, number>,
): SpendingGuardBreakdownGroup[] {
  const groups = new Map<string, SpendingGuardBreakdownGroup>()

  for (const item of items) {
    const key = item.categoryId != null ? String(item.categoryId) : 'none'
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        label: item.categoryName ?? 'Sem categoria',
        color: item.categoryColor,
        icon: item.categoryIcon,
        total: 0,
        items: [],
      }
      groups.set(key, group)
    }

    let invoiceMonthLabel: string | null = null
    if (item.source === 'card' && item.cardId) {
      const closingDay = closingDays.get(item.cardId)
      if (closingDay !== undefined) {
        const invoiceMonth = transacaoFaturaMonth(item.date, closingDay)
        if (invoiceMonth !== month) {
          invoiceMonthLabel = shortMonthLabel(invoiceMonth)
        }
      }
    }

    const breakdownItem: SpendingGuardBreakdownItem = {
      id: item.id,
      description: item.description,
      amount: item.amount,
      date: item.date,
      source: item.source,
      sourceLabel:
        item.source === 'card' ? item.cardName : item.accountName,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      categoryIcon: item.categoryIcon,
      invoiceMonthLabel,
    }

    group.items.push(breakdownItem)
    group.total = roundMoney(group.total + item.amount)
  }

  for (const group of groups.values()) {
    group.items.sort(
      (a, b) => b.date.localeCompare(a.date) || b.amount - a.amount,
    )
  }

  return [...groups.values()].sort((a, b) => b.total - a.total)
}

export function buildSpendingGuard(
  db: Database.Database,
  month = todayLocal().slice(0, 7),
  referenceDate = todayLocal(),
): SpendingGuardReport {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido.',
    })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Data de referência inválida.',
    })
  }

  const currentMonth = referenceDate.slice(0, 7)
  const monthKind =
    month < currentMonth ? 'past' : month > currentMonth ? 'future' : 'current'
  const calendar = buildSpendingCalendar(db, month, 'all')
  const paymentEntryIds = invoicePaymentEntryIds(db)
  const closingDays = loadCardClosingDays(db)
  const items = calendar.days
    .flatMap((day) => day.items)
    .filter(
      (item) =>
        item.source !== 'account' || !paymentEntryIds.has(item.parentId),
    )
  const spentItems =
    monthKind === 'past'
      ? items
      : monthKind === 'future'
        ? []
        : items.filter((item) => item.date <= referenceDate)
  const futureItems =
    monthKind === 'past'
      ? []
      : monthKind === 'future'
        ? items
        : items.filter((item) => item.date > referenceDate)

  const expectedIncome = roundMoney(
    occurrencesForCashMonth(db, month)
      .filter((occurrence) => occurrence.type === 'income')
      .reduce((sum, occurrence) => sum + occurrence.amount, 0),
  )
  const globalSettings = resolveGlobalSpendingSettings(
    db,
    month,
    expectedIncome,
  )
  const savingsGoal = globalSettings.savingsGoal
  const spendingLimit = globalSettings.spendingLimit
  const spentToDate = roundMoney(
    spentItems.reduce((sum, item) => sum + item.amount, 0),
  )
  const futureCommitted = roundMoney(
    futureItems.reduce((sum, item) => sum + item.amount, 0),
  )
  const committedTotal = roundMoney(spentToDate + futureCommitted)
  const remainingToLimit = roundMoney(spendingLimit - spentToDate)
  const availableAfterCommitments = roundMoney(
    spendingLimit - committedTotal,
  )

  const daysInMonth = calendar.stats.daysInMonth
  const referenceDay = Number(referenceDate.slice(8, 10))
  const day =
    monthKind === 'past'
      ? daysInMonth
      : monthKind === 'future'
        ? 0
        : Math.min(Math.max(referenceDay, 1), daysInMonth)
  const daysRemaining = Math.max(daysInMonth - day, 0)
  const spentPercent =
    spendingLimit > 0
      ? roundPercent((spentToDate / spendingLimit) * 100)
      : 0
  const committedPercent =
    spendingLimit > 0
      ? roundPercent((committedTotal / spendingLimit) * 100)
      : 0
  const elapsedPercent = roundPercent((day / daysInMonth) * 100)
  const expectedSpendToDate = roundMoney(
    spendingLimit * (elapsedPercent / 100),
  )
  const paceDeltaPercent = roundPercent(spentPercent - elapsedPercent)

  const sourceTotals = totalsBySource(spentItems)
  const committedSourceTotals = totalsBySource(items)
  const cardDeferred = buildCardDeferred(spentItems, month, closingDays)
  const spentBreakdown = buildBreakdownGroups(
    spentItems,
    month,
    closingDays,
  )
  const futureBreakdown = buildBreakdownGroups(
    futureItems,
    month,
    closingDays,
  )
  const spentOfIncomePercent =
    expectedIncome > 0
      ? roundPercent((spentToDate / expectedIncome) * 100)
      : 0
  const limitOfIncomePercent =
    expectedIncome > 0
      ? roundPercent((spendingLimit / expectedIncome) * 100)
      : 0
  const actualSavingsPercent =
    expectedIncome > 0
      ? roundPercent(
          ((expectedIncome - spentToDate) / expectedIncome) * 100,
        )
      : null

  return {
    month,
    fullLabel: calendar.fullLabel,
    monthKind,
    asOf:
      monthKind === 'past'
        ? monthEnd(month)
        : monthKind === 'current'
          ? referenceDate
          : null,
    day,
    daysInMonth,
    daysRemaining,
    savingsTargetPercent: globalSettings.savingsTargetPercent,
    spendingLimitPercent: globalSettings.spendingLimitPercent,
    expectedIncome,
    savingsGoal,
    spendingLimit,
    spentToDate,
    futureCommitted,
    committedTotal,
    remainingToLimit,
    availableAfterCommitments,
    dailyAvailable:
      daysRemaining > 0
        ? roundMoney(Math.max(0, remainingToLimit) / daysRemaining)
        : Math.max(0, remainingToLimit),
    spentOfIncomePercent,
    limitOfIncomePercent,
    actualSavingsPercent,
    cardDeferred,
    spentBreakdown,
    futureBreakdown,
    spentPercent,
    committedPercent,
    elapsedPercent,
    expectedSpendToDate,
    paceDeltaPercent,
    status: statusFor(expectedIncome, spentPercent, committedPercent),
    pace: paceFor(paceDeltaPercent),
    sourceTotals,
    committedSourceTotals,
    itemCountToDate: spentItems.length,
  }
}
