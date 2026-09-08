import type Database from 'better-sqlite3'
import type { CardInvoiceReward } from '~/types/cardInvoice'
import { roundMoney } from '~/utils/dateMoney'

type RewardRow = CardInvoiceReward & {
  cardId: number
  invoiceMonth: string
}

export function loadCardInvoiceRewards(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
): CardInvoiceReward[] {
  const rows = db
    .prepare(
      `SELECT
         id,
         card_id AS cardId,
         invoice_month AS invoiceMonth,
         program,
         points_used AS pointsUsed,
         credit_amount AS creditAmount,
         credited_at AS creditedAt,
         notes
       FROM card_invoice_rewards
       WHERE card_id = ? AND invoice_month = ?
       ORDER BY credited_at DESC, id DESC`,
    )
    .all(cardId, invoiceMonth) as RewardRow[]

  return rows.map(({ cardId: _cardId, invoiceMonth: _month, ...row }) => ({
    ...row,
    creditAmount: roundMoney(row.creditAmount),
  }))
}

/** Mapa `YYYY-MM` → total de cashback/pontos de um cartão. */
export function loadCardInvoiceRewardsMap(
  db: Database.Database,
  cardId: number,
): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT invoice_month AS invoiceMonth, SUM(credit_amount) AS total
       FROM card_invoice_rewards
       WHERE card_id = ?
       GROUP BY invoice_month`,
    )
    .all(cardId) as { invoiceMonth: string; total: number }[]

  return new Map(
    rows.map((row) => [row.invoiceMonth, roundMoney(row.total)]),
  )
}

/** Mapa `cardId:YYYY-MM` → total de cashback/pontos. */
export function loadRewardsForCards(
  db: Database.Database,
  cardIds: number[],
): Map<string, number> {
  if (!cardIds.length) return new Map()
  const placeholders = cardIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT card_id AS cardId, invoice_month AS invoiceMonth,
              SUM(credit_amount) AS total
       FROM card_invoice_rewards
       WHERE card_id IN (${placeholders})
       GROUP BY card_id, invoice_month`,
    )
    .all(...cardIds) as {
    cardId: number
    invoiceMonth: string
    total: number
  }[]

  return new Map(
    rows.map((row) => [
      `${row.cardId}:${row.invoiceMonth}`,
      roundMoney(row.total),
    ]),
  )
}
