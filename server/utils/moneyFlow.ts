import type Database from 'better-sqlite3'
import type { Card } from '~/types/card'
import type { CashFlowMovement } from '~/types/cashFlow'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import type { MoneyFlowItem, MoneyFlowReport } from '~/types/moneyFlow'
import { roundMoney } from '~/utils/dateMoney'
import { buildCardInvoice } from './cardInvoice'
import { buildCashFlowReport } from './cashFlow'
import { occurrencesForCashMonth } from './occurrences'

const MAX_INCOME_SOURCES = 3
const MAX_DESTINATIONS = 5
const FALLBACK_INCOME_COLOR = '#3c8866'
const OTHER_COLOR = '#7b8780'
const DEFICIT_COLOR = '#b85c58'
const SAVINGS_COLOR = '#3c8866'

type IncomeGroup = {
  key: string
  label: string
  amount: number
  color: string
  icon: string
  itemCount: number
}

type ExpenseGroup = IncomeGroup

type CardRow = Omit<Card, 'active' | 'usedAmount' | 'estimatedPayoffLabel'> & {
  active: number
}

function roundPercent(amount: number, total: number) {
  return total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
}

function incomeSources(movements: CashFlowMovement[]) {
  const groups = new Map<string, IncomeGroup>()
  const income = movements.filter(
    (item) => item.type === 'income',
  )

  for (const item of income) {
    const key = item.categoryName
      ? `category:${item.categoryName}`
      : `description:${item.description.trim().toLocaleLowerCase('pt-BR')}`
    const current = groups.get(key)
    if (current) {
      current.amount = roundMoney(current.amount + item.amount)
      current.itemCount += 1
      continue
    }

    groups.set(key, {
      key,
      label: item.categoryName ?? item.description,
      amount: item.amount,
      color: item.categoryColor ?? FALLBACK_INCOME_COLOR,
      icon: item.categoryIcon ?? 'wallet-cards',
      itemCount: 1,
    })
  }

  const total = roundMoney(
    [...groups.values()].reduce((sum, item) => sum + item.amount, 0),
  )
  const sorted = [...groups.values()].sort(
    (a, b) =>
      b.amount - a.amount ||
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }),
  )
  const visible = sorted.slice(0, MAX_INCOME_SOURCES)
  const hidden = sorted.slice(MAX_INCOME_SOURCES)
  const rows = visible.map<MoneyFlowItem>((item) => ({
    ...item,
    percent: roundPercent(item.amount, total),
    kind: 'income',
  }))

  if (hidden.length) {
    const amount = roundMoney(
      hidden.reduce((sum, item) => sum + item.amount, 0),
    )
    rows.push({
      key: 'income:other',
      label: `Outras receitas (${hidden.length})`,
      amount,
      percent: roundPercent(amount, total),
      color: OTHER_COLOR,
      icon: 'ellipsis',
      itemCount: hidden.reduce((sum, item) => sum + item.itemCount, 0),
      kind: 'income',
    })
  }

  return { total, rows }
}

function compactDestinations(rows: ExpenseGroup[], total: number) {
  const visible = rows.slice(0, MAX_DESTINATIONS)
  const hidden = rows.slice(MAX_DESTINATIONS)
  const result: MoneyFlowItem[] = visible.map((row) => ({
    key: `expense:${row.key}`,
    label: row.label,
    amount: row.amount,
    percent: roundPercent(row.amount, total),
    color: row.color,
    icon: row.icon,
    itemCount: row.itemCount,
    kind: 'expense',
  }))

  if (hidden.length) {
    const amount = roundMoney(
      hidden.reduce((sum, row) => sum + row.amount, 0),
    )
    result.push({
      key: 'expense:other',
      label: `Outros (${hidden.length})`,
      amount,
      percent: roundPercent(amount, total),
      color: OTHER_COLOR,
      icon: 'ellipsis',
      itemCount: hidden.reduce((sum, row) => sum + row.itemCount, 0),
      kind: 'expense',
    })
  }

  return result
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

function addExpense(
  groups: Map<string, ExpenseGroup>,
  item: ExpenseGroup,
) {
  if (item.amount <= 0) return
  const current = groups.get(item.key)
  if (current) {
    current.amount = roundMoney(current.amount + item.amount)
    current.itemCount += item.itemCount
    return
  }
  groups.set(item.key, { ...item })
}

function addInvoiceGroups(
  groups: Map<string, ExpenseGroup>,
  invoice: CardInvoiceDetail,
) {
  if (invoice.total <= 0) return
  const entriesTotal = invoice.entries.reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )

  if (entriesTotal <= 0) {
    addExpense(groups, {
      key: 'invoice-adjustment',
      label: 'Ajustes de fatura',
      amount: invoice.total,
      color: OTHER_COLOR,
      icon: 'receipt',
      itemCount: 1,
    })
    return
  }

  const scale = invoice.total / entriesTotal
  const invoiceGroups = new Map<string, ExpenseGroup>()
  for (const entry of invoice.entries) {
    const key = `supercategory:${entry.supercategoryId ?? 0}`
    addExpense(invoiceGroups, {
      key,
      label: entry.supercategoryName ?? 'Sem supercategoria',
      amount: entry.amount,
      color: entry.supercategoryColor ?? '#94a3b8',
      icon: entry.supercategoryIcon ?? 'folder-tree',
      itemCount: 1,
    })
  }

  const invoiceRows = [...invoiceGroups.values()]
  let allocated = 0
  invoiceRows.forEach((row, index) => {
    const amount =
      index === invoiceRows.length - 1
        ? roundMoney(invoice.total - allocated)
        : roundMoney(row.amount * scale)
    allocated = roundMoney(allocated + amount)
    addExpense(groups, { ...row, amount })
  })
}

function cashDestinations(
  db: Database.Database,
  month: string,
  movements: CashFlowMovement[],
) {
  const groups = new Map<string, ExpenseGroup>()
  const supercategories = new Map(
    (
      db
        .prepare(
          `SELECT
             c.id AS categoryId,
             s.id AS supercategoryId,
             s.name AS supercategoryName,
             s.color AS supercategoryColor,
             s.icon AS supercategoryIcon
           FROM categories c
           LEFT JOIN supercategories s ON s.id = c.supercategory_id
           WHERE c.type = 'expense'`,
        )
        .all() as {
        categoryId: number
        supercategoryId: number | null
        supercategoryName: string | null
        supercategoryColor: string | null
        supercategoryIcon: string | null
      }[]
    ).map((item) => [item.categoryId, item]),
  )
  const occurrences = new Map(
    occurrencesForCashMonth(db, month).map((item) => [item.occurrenceKey, item]),
  )
  const invoicePaymentMovementIds = new Set<string>()
  const invoiceMovementIds = new Set(
    movements
      .filter((item) => item.type === 'card_invoice')
      .map((item) => item.id),
  )

  for (const card of loadActiveCards(db)) {
    const invoice = buildCardInvoice(db, card, month)
    const openMovementId = `card-invoice:${card.id}:${month}`
    const paidEntryId = invoice.payment?.entryId
    const paidMovement =
      paidEntryId === undefined
        ? null
        : movements.find(
            (item) =>
              item.id === String(paidEntryId) ||
              item.id.startsWith(`${paidEntryId}:`),
          )

    if (paidMovement) invoicePaymentMovementIds.add(paidMovement.id)
    if (paidMovement || invoiceMovementIds.has(openMovementId)) {
      addInvoiceGroups(groups, invoice)
    }
  }

  for (const movement of movements) {
    if (
      movement.type !== 'expense' ||
      invoicePaymentMovementIds.has(movement.id)
    ) {
      continue
    }
    const occurrence = occurrences.get(movement.id)
    const supercategory = occurrence?.categoryId
      ? supercategories.get(occurrence.categoryId)
      : null
    const key = `supercategory:${supercategory?.supercategoryId ?? 0}`
    addExpense(groups, {
      key,
      label: supercategory?.supercategoryName ?? 'Sem supercategoria',
      amount: movement.amount,
      color: supercategory?.supercategoryColor ?? '#94a3b8',
      icon: supercategory?.supercategoryIcon ?? 'folder-tree',
      itemCount: 1,
    })
  }

  return [...groups.values()].sort(
    (a, b) =>
      b.amount - a.amount ||
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }),
  )
}

export function buildMoneyFlowReport(
  db: Database.Database,
  month: string,
): MoneyFlowReport {
  const cashFlow = buildCashFlowReport(db, month)
  const movements = cashFlow.days.flatMap((day) => day.movements)
  const income = incomeSources(movements)
  const expenseRows = cashDestinations(db, month, movements)
  const expenseTotal = roundMoney(
    expenseRows.reduce((sum, row) => sum + row.amount, 0),
  )
  const netAmount = roundMoney(income.total - expenseTotal)
  const flowTotal = Math.max(income.total, expenseTotal)
  const sources = [...income.rows]
  const destinations = compactDestinations(expenseRows, flowTotal)

  if (netAmount < 0) {
    sources.push({
      key: 'deficit',
      label: 'Déficit no mês',
      amount: Math.abs(netAmount),
      percent: roundPercent(Math.abs(netAmount), flowTotal),
      color: DEFICIT_COLOR,
      icon: 'triangle-alert',
      itemCount: 1,
      kind: 'deficit',
    })
  } else if (netAmount > 0) {
    destinations.unshift({
      key: 'savings',
      label: 'Economia',
      amount: netAmount,
      percent: roundPercent(netAmount, flowTotal),
      color: SAVINGS_COLOR,
      icon: 'piggy-bank',
      itemCount: 1,
      kind: 'savings',
    })
  }

  return {
    month,
    fullLabel: cashFlow.fullLabel,
    incomeTotal: income.total,
    expenseTotal,
    netAmount,
    savingsRate:
      income.total > 0
        ? Math.round((netAmount / income.total) * 1000) / 10
        : null,
    flowTotal,
    incomeSources: sources,
    destinations,
  }
}
