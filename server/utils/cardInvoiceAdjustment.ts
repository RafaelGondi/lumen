import type Database from 'better-sqlite3'
import { roundMoney } from '~/utils/dateMoney'

export type CardInvoiceAdjustment = {
  cardId: number
  invoiceMonth: string
  amount: number
  notes: string | null
}

export function loadCardInvoiceAdjustment(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
): CardInvoiceAdjustment | null {
  const row = db
    .prepare(
      `SELECT
         card_id AS cardId,
         invoice_month AS invoiceMonth,
         amount,
         notes
       FROM card_invoice_adjustments
       WHERE card_id = ?
         AND invoice_month = ?`,
    )
    .get(cardId, invoiceMonth) as CardInvoiceAdjustment | undefined

  return row
    ? { ...row, amount: roundMoney(row.amount) }
    : null
}

/** Mapa `YYYY-MM` → valor do ajuste para um cartão. */
export function loadCardInvoiceAdjustmentsMap(
  db: Database.Database,
  cardId: number,
): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT invoice_month AS invoiceMonth, amount
       FROM card_invoice_adjustments
       WHERE card_id = ?`,
    )
    .all(cardId) as { invoiceMonth: string; amount: number }[]

  return new Map(
    rows.map((row) => [row.invoiceMonth, roundMoney(row.amount)]),
  )
}

/** Mapa `cardId:YYYY-MM` → valor do ajuste. */
export function loadAdjustmentsForCards(
  db: Database.Database,
  cardIds: number[],
): Map<string, number> {
  if (!cardIds.length) return new Map()
  const placeholders = cardIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT
         card_id AS cardId,
         invoice_month AS invoiceMonth,
         amount
       FROM card_invoice_adjustments
       WHERE card_id IN (${placeholders})`,
    )
    .all(...cardIds) as {
    cardId: number
    invoiceMonth: string
    amount: number
  }[]

  return new Map(
    rows.map((row) => [
      `${row.cardId}:${row.invoiceMonth}`,
      roundMoney(row.amount),
    ]),
  )
}

export function upsertCardInvoiceAdjustment(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
  amount: number,
  notes: string | null,
) {
  const now = todayLocal()
  const rounded = roundMoney(amount)

  if (rounded === 0) {
    removeCardInvoiceAdjustment(db, cardId, invoiceMonth)
    return null
  }

  db.prepare(
    `INSERT INTO card_invoice_adjustments (
       card_id, invoice_month, amount, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id, invoice_month) DO UPDATE SET
       amount = excluded.amount,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).run(cardId, invoiceMonth, rounded, notes, now, now)

  return loadCardInvoiceAdjustment(db, cardId, invoiceMonth)
}

export function removeCardInvoiceAdjustment(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
) {
  db.prepare(
    `DELETE FROM card_invoice_adjustments
     WHERE card_id = ?
       AND invoice_month = ?`,
  ).run(cardId, invoiceMonth)
}
