import type { AssetType } from './asset'

export interface FinancialSecurityAssetOption {
  id: number
  name: string
  type: AssetType
  balance: number
  monthlyContribution: number
  enabled: boolean
}

export interface FinancialSecurityPoint {
  month: string
  label: string
  balance: number
  monthlyCost: number
  coverageMonths: number
  kind: 'historical' | 'current' | 'projected'
}

export interface FinancialSecurityCostMonth {
  month: string
  label: string
  amount: number
}

export interface FinancialSecurityReport {
  asOf: string
  costMode: 'historical' | 'projected'
  monthlyCost: number
  automaticMonthlyCost: number
  monthlyCostOverride: number | null
  costMonths: FinancialSecurityCostMonth[]
  projectedCostMonths: FinancialSecurityCostMonth[]
  currentTotal: number
  monthlyContribution: number
  coverageMonths: number
  targetSixMonths: number
  targetTwelveMonths: number
  twelveMonthGap: number
  independenceMonth: string | null
  independenceLabel: string | null
  assets: FinancialSecurityAssetOption[]
  points: FinancialSecurityPoint[]
}
