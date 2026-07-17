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
