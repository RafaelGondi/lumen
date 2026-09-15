export type CardRewardDestination = 'invoice' | 'account'
export type CardRewardEarningBasis = 'brl' | 'usd'

export interface CardRewardAccrual {
  id: number
  invoiceMonth: string
  paymentId: number
  eligibleAmount: number
  earningBasis: CardRewardEarningBasis
  pointsPerUnit: number
  currencyRate: number | null
  pointsEarned: number
  createdAt: string
}

export interface CardRewardAdjustment {
  id: number
  pointsDelta: number
  /** YYYY-MM-DD */
  adjustedAt: string
  reason: string
  createdAt: string
}

export interface CardRewardRedemption {
  id: number
  destination: CardRewardDestination
  invoiceMonth: string | null
  invoiceRewardId: number | null
  accountId: number | null
  accountName: string | null
  entryId: number | null
  pointsUsed: number
  cashAmount: number
  /** YYYY-MM-DD */
  redeemedAt: string
  notes: string | null
}

export interface CardRewardProgram {
  id: number
  cardId: number
  name: string
  pointsBalance: number
  valuePerThousand: number
  earningBasis: CardRewardEarningBasis
  pointsPerUnit: number
  projectionCurrencyRate: number | null
  equivalentBalance: number
  defaultDestination: CardRewardDestination
  accruals: CardRewardAccrual[]
  adjustments: CardRewardAdjustment[]
  redemptions: CardRewardRedemption[]
}

export interface CardRewardAdjustmentPayload {
  pointsDelta: number
  adjustedAt: string
  reason: string
}

export interface CardRewardProgramPayload {
  name: string
  pointsBalance: number
  valuePerThousand: number
  earningBasis: CardRewardEarningBasis
  pointsPerUnit: number
  projectionCurrencyRate: number | null
  defaultDestination: CardRewardDestination
}

export interface CardRewardProjectionPoint {
  month: string
  monthLabel: string
  eligibleAmount: number
  projectedPoints: number
  projectedBalance: number
}

export interface CardRewardProjection {
  months: number
  earningBasis: CardRewardEarningBasis
  currencyRate: number | null
  currentBalance: number
  totalProjectedPoints: number
  projectedBalance: number
  points: CardRewardProjectionPoint[]
}

export interface CardRewardRedemptionPayload {
  destination: CardRewardDestination
  pointsUsed: number
  /** YYYY-MM-DD */
  redeemedAt: string
  invoiceMonth: string | null
  accountId: number | null
  notes: string | null
}
