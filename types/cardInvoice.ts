/**
 * Contrato da fatura do cartão.
 *
 * Fase atual: detalhe com dados mockados.
 * Fase 3: plugar compras/fatura reais sem reescrever a página —
 * manter este shape (ou estender de forma compatível) em
 * GET /api/cards/:id/invoice?month=YYYY-MM.
 */

export type CardInvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue'

export type CardInvoiceSpendGroup = 'category' | 'supercategory' | 'recurrence'

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
  /**
   * Data da compra original, YYYY-MM-DD.
   *
   * Em parceladas difere de `date`: a parcela 2/3 de uma compra de junho é
   * cobrada em agosto, mas foi comprada em junho. É esta data que ordena a
   * lista, para a compra antiga não aparecer como a mais recente.
   */
  purchaseDate: string
  amount: number
  statementName: string | null
  recurrence: 'single' | 'installment' | 'fixed'
  endDate: string | null
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
  /**
   * Fatura já fechada, anterior ao mês de referência. Fica fora do total e do
   * cálculo de residual — é histórico para contexto, não projeção.
   */
  past?: boolean
  /**
   * Parte de `amount` já quitada (faturas com pagamento registrado). Um mês
   * pode ser parcialmente pago: são vários cartões, e cada um fecha e é pago
   * na sua própria data.
   */
  paidAmount?: number
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
  /** Créditos de cashback/pontos registrados nesta fatura. */
  rewards: CardInvoiceReward[]
  /** Soma positiva dos créditos em `rewards`. */
  rewardsTotal: number
  /** Estornos avulsos registrados diretamente na fatura. */
  credits: CardInvoiceCredit[]
  /** Soma positiva dos estornos em `credits`. */
  creditsTotal: number
  /** entriesSubtotal + adjustment - rewardsTotal - creditsTotal */
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
  recurrences: CardInvoiceCategorySpend[]
  entries: CardInvoiceEntry[]
}

export interface CardInvoiceReward {
  id: number
  program: string
  pointsUsed: number
  creditAmount: number
  /** YYYY-MM-DD */
  creditedAt: string
  notes: string | null
}

export interface CardInvoiceRewardPayload {
  month: string
  program: string
  pointsUsed: number
  creditAmount: number
  /** YYYY-MM-DD */
  creditedAt: string
  notes: string | null
}

export interface CardInvoiceCredit {
  id: number
  description: string
  creditAmount: number
  /** YYYY-MM-DD */
  creditedAt: string
  notes: string | null
}

export interface CardInvoiceCreditPayload {
  month: string
  description: string
  creditAmount: number
  /** YYYY-MM-DD */
  creditedAt: string
  notes: string | null
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
  /** Cotação em BRL por USD, exigida quando o cartão acumula por dólar. */
  rewardCurrencyRate: number | null
  notes: string | null
}
