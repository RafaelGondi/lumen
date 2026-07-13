import type {
  DashboardMonth,
  FinanceListItem,
  FinanceListSectionData,
  FinancialStat,
  TransactionStatus,
} from '~/types/finance'
import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import { roundMoney } from '~/utils/dateMoney'
import {
  allAccountBalancesAtCutoff,
  occurrencesForCashMonth,
  settledOccurrencesUntil,
} from './occurrences'
import { buildCardInvoice } from './cardInvoice'
import { buildCashFlowReport } from './cashFlow'

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

function monthBounds(monthKey: string) {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number)
  const year = yearRaw!
  const month = monthRaw!
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const prevMonthDate = new Date(year, month - 2, 1)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonth = prevMonthDate.getMonth() + 1
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`
  const prevLabel = `${String(prevLastDay).padStart(2, '0')} ${MONTH_NAMES[prevMonth - 1]!.slice(0, 3).toLowerCase()}.`

  return { start, end, prevEnd, prevLabel, year, month }
}

function dueDateInMonth(monthKey: string, dueDay: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const lastDay = new Date(year!, month!, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Hoje'
  if (date < today) {
    const [, m, d] = date.split('-')
    return `Venceu ${d}/${m}`
  }

  const [, m, d] = date.split('-')
  const monthName = MONTH_NAMES[Number(m) - 1]!.slice(0, 3).toLowerCase()
  return `${Number(d)} ${monthName}.`
}

function formatDueBr(date: string) {
  const [, m, d] = date.split('-')
  const [year] = date.split('-')
  return `Vence ${d}/${m}/${year}`
}

function expenseListStatus(
  entry: { settled: boolean; date: string },
  today: string,
): TransactionStatus {
  if (entry.settled) return 'paid'
  if (entry.date < today) return 'overdue'
  if (entry.date > today) return 'scheduled'
  return 'pending'
}

function invoiceListStatus(dueDate: string, today: string): TransactionStatus {
  if (dueDate < today) return 'overdue'
  if (dueDate > today) return 'scheduled'
  return 'pending'
}

function incomeListStatus(entry: { settled: boolean }): TransactionStatus {
  return entry.settled ? 'received' : 'pending'
}

function loadActiveCards(db: ReturnType<typeof useDb>): Card[] {
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
    .all() as {
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
  }[]

  return rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }))
}

function sortOldestFirst(items: FinanceListItem[]) {
  return [...items].sort(
    (a, b) =>
      a.sortDate.localeCompare(b.sortDate) || a.name.localeCompare(b.name),
  )
}

function buildPayablesSection(
  items: FinanceListItem[],
): FinanceListSectionData {
  const paid = sortOldestFirst(items.filter((item) => item.settled))
  const open = sortOldestFirst(items.filter((item) => !item.settled))
  const groups = []
  if (paid.length) {
    groups.push({
      key: 'paid',
      label: 'pagos',
      total: roundMoney(paid.reduce((sum, item) => sum + item.amount, 0)),
      items: paid,
    })
  }
  if (open.length) {
    groups.push({
      key: 'open',
      label: 'a pagar',
      total: roundMoney(open.reduce((sum, item) => sum + item.amount, 0)),
      items: open,
    })
  }
  return {
    groups,
    total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)),
    itemCount: items.length,
  }
}

function buildIncomesSection(items: FinanceListItem[]): FinanceListSectionData {
  const received = sortOldestFirst(items.filter((item) => item.settled))
  const pending = sortOldestFirst(items.filter((item) => !item.settled))
  const groups = []
  if (received.length) {
    groups.push({
      key: 'received',
      label: 'recebidos',
      total: roundMoney(received.reduce((sum, item) => sum + item.amount, 0)),
      items: received,
    })
  }
  if (pending.length) {
    groups.push({
      key: 'pending',
      label: 'a receber',
      total: roundMoney(pending.reduce((sum, item) => sum + item.amount, 0)),
      items: pending,
    })
  }
  return {
    groups,
    total: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)),
    itemCount: items.length,
  }
}

export function buildDashboardMonth(monthKey: string): DashboardMonth {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido. Use YYYY-MM.',
    })
  }

  const db = useDb()
  const today = todayLocal()
  const { end, prevEnd, prevLabel, year, month } = monthBounds(monthKey)
  const currentMonth = today.slice(0, 7)
  const totalBalancesAt = (cutoff: string) =>
    roundMoney(
      [...allAccountBalancesAtCutoff(db, cutoff).values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
    )

  // Uma única fonte de verdade com o relatório de fluxo (inclui faturas no vencimento).
  const cashFlow = buildCashFlowReport(db, monthKey)

  // Mês passado: saldo no fim do período. Mês atual/futuro: saldo real de hoje
  // (nunca usar o fim do mês futuro como cutoff — isso marca tudo como liquidado).
  const currentBalanceValue =
    monthKey < currentMonth ? totalBalancesAt(end) : totalBalancesAt(today)

  // Período anterior ainda no futuro → abertura projetada do mês ( = fechamento do mês anterior).
  const previousBalanceValue =
    prevEnd <= today ? totalBalancesAt(prevEnd) : cashFlow.openingBalance

  const monthEntries = occurrencesForCashMonth(db, monthKey)

  const invoiceItems: FinanceListItem[] = []
  for (const card of loadActiveCards(db)) {
    const invoice = buildCardInvoice(db, card, monthKey)
    if (invoice.total <= 0 && invoice.status !== 'paid') continue
    const dueDate = dueDateInMonth(monthKey, card.dueDay)
    const paid = invoice.status === 'paid'
    invoiceItems.push({
      id: `invoice-${card.id}-${monthKey}`,
      name: `Fatura ${card.name}`,
      category: paid
        ? `Paga em ${formatDueBr(invoice.payment!.paymentDate)}`
        : formatDueBr(dueDate),
      dateLabel: paid
        ? formatDayLabel(invoice.payment!.paymentDate, today)
        : formatDayLabel(dueDate, today),
      sortDate: paid ? invoice.payment!.paymentDate : dueDate,
      amount: invoice.total,
      status: paid ? 'paid' : invoiceListStatus(dueDate, today),
      account: paid ? invoice.payment!.accountName : card.bankName,
      kind: 'card_invoice',
      settled: paid,
      categoryIcon: null,
      categoryColor: null,
      bankKey: card.bankKey,
      bankColor: card.color,
      linkTo: `/cartoes/${card.id}?month=${monthKey}`,
    })
  }

  const invoiceTotal = roundMoney(
    invoiceItems
      .filter((item) => !item.settled)
      .reduce((sum, item) => sum + item.amount, 0),
  )

  let incomeTotal = 0
  let incomeReceived = 0
  let incomePending = 0
  let expenseTotal = 0
  let expensePaid = 0
  let expensePending = 0

  for (const entry of monthEntries) {
    if (entry.type === 'income') {
      incomeTotal += entry.amount
      if (entry.settled) incomeReceived += entry.amount
      else incomePending += entry.amount
    } else if (entry.type === 'expense') {
      expenseTotal += entry.amount
      if (entry.settled) expensePaid += entry.amount
      else expensePending += entry.amount
    }
  }

  // Faturas abertas entram como despesa pendente; pagas já debitaram a conta via lançamento.
  expenseTotal = roundMoney(expenseTotal + invoiceTotal)
  expensePending = roundMoney(expensePending + invoiceTotal)
  incomeTotal = roundMoney(incomeTotal)
  incomeReceived = roundMoney(incomeReceived)
  incomePending = roundMoney(incomePending)
  expensePaid = roundMoney(expensePaid)

  // Previsto no fim do mês = fechamento do fluxo de caixa (mesma projeção do relatório).
  const projectedEnd = cashFlow.closingBalance
  const monthResult = roundMoney(incomeTotal - expenseTotal)
  const settledBefore = settledOccurrencesUntil(db, prevEnd)
  const incomeUntilPrev = roundMoney(
    settledBefore
      .filter((entry) => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0),
  )
  const expenseUntilPrev = roundMoney(
    settledBefore
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0),
  )

  const previousBalance: FinancialStat = {
    label: 'Saldo do período anterior',
    value: previousBalanceValue,
    supportingText: `Consolidado em ${prevLabel}`,
    tone: 'neutral',
    breakdown: [
      { label: 'Receitas acumuladas', value: incomeUntilPrev, tone: 'positive' },
      { label: 'Despesas acumuladas', value: expenseUntilPrev, tone: 'negative' },
    ],
  }

  const revenues: FinancialStat = {
    label: 'Receitas',
    value: incomeTotal,
    supportingText: 'Total no período',
    tone: 'positive',
    breakdown: [
      { label: 'Recebido', value: incomeReceived, tone: 'positive' },
      { label: 'A receber', value: incomePending },
    ],
  }

  const expenses: FinancialStat = {
    label: 'Despesas',
    value: expenseTotal,
    supportingText: 'Total no período',
    tone: 'negative',
    breakdown: [
      { label: 'Pago', value: expensePaid },
      { label: 'A pagar', value: expensePending, tone: 'negative' },
    ],
  }

  const currentBalance: FinancialStat = {
    label: 'Saldo atual',
    value: currentBalanceValue,
    supportingText: 'Disponível em contas',
    tone: 'featured',
    breakdown: [
      { label: 'Previsto no fim do mês', value: projectedEnd },
      {
        label: 'Resultado do mês',
        value: monthResult,
        tone: monthResult >= 0 ? 'positive' : 'negative',
      },
    ],
  }

  const expenseItems: FinanceListItem[] = monthEntries
    .filter((entry) => entry.type === 'expense')
    .map((entry) => ({
      id: `pay-${entry.occurrenceKey}`,
      name: entry.description,
      category: entry.categoryName ?? 'Sem categoria',
      dateLabel: formatDayLabel(entry.date, today),
      sortDate: entry.date,
      amount: entry.amount,
      status: expenseListStatus(entry, today),
      account: entry.accountName,
      kind: 'expense' as const,
      settled: entry.settled,
      categoryIcon: entry.categoryIcon,
      categoryColor: entry.categoryColor,
      bankKey: null,
      bankColor: null,
      linkTo: null,
    }))

  const incomeItems: FinanceListItem[] = monthEntries
    .filter((entry) => entry.type === 'income')
    .map((entry) => ({
      id: `inc-${entry.occurrenceKey}`,
      name: entry.description,
      category: entry.categoryName ?? 'Sem categoria',
      dateLabel: formatDayLabel(entry.date, today),
      sortDate: entry.date,
      amount: entry.amount,
      status: incomeListStatus(entry),
      account: entry.accountName,
      kind: 'income' as const,
      settled: entry.settled,
      categoryIcon: entry.categoryIcon,
      categoryColor: entry.categoryColor,
      bankKey: null,
      bankColor: null,
      linkTo: null,
    }))

  const now = new Date()
  const updatedAt =
    monthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      ? `Hoje, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      : 'Dados do período'

  return {
    key: monthKey,
    shortLabel: `${MONTH_NAMES[month - 1]!.slice(0, 3)} ${year}`,
    fullLabel: `${MONTH_NAMES[month - 1]} de ${year}`,
    updatedAt,
    stats: {
      previousBalance,
      revenues,
      expenses,
      currentBalance,
    },
    payables: buildPayablesSection([...expenseItems, ...invoiceItems]),
    incomes: buildIncomesSection(incomeItems),
  }
}
