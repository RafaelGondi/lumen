export type AssetType =
  | 'fgts'
  | 'investment'
  | 'reserve'
  | 'property'
  | 'vehicle'
  | 'other'

export type AssetMovementKind =
  | 'contribution'
  | 'yield'
  | 'withdrawal'
  | 'adjustment_credit'
  | 'adjustment_debit'
  | 'balance_confirmation'

export interface AssetMovementPayload {
  kind: AssetMovementKind
  amount: number
  movementDate: string
  scheduledDate: string | null
  notes: string | null
}

export interface AssetPayload {
  type: AssetType
  name: string
  currentBalance: number
  monthlyContribution: number
  annualYieldRate: number
  balanceDate: string
  notes: string | null
}

export interface Asset extends AssetPayload {
  id: number
  hasMovements: boolean
  estimatedCurrentBalance: number
  accruedContributions: number
  accruedEarnings: number
  elapsedMonths: number
  projectedBalance: number
}

export interface AssetProjectionPoint {
  month: string
  label: string
  balance: number
  contributed: number
  earnings: number
}

export interface AssetProjectionReport {
  asOf: string
  months: number
  registeredTotal: number
  currentTotal: number
  accruedContributions: number
  accruedEarnings: number
  monthlyContribution: number
  projectedTotal: number
  projectedContributions: number
  projectedEarnings: number
  assets: Asset[]
  points: AssetProjectionPoint[]
}

export interface AssetStatementEntry {
  id: number | null
  key: string
  kind: AssetMovementKind | 'initial_balance'
  label: string
  movementDate: string
  scheduledDate: string | null
  amount: number
  effect: number
  balance: number
  status: 'confirmed' | 'estimated'
  source: 'initial' | 'automatic' | 'manual'
  notes: string | null
}

export interface AssetStatement {
  asset: Asset
  asOf: string
  entries: AssetStatementEntry[]
}
