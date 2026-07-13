export type EntryType = 'income' | 'expense' | 'transfer'
export type EntryRecurrence = 'single' | 'installment' | 'fixed'
export type EntryStatus = 'pending' | 'received' | 'paid'
export type EntryPaymentState = 'auto' | 'paid' | 'unpaid'
export type EntrySeriesScope = 'occurrence' | 'future' | 'series'
export type TransferDirection = 'in' | 'out'

export interface Entry {
  id: number
  type: EntryType
  accountId: number
  destinationAccountId: number | null
  destinationAccountName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  description: string
  amount: number
  statementName: string | null
  notes: string | null
  recurrence: EntryRecurrence
  date: string
  endDate: string | null
  installmentCount: number | null
  installmentIndex: number | null
  groupId: string | null
  status: EntryStatus
  useMonthEnd: boolean
}

export interface EntryOccurrence extends Entry {
  parentId: number
  occurrenceKey: string
  occurrenceMonth: string
  occurrenceIndex: number
  accountName: string
  dueDate: string
  paymentState: EntryPaymentState
  paymentDate: string | null
  settled: boolean
  isException: boolean
  /** Relativo à conta da listagem (só transferências). */
  transferDirection: TransferDirection | null
}

export interface EntryPayload {
  type: EntryType
  accountId: number
  /** Obrigatório quando type = transfer (conta de destino). */
  destinationAccountId: number | null
  description: string
  amount: number
  categoryId: number | null
  statementName: string | null
  notes: string | null
  recurrence: EntryRecurrence
  /** YYYY-MM-DD — data (avulsa), 1ª parcela ou início (fixa) */
  date: string
  endDate: string | null
  installmentCount: number | null
  useMonthEnd: boolean
}

export interface EntryPaymentPayload {
  occurrenceMonth: string
  state: EntryPaymentState
  paymentDate: string | null
}

export interface EntryOccurrenceEditPayload {
  occurrenceMonth: string
  scope: EntrySeriesScope
  description: string
  amount: number
  categoryId: number | null
  statementName: string | null
  notes: string | null
  date: string
}

/** @deprecated Use EntryPayload */
export type IncomeEntryPayload = Omit<EntryPayload, 'type'> & { type?: 'income' }
