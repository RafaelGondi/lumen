import type Database from 'better-sqlite3'
import type { Card } from '~/types/card'
import type {
  CardInvoiceCategorySpend,
  CardInvoiceDetail,
  CardInvoiceEntry,
  CardInvoiceProjectionMonth,
  CardsProjectionSummary,
} from '~/types/cardInvoice'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { cardExpensesForInvoice } from './cardExpenses'
import {
  loadAdjustmentsForCards,
  loadCardInvoiceAdjustment,
  loadCardInvoiceAdjustmentsMap,
} from './cardInvoiceAdjustment'
import {
  loadCardInvoicePayment,
  loadCardInvoicePaymentsMap,
  loadPaidInvoiceKeys,
} from './cardInvoicePayment'

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
const MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function monthParts(month: string) {
  const [year, value] = month.split('-').map(Number)
  return { year: year!, month: value! }
}

function shiftMonth(month: string, delta: number) {
  return addMonthsLocal(`${month}-01`, delta).slice(0, 7)
}

function monthLabel(month: string) {
  const { year, month: value } = monthParts(month)
  return `${MONTH_SHORT[value - 1]}/${year}`
}

function fullMonthLabel(month: string) {
  const { year, month: value } = monthParts(month)
  return `${MONTH_FULL[value - 1]} de ${year}`
}

function invoiceEntries(
  db: Database.Database,
  card: Card,
  month: string,
): CardInvoiceEntry[] {
  return cardExpensesForInvoice(db, card.id, month, card.closingDay).map(
    (occurrence) => ({
      id: occurrence.occurrenceKey,
      parentId: occurrence.parentId,
      occurrenceMonth: occurrence.occurrenceMonth,
      occurrenceIndex: occurrence.occurrenceIndex,
      description: occurrence.description,
      notes: occurrence.notes,
      date: occurrence.date,
      amount: occurrence.amount,
      statementName: occurrence.statementName,
      recurrence: occurrence.recurrence,
      installmentCount: occurrence.installmentCount,
      installmentIndex: occurrence.installmentIndex,
      useMonthEnd: occurrence.useMonthEnd,
      categoryId: occurrence.categoryId,
      categoryName: occurrence.categoryName,
      categoryColor: occurrence.categoryColor,
      categoryIcon: occurrence.categoryIcon,
    }),
  )
}

function buildCategories(entries: CardInvoiceEntry[]) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  if (total <= 0) return []

  const map = new Map<string, CardInvoiceCategorySpend>()
  for (const entry of entries) {
    const key = entry.categoryName ?? 'Outros'
    const current = map.get(key)
    map.set(key, {
      id: key,
      name: key,
      color: entry.categoryColor ?? '#5d6570',
      amount: roundMoney((current?.amount ?? 0) + entry.amount),
      percent: 0,
    })
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      percent: Math.round((item.amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
}

function dueDateInMonth(month: string, dueDay: number) {
  const { year, month: value } = monthParts(month)
  const lastDay = new Date(year, value, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  return `${year}-${String(value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function openInvoiceStatus(
  month: string,
  dueDay: number,
  today: string,
): { status: CardInvoiceDetail['status']; statusLabel: string } {
  const dueDate = dueDateInMonth(month, dueDay)
  if (dueDate < today) {
    return { status: 'overdue', statusLabel: 'Vencida' }
  }
  return { status: 'open', statusLabel: 'Em aberto' }
}

function invoiceMonthAmount(
  db: Database.Database,
  card: Card,
  month: string,
  adjustments: Map<string, number>,
  payments: Map<string, { totalPaid: number }>,
) {
  if (payments.has(month)) return 0
  const entriesSubtotal = invoiceEntries(db, card, month).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )
  return roundMoney(entriesSubtotal + (adjustments.get(month) ?? 0))
}

function buildProjection(
  db: Database.Database,
  card: Card,
  focusMonth: string,
): CardInvoiceProjectionMonth[] {
  const adjustments = loadCardInvoiceAdjustmentsMap(db, card.id)
  const payments = loadCardInvoicePaymentsMap(db, card.id)
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(focusMonth, index - 1)
    return {
      month,
      shortLabel: MONTH_SHORT[monthParts(month).month - 1]!,
      amount: invoiceMonthAmount(db, card, month, adjustments, payments),
    }
  })
  return markResidualMonths(months)
}

/** Residual: valor < R$ 150 ou ≤ 15% da média das faturas positivas. */
function markResidualMonths(
  months: CardInvoiceProjectionMonth[],
): CardInvoiceProjectionMonth[] {
  const positive = months.filter((item) => item.amount > 0)
  const average =
    positive.length > 0
      ? positive.reduce((sum, item) => sum + item.amount, 0) / positive.length
      : 0

  return months.map((item) => ({
    ...item,
    residual:
      item.amount > 0 &&
      (item.amount < 150 || item.amount <= average * 0.15),
  }))
}

/**
 * Início da cauda residual: primeiro mês a partir do qual
 * todas as faturas positivas restantes são residuais.
 * Evita marcar um mês isolado no começo (ex.: jul baixo antes de ago alto).
 */
function residualFromLabel(months: CardInvoiceProjectionMonth[]) {
  for (let index = 0; index < months.length; index += 1) {
    const tail = months.slice(index)
    const positiveTail = tail.filter((item) => item.amount > 0)
    if (positiveTail.length === 0) continue
    if (positiveTail.every((item) => item.residual)) {
      return monthLabel(positiveTail[0]!.month)
    }
  }
  return null
}

/**
 * Projeção consolidada (todos os cartões) — próximos 12 meses a partir de hoje.
 * Não altera saldo de conta.
 */
export function buildConsolidatedCardsProjection(
  db: Database.Database,
  fromMonth = todayLocal().slice(0, 7),
): CardsProjectionSummary {
  const rows = db
    .prepare(
      `SELECT
         id,
         name,
         bank_key AS bankKey,
         bank_name AS bankName,
         color,
         last_four AS lastFour,
         credit_limit AS creditLimit,
         closing_day AS closingDay,
         due_day AS dueDay,
         active,
         created_at AS createdAt
       FROM cards
       WHERE active = 1`,
    )
    .all() as {
    id: number
    name: string
    bankKey: Card['bankKey']
    bankName: string
    color: string
    lastFour: string | null
    creditLimit: number
    closingDay: number
    dueDay: number
    active: number
    createdAt: string
  }[]

  const mapped: Card[] = rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }))

  const adjustments = loadAdjustmentsForCards(
    db,
    mapped.map((card) => card.id),
  )
  const paidKeys = loadPaidInvoiceKeys(
    db,
    mapped.map((card) => card.id),
  )

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(fromMonth, index)
    const amount = roundMoney(
      mapped.reduce((sum, card) => {
        if (paidKeys.has(`${card.id}:${month}`)) return sum
        const entriesSubtotal = invoiceEntries(db, card, month).reduce(
          (entrySum, entry) => entrySum + entry.amount,
          0,
        )
        const adjustment =
          adjustments.get(`${card.id}:${month}`) ?? 0
        return sum + entriesSubtotal + adjustment
      }, 0),
    )
    return {
      month,
      shortLabel: MONTH_SHORT[monthParts(month).month - 1]!,
      amount,
    }
  })

  const withResidual = markResidualMonths(months)
  const lastProjected = [...withResidual]
    .reverse()
    .find((item) => item.amount > 0)

  return {
    months: withResidual,
    total: roundMoney(
      withResidual.reduce((sum, item) => sum + item.amount, 0),
    ),
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
    residualInvoicesFrom: residualFromLabel(withResidual),
  }
}

/**
 * Fatura aberta para exibição/agrupamento.
 *
 * ANTI-BUG: a soma dinâmica abaixo nunca altera saldo de conta. Na fase de
 * pagamento, o total exibido deverá ser persistido e só esse snapshot poderá
 * debitar a conta; fatura paga nunca será recalculada pela janela de datas.
 */
export function buildCardInvoice(
  db: Database.Database,
  card: Card,
  month: string,
): CardInvoiceDetail {
  const entries = invoiceEntries(db, card, month)
  const payment = loadCardInvoicePayment(db, card.id, month)
  const today = todayLocal()

  let entriesSubtotal: number
  let adjustment: number
  let adjustmentNotes: string | null
  let total: number
  let status: CardInvoiceDetail['status']
  let statusLabel: string
  let paymentInfo: CardInvoiceDetail['payment'] = null

  if (payment) {
    entriesSubtotal = payment.entriesSubtotal
    adjustment = payment.adjustment
    adjustmentNotes = payment.notes
    total = payment.totalPaid
    status = 'paid'
    statusLabel = 'Paga'
    const account = db
      .prepare('SELECT name FROM accounts WHERE id = ?')
      .get(payment.accountId) as { name: string } | undefined
    paymentInfo = {
      accountId: payment.accountId,
      accountName: account?.name ?? 'Conta',
      entryId: payment.entryId,
      paymentDate: payment.paymentDate,
      totalPaid: payment.totalPaid,
    }
  } else {
    entriesSubtotal = roundMoney(
      entries.reduce((sum, entry) => sum + entry.amount, 0),
    )
    const adjustmentRow = loadCardInvoiceAdjustment(db, card.id, month)
    adjustment = adjustmentRow?.amount ?? 0
    adjustmentNotes = adjustmentRow?.notes ?? null
    total = roundMoney(entriesSubtotal + adjustment)
    const open = openInvoiceStatus(month, card.dueDay, today)
    status = open.status
    statusLabel = open.statusLabel
  }

  const projection = buildProjection(db, card, month)
  const lastProjected = [...projection]
    .reverse()
    .find((item) => item.amount > 0)
  // Limite comprometido: fatura paga não conta; abertas usam o total atual.
  const committed = payment ? 0 : total
  const availableAmount = roundMoney(
    Math.max(0, card.creditLimit - committed),
  )
  const usedPercent =
    card.creditLimit > 0
      ? Math.min(100, Math.round((committed / card.creditLimit) * 100))
      : 0

  return {
    cardId: card.id,
    month,
    monthLabel: monthLabel(month),
    fullMonthLabel: fullMonthLabel(month),
    status,
    statusLabel,
    entriesSubtotal,
    adjustment,
    adjustmentNotes,
    total,
    creditLimit: card.creditLimit,
    usedAmount: committed,
    availableAmount,
    usedPercent,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
    residualInvoicesFrom: residualFromLabel(projection),
    payment: paymentInfo,
    projection,
    categories: buildCategories(entries),
    entries,
  }
}

/**
 * Limite comprometido e quitação estimada para a listagem de cartões.
 * Soma faturas do mês corrente em diante (parcelas futuras entram).
 * Não altera saldo de conta.
 */
export function cardUsageSummary(
  db: Database.Database,
  card: Omit<Card, 'usedAmount' | 'estimatedPayoffLabel'>,
  fromMonth = todayLocal().slice(0, 7),
) {
  const withPlaceholder: Card = {
    ...card,
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }
  const invoice = buildCardInvoice(db, withPlaceholder, fromMonth)
  const usedAmount = roundMoney(
    invoice.projection
      .filter((item) => item.month >= fromMonth)
      .reduce((sum, item) => sum + item.amount, 0),
  )
  const lastProjected = [...invoice.projection]
    .filter((item) => item.month >= fromMonth && item.amount > 0)
    .at(-1)

  return {
    usedAmount,
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
  }
}

