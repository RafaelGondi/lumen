import type { BankKey } from './account'
import type { ManualDebt } from './manualDebt'

export interface DebtSourceOption {
  entryId: number
  description: string
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  recurrence: 'single' | 'installment' | 'fixed'
  amount: number
  startDate: string
  endDate: string | null
  installmentCount: number | null
  enabled: boolean
  suggested: boolean
}

export interface DebtCardSourceOption {
  cardId: number
  name: string
  bankKey: BankKey
  bankName: string
  color: string
  enabled: boolean
}

export interface DebtEvolutionPoint {
  key: string
  month: string
  label: string
  balance: number
  kind: 'actual' | 'projected'
}

export interface DebtEvolutionItem {
  id: string
  name: string
  support: string
  type: 'card' | 'entry' | 'manual'
  balance: number
  percent: number
  payoffMonth: string | null
  bankKey: BankKey | null
  color: string
  categoryIcon: string | null
}

export interface DebtMonthlyImpactItem {
  id: string
  name: string
  amount: number
  type: 'card' | 'entry' | 'manual'
  color: string
}

export interface DebtMonthlyImpact {
  month: string
  label: string
  total: number
  items: DebtMonthlyImpactItem[]
}

export interface DebtCashProjectionPoint {
  month: string
  label: string
  balance: number
}

export interface DebtEvolutionReport {
  asOf: string
  currentTotal: number
  dueThisMonth: number
  reductionThisMonth: number
  estimatedPayoffMonth: string | null
  estimatedPayoffLabel: string | null
  historyStarted: boolean
  points: DebtEvolutionPoint[]
  monthlyImpacts: DebtMonthlyImpact[]
  cashProjection: DebtCashProjectionPoint[]
  breakEvenMonth: string | null
  breakEvenLabel: string | null
  hasOpenEndedDebt: boolean
  composition: DebtEvolutionItem[]
  sources: DebtSourceOption[]
  cards: DebtCardSourceOption[]
  manualDebts: ManualDebt[]
}
