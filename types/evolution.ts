export type EvolutionChartMode = 'flow' | 'patrimony'

export interface EvolutionMonth {
  month: string
  label: string
  income: number
  expenses: number
  balance: number
  patrimony: number
  savingsRate: number | null
  isCurrent: boolean
}

export interface EvolutionSummary {
  averageIncome: number
  averageExpenses: number
  averageBalance: number
  averageSavingsRate: number
  activeMonths: number
}

export interface EvolutionReport {
  generatedAt: string
  startMonth: string
  endMonth: string
  summary: EvolutionSummary
  months: EvolutionMonth[]
}
