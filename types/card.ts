import type { BankKey } from '~/types/account'

/**
 * Credit card (cartão).
 *
 * Semântica importante de ciclo de fatura:
 * - `closingDay` = dia de FECHAMENTO da fatura (não “melhor dia para comprar”
 *   no sentido de início de ciclo). Campo legado/UI às vezes chamado
 *   “melhor data p/ compra”, mas a regra de negócio é: compras até esse dia
 *   entram na fatura que fecha nessa data. Ver `utils/cardInvoiceCycle.ts`.
 * - `dueDay` = dia de VENCIMENTO do boleto.
 */
export interface Card {
  id: number
  name: string
  bankKey: BankKey
  bankName: string
  color: string
  /** Últimos 4 dígitos do cartão (opcional). */
  lastFour: string | null
  creditLimit: number
  /** Dia de FECHAMENTO da fatura (1–31). */
  closingDay: number
  /** Dia de VENCIMENTO do boleto (1–31). */
  dueDay: number
  active: boolean
  createdAt: string
  /**
   * Limite comprometido: soma das faturas do mês corrente em diante.
   * No detalhe da fatura, o `usedAmount` do mês selecionado vem do invoice.
   */
  usedAmount: number
  /** Mês da última fatura com saldo na projeção (ex.: "Dez/2026"). */
  estimatedPayoffLabel: string | null
}

export interface CardPayload {
  name: string
  bankKey: BankKey
  bankName: string
  color: string
  lastFour: string | null
  creditLimit: number
  /** Dia de FECHAMENTO da fatura (1–31). */
  closingDay: number
  /** Dia de VENCIMENTO do boleto (1–31). */
  dueDay: number
  active?: boolean
}
