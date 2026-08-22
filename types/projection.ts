export type ProjectionSnapshotKind = 'auto' | 'manual'
export type ProjectionBalanceMode = 'best' | 'worst'
export type ProjectionScenarioChangeType =
  | 'income'
  | 'expense'
  | 'reduction'
  | 'installment'

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

export interface ProjectionScenarioItem {
  id: number
  type: ProjectionScenarioChangeType
  amount: number
  startMonth: string
  day: number
  durationMonths: number | null
}

export interface ProjectionScenarioItemPayload {
  type: ProjectionScenarioChangeType
  amount: number
  startMonth: string
  day: number
  durationMonths: number | null
}

export interface ProjectionScenarioPayload {
  name: string
  items: ProjectionScenarioItemPayload[]
}

export interface ProjectionScenario {
  id: number
  name: string
  items: ProjectionScenarioItem[]
  points: ProjectionPoint[]
  createdAt: string
  updatedAt: string
}

export interface ProjectionReport {
  generatedAt: string
  horizonMonths: number
  currentBalance: number
  points: ProjectionPoint[]
  snapshots: ProjectionSnapshot[]
  scenarios: ProjectionScenario[]
}
