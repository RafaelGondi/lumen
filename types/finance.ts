export type MonthKey = string

export type TransactionStatus =
  | 'paid'
  | 'pending'
  | 'overdue'
  | 'scheduled'
  | 'received'

export type FinanceListKind = 'expense' | 'income' | 'card_invoice'

export interface MoneyBreakdown {
  label: string
  value: number
  tone?: 'default' | 'positive' | 'negative'
}

export interface FinancialStat {
  label: string
  value: number
  supportingText: string
  tone: 'neutral' | 'positive' | 'negative' | 'featured'
  breakdown: MoneyBreakdown[]
}

export interface FinanceListItem {
  id: string
  name: string
  category: string
  dateLabel: string
  /** YYYY-MM-DD para ordenação */
  sortDate: string
  amount: number
  status: TransactionStatus
  account: string
  kind: FinanceListKind
  settled: boolean
  categoryIcon: string | null
  categoryColor: string | null
  /** Presente em faturas de cartão. */
  bankKey: string | null
  bankColor: string | null
  /** Atalho opcional (ex.: fatura → página do cartão). */
  linkTo: string | null
}

export interface FinanceListGroup {
  key: string
  label: string
  total: number
  items: FinanceListItem[]
}

export interface FinanceListSectionData {
  groups: FinanceListGroup[]
  total: number
  itemCount: number
}

export interface DashboardMonth {
  key: MonthKey
  shortLabel: string
  fullLabel: string
  updatedAt: string
  stats: {
    previousBalance: FinancialStat
    revenues: FinancialStat
    expenses: FinancialStat
    currentBalance: FinancialStat
  }
  payables: FinanceListSectionData
  incomes: FinanceListSectionData
}
