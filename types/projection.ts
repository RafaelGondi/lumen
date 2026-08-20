export type ProjectionSnapshotKind = 'auto' | 'manual'

export interface ProjectionPoint {
  month: string
  label: string
  balance: number
}
export interface ProjectionSnapshot {
  id: number
  label: string
  kind: ProjectionSnapshotKind
  snapshotMonth: string
  horizonMonths: number
  points: ProjectionPoint[]
  createdAt: string
}

export interface ProjectionReport {
  generatedAt: string
  horizonMonths: number
  currentBalance: number
  points: ProjectionPoint[]
  snapshots: ProjectionSnapshot[]
}
