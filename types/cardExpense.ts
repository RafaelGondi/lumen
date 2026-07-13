import type {
  EntryRecurrence,
  EntrySeriesScope,
} from '~/types/entry'

export interface CardExpensePayload {
  description: string
  amount: number
  categoryId: number | null
  statementName: string | null
  notes: string | null
  recurrence: EntryRecurrence
  /** Compra avulsa, primeira parcela ou início da recorrência. */
  date: string
  endDate: string | null
  installmentCount: number | null
  useMonthEnd: boolean
}

export interface CardExpenseEditPayload {
  occurrenceMonth: string
  scope: EntrySeriesScope
  description: string
  amount: number
  categoryId: number | null
  statementName: string | null
  notes: string | null
  date: string
  /** Total de parcelas da série; só aplica em escopo series/future. */
  installmentCount: number | null
}

export interface CardExpenseOccurrence {
  id: number
  parentId: number
  occurrenceKey: string
  /** Competência mensal da ocorrência dentro da série, não da fatura. */
  occurrenceMonth: string
  occurrenceIndex: number
  cardId: number
  description: string
  amount: number
  date: string
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  statementName: string | null
  notes: string | null
  recurrence: EntryRecurrence
  endDate: string | null
  installmentCount: number | null
  installmentIndex: number | null
  useMonthEnd: boolean
  isException: boolean
}

