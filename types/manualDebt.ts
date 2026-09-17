export interface ManualDebt {
  id: number
  name: string
  creditor: string | null
  currentBalance: number
  startDate: string
  targetDate: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  notes: string | null
  enabled: boolean
}

export interface ManualDebtPayload {
  name: string
  creditor: string | null
  currentBalance: number
  startDate: string
  targetDate: string | null
  categoryId: number | null
  notes: string | null
}

export interface ManualDebtPaymentPayload {
  amount: number
  paymentDate: string
  accountId: number | null
  notes: string | null
}
