export type CashFlowMonthKind = 'past' | 'current' | 'future'

export type CashFlowMovementType = 'income' | 'expense' | 'card_invoice'

export interface CashFlowMovement {
  id: string
  description: string
  amount: number
  /** Valor com sinal: receita +, despesa/fatura − */
  signedAmount: number
  type: CashFlowMovementType
  statusLabel: string
  accountLabel: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  /** Só em faturas de cartão. */
  bankKey: string | null
  bankName: string | null
  bankColor: string | null
}

export interface CashFlowDay {
  date: string
  day: number
  balance: number
  isToday: boolean
  isCritical: boolean
  movements: CashFlowMovement[]
}

export interface CashFlowReport {
  month: string
  fullLabel: string
  monthKind: CashFlowMonthKind
  /** Limiar de dias críticos (saldo negativo ou abaixo deste valor). */
  criticalThreshold: number
  openingBalance: number
  /** Só no mês corrente; null em passado/futuro. */
  todayBalance: number | null
  worstBalance: number
  worstDay: number
  closingBalance: number
  closingDelta: number
  days: CashFlowDay[]
}
