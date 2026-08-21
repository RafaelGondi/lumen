import type Database from 'better-sqlite3'
import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import type { EvolutionMonth, EvolutionReport } from '~/types/evolution'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { buildCardInvoice } from './cardInvoice'
import { getProjectedBalancesAtDates } from './cashFlow'
import { occurrencesForCashMonth } from './occurrences'

const REPORT_MONTHS = 12
const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
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

function monthEnd(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(year!, monthNumber!, 0).getDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${MONTH_LABELS[monthNumber! - 1]}/${String(year).slice(-2)}`
}

function monthsThrough(endMonth: string, count: number) {
  const first = addMonthsLocal(`${endMonth}-01`, -(count - 1))
  return Array.from({ length: count }, (_, index) =>
    addMonthsLocal(first, index).slice(0, 7),
  )
}

function monthlyFlow(
  db: Database.Database,
  cards: Card[],
  month: string,
) {
  const occurrences = occurrencesForCashMonth(db, month)
  const income = roundMoney(
    occurrences
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0),
  )
  let expenses = occurrences
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0)

  // Mesma regra da home: fatura aberta entra como saída projetada; fatura
  // paga já possui lançamento na conta e não pode ser somada novamente.
  for (const card of cards) {
    const invoice = buildCardInvoice(db, card, month)
    if (invoice.status !== 'paid' && invoice.total > 0) {
      expenses += invoice.total
    }
  }

  return { income, expenses: roundMoney(expenses) }
}

export function buildEvolutionReport(
  db: Database.Database,
  endMonth = todayLocal().slice(0, 7),
): EvolutionReport {
  if (!/^\d{4}-\d{2}$/.test(endMonth)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido. Use YYYY-MM.',
    })
  }

  const currentMonth = todayLocal().slice(0, 7)
  if (endMonth > currentMonth) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A evolução não aceita um mês final futuro.',
    })
  }

  const months = monthsThrough(endMonth, REPORT_MONTHS)
  const monthEnds = months.map(monthEnd)
  const patrimonyByDate = getProjectedBalancesAtDates(db, monthEnds)
  const cards = loadActiveCards(db)

  const rows: EvolutionMonth[] = months.map((month, index) => {
    const flow = monthlyFlow(db, cards, month)
    const balance = roundMoney(flow.income - flow.expenses)
    return {
      month,
      label: monthLabel(month),
      income: flow.income,
      expenses: flow.expenses,
      balance,
      patrimony: roundMoney(patrimonyByDate.get(monthEnds[index]!) ?? 0),
      savingsRate:
        flow.income > 0
          ? roundMoney((balance / flow.income) * 100)
          : null,
      isCurrent: month === currentMonth,
    }
  })

  const activeMonths = rows.filter((row) => row.income > 0)
  const average = (pick: (row: EvolutionMonth) => number) =>
    activeMonths.length
      ? roundMoney(
          activeMonths.reduce((sum, row) => sum + pick(row), 0) /
            activeMonths.length,
        )
      : 0

  return {
    generatedAt: todayLocal(),
    startMonth: months[0]!,
    endMonth,
    summary: {
      averageIncome: average((row) => row.income),
      averageExpenses: average((row) => row.expenses),
      averageBalance: average((row) => row.balance),
      averageSavingsRate: average((row) => row.savingsRate ?? 0),
      activeMonths: activeMonths.length,
    },
    months: rows,
  }
}
