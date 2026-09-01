import type Database from 'better-sqlite3'
import type { EntryOccurrence } from '~/types/entry'
import type {
  MonthlyResultIncomeRow,
  MonthlyResultReport,
  MonthlyResultScope,
} from '~/types/monthlyResult'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { buildCategorySpendReport } from './categorySpendReport'
import { occurrencesForCompetenceMonth } from './occurrences'

const FALLBACK_INCOME_COLOR = '#3c8866'
const FALLBACK_INCOME_ICON = 'wallet-cards'

type IncomeGroup = Omit<MonthlyResultIncomeRow, 'percent'>

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function incomeGroupKey(item: EntryOccurrence) {
  if (item.categoryId !== null) return `category:${item.categoryId}`
  return `description:${item.description.trim().toLocaleLowerCase('pt-BR')}`
}

function incomeRowsForMonth(db: Database.Database, month: string) {
  const groups = new Map<string, IncomeGroup>()
  const occurrences = occurrencesForCompetenceMonth(db, month).filter(
    (item) => item.type === 'income',
  )

  for (const item of occurrences) {
    const key = incomeGroupKey(item)
    const current = groups.get(key)
    if (current) {
      current.amount = roundMoney(current.amount + item.amount)
      current.itemCount += 1
      continue
    }

    groups.set(key, {
      key,
      label: item.categoryName ?? item.description,
      color: item.categoryColor ?? FALLBACK_INCOME_COLOR,
      icon: item.categoryIcon ?? FALLBACK_INCOME_ICON,
      amount: roundMoney(item.amount),
      itemCount: 1,
    })
  }

  const total = roundMoney(
    [...groups.values()].reduce((sum, item) => sum + item.amount, 0),
  )
  const rows: MonthlyResultIncomeRow[] = [...groups.values()].map((item) => ({
    ...item,
    percent: total > 0 ? roundPercent((item.amount / total) * 100) : 0,
  }))
  rows.sort(
    (a, b) =>
      b.amount - a.amount ||
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }),
  )

  return { total, rows }
}

function monthTotals(db: Database.Database, month: string) {
  const income = incomeRowsForMonth(db, month)
  const expenses = buildCategorySpendReport(
    db,
    month,
    'category',
    'competence',
  ).monthTotal
  return {
    incomeTotal: income.total,
    expenseTotal: expenses,
    result: roundMoney(income.total - expenses),
  }
}

export function buildMonthlyResultReport(
  db: Database.Database,
  month: string,
  scope: MonthlyResultScope,
): MonthlyResultReport {
  const expenses = buildCategorySpendReport(db, month, scope, 'competence')
  const recurrence = buildCategorySpendReport(
    db,
    month,
    'recurrence',
    'competence',
  )
  const income = incomeRowsForMonth(db, month)
  const result = roundMoney(income.total - expenses.monthTotal)
  const previousMonth = addMonthsLocal(`${month}-01`, -1).slice(0, 7)
  const previous = monthTotals(db, previousMonth)

  return {
    month,
    fullLabel: expenses.fullLabel,
    scope,
    incomeTotal: income.total,
    expenseTotal: expenses.monthTotal,
    result,
    margin:
      income.total > 0 ? roundPercent((result / income.total) * 100) : null,
    incomeRows: income.rows,
    expenses,
    recurrence,
    comparison: {
      month: previousMonth,
      fullLabel: buildCategorySpendReport(
        db,
        previousMonth,
        'category',
        'competence',
      ).fullLabel,
      ...previous,
      incomeChange: roundMoney(income.total - previous.incomeTotal),
      expenseChange: roundMoney(expenses.monthTotal - previous.expenseTotal),
      resultChange: roundMoney(result - previous.result),
    },
  }
}
