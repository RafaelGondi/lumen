import type { BankKey } from '~/types/account'

/**
 * Credit card (cartão).
 *
 * Semântica importante de ciclo de fatura:
 * - `closingDay` = dia da virada da fatura. Uma compra feita nesse próprio
 *   dia já pertence ao novo ciclo (é também a melhor data para comprar).
 *   Ver `utils/cardInvoiceCycle.ts`.
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
  /** Dia da virada da fatura; o próprio dia já abre o novo ciclo (1–31). */
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
  /** Dia da virada da fatura; o próprio dia já abre o novo ciclo (1–31). */
  closingDay: number
  /** Dia de VENCIMENTO do boleto (1–31). */
  dueDay: number
  active?: boolean
}
