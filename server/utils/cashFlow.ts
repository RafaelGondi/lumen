import type Database from 'better-sqlite3'
import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import type {
  CashFlowDay,
  CashFlowMonthKind,
  CashFlowMovement,
  CashFlowReport,
} from '~/types/cashFlow'
import type { EntryOccurrence } from '~/types/entry'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { allAccountBalancesAtCutoff, occurrencesForCashMonth } from './occurrences'
import { buildCardInvoice } from './cardInvoice'

/** Dias com saldo negativo ou abaixo deste valor entram em “críticos”. */
export const CASH_FLOW_CRITICAL_THRESHOLD = 500

const MONTH_NAMES = [
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

type CardRow = {
  id: number
  name: string
  bankKey: BankKey
  bankName: string
  color: string
  lastFour: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  active: number
  createdAt: string
}

function monthParts(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return { year: year!, month: month! }
}

function monthBounds(monthKey: string) {
  const { year, month } = monthParts(monthKey)
  const lastDay = new Date(year, month, 0).getDate()
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const prevEnd = addMonthsLocal(start, -1)
  const prevLast = new Date(
    Number(prevEnd.slice(0, 4)),
    Number(prevEnd.slice(5, 7)),
    0,
  ).getDate()
  const prevMonthEnd = `${prevEnd.slice(0, 7)}-${String(prevLast).padStart(2, '0')}`
  return { year, month, start, end, lastDay, prevMonthEnd }
}

function dueDateInMonth(monthKey: string, dueDay: number) {
  const { year, month } = monthParts(monthKey)
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthsBetweenInclusive(fromMonth: string, toMonth: string) {
  const result: string[] = []
  let cursor = `${fromMonth}-01`
  while (cursor.slice(0, 7) <= toMonth) {
    result.push(cursor.slice(0, 7))
    cursor = addMonthsLocal(cursor, 1)
    if (result.length > 120) break
  }
  return result
}

/** Saldo bancário consolidado real na data (ocorrências liquidadas até o cutoff). */
export function getSaldoBancarioTotal(db: Database.Database, date: string) {
  return roundMoney(
    [...allAccountBalancesAtCutoff(db, date).values()].reduce(
      (sum, value) => sum + value,
      0,
    ),
  )
}

function loadActiveCards(db: Database.Database): Card[] {
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
       WHERE active = 1
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as CardRow[]

  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }))
}

function occurrenceToMovement(occurrence: EntryOccurrence): CashFlowMovement {
  const signedAmount =
    occurrence.type === 'income' ? occurrence.amount : -occurrence.amount
  return {
    id: occurrence.occurrenceKey,
    description: occurrence.description,
    amount: occurrence.amount,
    signedAmount: roundMoney(signedAmount),
    type: occurrence.type === 'income' ? 'income' : 'expense',
    statusLabel: occurrence.settled
      ? occurrence.type === 'income'
        ? 'Recebido'
        : 'Realizado'
      : occurrence.type === 'income'
        ? 'A receber'
        : 'A pagar',
    accountLabel: occurrence.accountName,
    categoryName: occurrence.categoryName,
    categoryColor: occurrence.categoryColor,
    categoryIcon: occurrence.categoryIcon,
    bankKey: null,
    bankName: null,
    bankColor: null,
  }
}

/**
 * Fatura aberta projetada no vencimento.
 * Fatura paga já debita a conta via lançamento — não projeta de novo.
 */
function cardInvoiceMovementsForMonth(
  db: Database.Database,
  cards: Card[],
  invoiceMonth: string,
): CashFlowMovement[] {
  const movements: CashFlowMovement[] = []
  for (const card of cards) {
    const invoice = buildCardInvoice(db, card, invoiceMonth)
    if (invoice.status === 'paid' || invoice.total <= 0) continue
    movements.push({
      id: `card-invoice:${card.id}:${invoiceMonth}`,
      description: `Fatura ${card.name}`,
      amount: invoice.total,
      signedAmount: roundMoney(-invoice.total),
      type: 'card_invoice',
      statusLabel: 'Projetado',
      accountLabel: card.name,
      categoryName: null,
      categoryColor: null,
      categoryIcon: null,
      bankKey: card.bankKey,
      bankName: card.bankName,
      bankColor: card.color,
    })
  }
  return movements
}

function projectedAccountSigned(
  occurrence: EntryOccurrence,
): number | null {
  // Alinhado ao previsto do dashboard: unpaid não entra no saldo projetado.
  if (occurrence.paymentState === 'unpaid') return null
  return occurrence.type === 'income' ? occurrence.amount : -occurrence.amount
}

type DatedMovement = CashFlowMovement & { date: string }

function collectProjectedMovements(
  db: Database.Database,
  cards: Card[],
  fromExclusive: string,
  toInclusive: string,
): DatedMovement[] {
  if (toInclusive <= fromExclusive) return []

  const startMonth = fromExclusive.slice(0, 7)
  const endMonth = toInclusive.slice(0, 7)
  const months = monthsBetweenInclusive(startMonth, endMonth)
  const result: DatedMovement[] = []

  for (const month of months) {
    const occurrences = occurrencesForCashMonth(db, month)
    for (const occurrence of occurrences) {
      if (occurrence.date <= fromExclusive || occurrence.date > toInclusive) {
        continue
      }
      const signed = projectedAccountSigned(occurrence)
      if (signed === null) continue
      result.push({
        ...occurrenceToMovement(occurrence),
        signedAmount: roundMoney(signed),
        date: occurrence.date,
      })
    }

    for (const card of cards) {
      const dueDate = dueDateInMonth(month, card.dueDay)
      // Inclui vencimento = hoje: o ponto de hoje fica real; dias seguintes já projetam o débito.
      if (dueDate < fromExclusive || dueDate > toInclusive) continue
      const invoice = buildCardInvoice(db, card, month)
      if (invoice.status === 'paid' || invoice.total <= 0) continue
      result.push({
        id: `card-invoice:${card.id}:${month}`,
        description: `Fatura ${card.name}`,
        amount: invoice.total,
        signedAmount: roundMoney(-invoice.total),
        type: 'card_invoice',
        statusLabel: 'Projetado',
        accountLabel: card.name,
        categoryName: null,
        categoryColor: null,
        categoryIcon: null,
        bankKey: card.bankKey,
        bankName: card.bankName,
        bankColor: card.color,
        date: dueDate,
      })
    }
  }

  return result
}

function dayMovements(
  db: Database.Database,
  cards: Card[],
  date: string,
  today: string,
): CashFlowMovement[] {
  const month = date.slice(0, 7)
  const movements: CashFlowMovement[] = []

  for (const occurrence of occurrencesForCashMonth(db, month)) {
    if (occurrence.date !== date) continue
    movements.push(occurrenceToMovement(occurrence))
  }

  // Fatura no vencimento: só a partir de hoje (sem inventar pagamento histórico).
  for (const card of cards) {
    const dueDate = dueDateInMonth(month, card.dueDay)
    if (dueDate !== date || date < today) continue
    movements.push(...cardInvoiceMovementsForMonth(db, [card], month))
  }

  return movements.sort(
    (a, b) =>
      Math.abs(b.amount) - Math.abs(a.amount) ||
      a.description.localeCompare(b.description),
  )
}

function monthKindFor(monthKey: string, today: string): CashFlowMonthKind {
  const current = today.slice(0, 7)
  if (monthKey < current) return 'past'
  if (monthKey > current) return 'future'
  return 'current'
}

export function buildCashFlowReport(
  db: Database.Database,
  monthKey: string,
): CashFlowReport {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido. Use YYYY-MM.',
    })
  }

  const today = todayLocal()
  const { year, month, end, lastDay, prevMonthEnd } = monthBounds(monthKey)
  const kind = monthKindFor(monthKey, today)
  const cards = loadActiveCards(db)

  const openingBalance =
    prevMonthEnd <= today
      ? getSaldoBancarioTotal(db, prevMonthEnd)
      : roundMoney(
          getSaldoBancarioTotal(db, today) +
            collectProjectedMovements(
              db,
              cards,
              today,
              prevMonthEnd,
            ).reduce((sum, item) => sum + item.signedAmount, 0),
        )

  const todayBalance =
    kind === 'current' ? getSaldoBancarioTotal(db, today) : null

  const projectedCache = collectProjectedMovements(db, cards, today, end)
  const projectedThrough = (date: string) =>
    roundMoney(
      (todayBalance ?? getSaldoBancarioTotal(db, today)) +
        projectedCache
          .filter((item) => item.date <= date)
          .reduce((sum, item) => sum + item.signedAmount, 0),
    )

  const days: CashFlowDay[] = []
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isToday = date === today
    let balance: number
    if (date <= today) {
      balance = getSaldoBancarioTotal(db, date)
    } else {
      balance = projectedThrough(date)
    }

    days.push({
      date,
      day,
      balance,
      isToday,
      isCritical:
        balance < 0 || balance < CASH_FLOW_CRITICAL_THRESHOLD,
      movements: dayMovements(db, cards, date, today),
    })
  }

  let worst = days[0]!
  for (const item of days) {
    if (item.balance < worst.balance) worst = item
  }

  const closingBalance = days[days.length - 1]!.balance
  const closingDelta = roundMoney(closingBalance - openingBalance)

  return {
    month: monthKey,
    fullLabel: `${MONTH_NAMES[month - 1]} de ${year}`,
    monthKind: kind,
    criticalThreshold: CASH_FLOW_CRITICAL_THRESHOLD,
    openingBalance: roundMoney(openingBalance),
    todayBalance,
    worstBalance: roundMoney(worst.balance),
    worstDay: worst.day,
    closingBalance: roundMoney(closingBalance),
    closingDelta,
    days,
  }
}
