import type Database from 'better-sqlite3'
import type {
  SpendingGuardPace,
  SpendingGuardReport,
  SpendingGuardStatus,
} from '~/types/spendingGuard'
import { roundMoney } from '~/utils/dateMoney'
import { occurrencesForCashMonth } from './occurrences'
import { buildSpendingCalendar } from './spendingCalendar'

const SAVINGS_TARGET_PERCENT = 25
const SPENDING_LIMIT_PERCENT = 100 - SAVINGS_TARGET_PERCENT

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
  const savingsGoal = roundMoney(
    expectedIncome * (SAVINGS_TARGET_PERCENT / 100),
  )
  const spendingLimit = roundMoney(
    expectedIncome * (SPENDING_LIMIT_PERCENT / 100),
  )
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
    savingsTargetPercent: SAVINGS_TARGET_PERCENT,
    spendingLimitPercent: SPENDING_LIMIT_PERCENT,
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
        ? roundMoney(Math.max(0, availableAfterCommitments) / daysRemaining)
        : Math.max(0, availableAfterCommitments),
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
