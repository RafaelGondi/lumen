export type MoneyFlowItemKind = 'income' | 'deficit' | 'expense' | 'savings'

export interface MoneyFlowItem {
  key: string
  label: string
  amount: number
  percent: number
  color: string
  icon: string
  itemCount: number
  kind: MoneyFlowItemKind
}

export interface MoneyFlowReport {
  month: string
  fullLabel: string
  incomeTotal: number
  expenseTotal: number
  netAmount: number
  savingsRate: number | null
  flowTotal: number
  incomeSources: MoneyFlowItem[]
  destinations: MoneyFlowItem[]
}
