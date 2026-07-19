export type GlobalLimitKind = 'fixed' | 'percentage'

export interface GlobalLimitEntry {
  id: number
  kind: GlobalLimitKind
  value: number
  effectiveFrom: string
  createdAt: string
}

export interface GlobalLimitReport {
  month: string
  active: GlobalLimitEntry | null
  history: GlobalLimitEntry[]
  /** Limite de gasto calculado para o mês (null se % e sem receita). */
  computedLimit: number | null
  expectedIncome: number
}

export type LimitScope = 'category' | 'supercategory'

export interface LimitRow {
  referenceId: number
  label: string
  color: string
  icon: string
  spent: number
  limitAmount: number | null
  limitId: number | null
  recurring: boolean
}

export interface LimitsReport {
  month: string
  fullLabel: string
  scope: LimitScope
  totalSpent: number
  totalLimited: number
  totalSpentLimited: number
  rows: LimitRow[]
}

export interface GlobalLimitPayload {
  kind: GlobalLimitKind
  value: number
  effectiveFrom: string
}

export interface LimitPayload {
  scope: LimitScope
  referenceId: number
  month: string
  amount: number
  recurring: boolean
}

export interface LimitUpdatePayload {
  amount: number
  recurring: boolean
}
