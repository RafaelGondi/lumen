export type SpendingGuardStatus =
  | 'no-income'
  | 'healthy'
  | 'attention'
  | 'critical'
  | 'exceeded'

export type SpendingGuardPace =
  | 'below'
  | 'on-track'
  | 'slightly-above'
  | 'above'

export type SpendingGuardMonthKind = 'past' | 'current' | 'future'

export interface SpendingGuardSourceTotals {
  account: number
  card: number
}

export interface SpendingGuardCardDeferred {
  amount: number
  /** Ex.: Ago/2026 — fatura onde a compra aparece se ≠ mês do radar. */
  invoiceMonthLabel: string | null
}

export interface SpendingGuardBreakdownItem {
  id: string
  description: string
  amount: number
  date: string
  source: 'account' | 'card'
  sourceLabel: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  /** Preenchido quando a compra cai na fatura de outro mês. */
  invoiceMonthLabel: string | null
}

export interface SpendingGuardBreakdownGroup {
  key: string
  label: string
  color: string | null
  icon: string | null
  total: number
  items: SpendingGuardBreakdownItem[]
}

/**
 * Radar mensal por competência: compras contam na data em que acontecem,
 * independentemente do fechamento ou vencimento da fatura.
 */
export interface SpendingGuardReport {
  month: string
  fullLabel: string
  monthKind: SpendingGuardMonthKind
  asOf: string | null
  day: number
  daysInMonth: number
  daysRemaining: number
  savingsTargetPercent: number
  spendingLimitPercent: number
  expectedIncome: number
  savingsGoal: number
  spendingLimit: number
  spentToDate: number
  futureCommitted: number
  committedTotal: number
  remainingToLimit: number
  availableAfterCommitments: number
  dailyAvailable: number
  /** Gasto ÷ receita × 100 (bullet chart). */
  spentOfIncomePercent: number
  /** Limite ÷ receita × 100 (marcador do bullet). */
  limitOfIncomePercent: number
  /** (Receita − gasto) ÷ receita × 100. */
  actualSavingsPercent: number | null
  /** Compras no cartão contadas aqui, mas na fatura de outro mês. */
  cardDeferred: SpendingGuardCardDeferred
  spentBreakdown: SpendingGuardBreakdownGroup[]
  futureBreakdown: SpendingGuardBreakdownGroup[]
  spentPercent: number
  committedPercent: number
  elapsedPercent: number
  expectedSpendToDate: number
  paceDeltaPercent: number
  status: SpendingGuardStatus
  pace: SpendingGuardPace
  sourceTotals: SpendingGuardSourceTotals
  committedSourceTotals: SpendingGuardSourceTotals
  itemCountToDate: number
}
