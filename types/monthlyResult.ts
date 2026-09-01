import type {
  CategorySpendReport,
  CategorySpendScope,
} from './categorySpendReport'

export type MonthlyResultScope = CategorySpendScope

export interface MonthlyResultIncomeRow {
  key: string
  label: string
  color: string
  icon: string
  amount: number
  percent: number
  itemCount: number
}

export interface MonthlyResultComparison {
  month: string
  fullLabel: string
  incomeTotal: number
  expenseTotal: number
  result: number
  incomeChange: number
  expenseChange: number
  resultChange: number
}

export interface MonthlyResultReport {
  month: string
  fullLabel: string
  scope: MonthlyResultScope
  incomeTotal: number
  expenseTotal: number
  result: number
  margin: number | null
  incomeRows: MonthlyResultIncomeRow[]
  expenses: CategorySpendReport
  recurrence: CategorySpendReport
  comparison: MonthlyResultComparison
}
