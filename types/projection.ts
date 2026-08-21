export type ProjectionSnapshotKind = 'auto' | 'manual'
export type ProjectionBalanceMode = 'best' | 'worst'

export interface ProjectionPoint {
  month: string
  label: string
  /** Saldo de fechamento, mantido para compatibilidade com snapshots antigos. */
  balance: number
  bestBalance?: number
  worstBalance?: number
}
export interface ProjectionSnapshot {
  id: number
  label: string
  kind: ProjectionSnapshotKind
  snapshotMonth: string
  horizonMonths: number
  points: ProjectionPoint[]
  createdAt: string
  /** Snapshots anteriores ao seletor guardavam apenas o fechamento mensal. */
  hasMonthlyExtremes: boolean
}

export interface ProjectionReport {
  generatedAt: string
  horizonMonths: number
  currentBalance: number
  points: ProjectionPoint[]
  snapshots: ProjectionSnapshot[]
}
