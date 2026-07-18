/**
 * Contrato da fatura do cartão.
 *
 * Fase atual: detalhe com dados mockados.
 * Fase 3: plugar compras/fatura reais sem reescrever a página —
 * manter este shape (ou estender de forma compatível) em
 * GET /api/cards/:id/invoice?month=YYYY-MM.
 */

export type CardInvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue'

export interface CardInvoiceCategorySpend {
  id: string
  name: string
  color: string
  amount: number
  percent: number
}

export interface CardInvoiceEntry {
  id: string
  parentId: number
  occurrenceMonth: string
  occurrenceIndex: number
  description: string
  notes: string | null
  /** YYYY-MM-DD */
  date: string
  amount: number
  statementName: string | null
  recurrence: 'single' | 'installment' | 'fixed'
  installmentCount: number | null
  installmentIndex: number | null
  useMonthEnd: boolean
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  supercategoryId: number | null
  supercategoryName: string | null
  supercategoryColor: string | null
  supercategoryIcon: string | null
}

export interface CardInvoiceProjectionMonth {
  /** YYYY-MM */
  month: string
  shortLabel: string
  amount: number
  /** Barra clara: ≤ 15% da média ou &lt; R$ 150 */
  residual?: boolean
}

export interface CardsProjectionSummary {
  months: CardInvoiceProjectionMonth[]
  total: number
  estimatedPayoffLabel: string | null
  residualInvoicesFrom: string | null
}

export interface CardInvoiceDetail {
  cardId: number
  /** YYYY-MM — competência solicitada */
  month: string
  /** Ex.: Ago/2026 */
  monthLabel: string
  /** Ex.: Agosto de 2026 */
  fullMonthLabel: string
  status: CardInvoiceStatus
  statusLabel: string
  /** Soma dos lançamentos (sem ajuste). */
  entriesSubtotal: number
  /** Delta da fatura (+ débito, − crédito). */
  adjustment: number
  adjustmentNotes: string | null
  /** entriesSubtotal + adjustment */
  total: number
  creditLimit: number
  usedAmount: number
  availableAmount: number
  usedPercent: number
  /** Dia de FECHAMENTO da fatura (1–31). */
  closingDay: number
  /** Dia de VENCIMENTO do boleto (1–31). */
  dueDay: number
  /** Ex.: Ago/2026 — ou null se sem previsão */
  estimatedPayoffLabel: string | null
  /** Ex.: Set/2026 — ou null */
  residualInvoicesFrom: string | null
  /** Presente quando a fatura foi paga. */
  payment: CardInvoicePaymentInfo | null
  projection: CardInvoiceProjectionMonth[]
  categories: CardInvoiceCategorySpend[]
  supercategories: CardInvoiceCategorySpend[]
  entries: CardInvoiceEntry[]
}

export interface CardInvoicePaymentInfo {
  accountId: number
  accountName: string
  entryId: number
  paymentDate: string
  totalPaid: number
}

export interface CardInvoiceAdjustmentPayload {
  month: string
  amount: number
  notes: string | null
}

export interface CardInvoicePaymentPayload {
  month: string
  accountId: number
  /** YYYY-MM-DD */
  paymentDate: string
  /** Se informado, atualiza o ajuste antes de pagar. */
  adjustment: number | null
  notes: string | null
}
