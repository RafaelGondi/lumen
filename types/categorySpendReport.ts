import type {
  SpendingGuardBreakdownGroup,
  SpendingGuardSourceTotals,
} from '~/types/spendingGuard'

export type CategorySpendScope = 'category' | 'supercategory'

export interface CategorySpendRow {
  referenceId: number
  label: string
  color: string
  icon: string
  amount: number
  percent: number
  itemCount: number
  sourceTotals: SpendingGuardSourceTotals
  breakdown: SpendingGuardBreakdownGroup
}

export interface CategorySpendReport {
  month: string
  fullLabel: string
  scope: CategorySpendScope
  monthTotal: number
  sourceTotals: SpendingGuardSourceTotals
  topReferenceId: number | null
  rows: CategorySpendRow[]
}
