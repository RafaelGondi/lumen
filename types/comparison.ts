import type { SpendingGuardBreakdownItem } from '~/types/spendingGuard'

export type ComparisonScope = 'category' | 'supercategory'

export interface ComparisonRow {
  key: string
  referenceId: number | string
  label: string
  color: string
  icon: string
  baseAmount: number
  compareAmount: number
  difference: number
  percentChange: number | null
  comparable: boolean
  baseItems: SpendingGuardBreakdownItem[]
  compareItems: SpendingGuardBreakdownItem[]
}

export interface ComparisonReport {
  baseMonth: string
  baseLabel: string
  compareMonth: string
  compareLabel: string
  scope: ComparisonScope
  baseTotal: number
  compareTotal: number
  difference: number
  percentChange: number | null
  rows: ComparisonRow[]
}
