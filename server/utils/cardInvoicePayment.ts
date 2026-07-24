import type Database from 'better-sqlite3'
import { roundMoney } from '~/utils/dateMoney'

export type CardInvoicePayment = {
  id: number
  cardId: number
  invoiceMonth: string
  accountId: number
  entryId: number
  entriesSubtotal: number
  adjustment: number
  totalPaid: number
  paymentDate: string
  notes: string | null
}

export function loadCardInvoicePayment(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
): CardInvoicePayment | null {
  const row = db
    .prepare(
      `SELECT
         id,
         card_id AS cardId,
         invoice_month AS invoiceMonth,
         account_id AS accountId,
         entry_id AS entryId,
         entries_subtotal AS entriesSubtotal,
         adjustment,
         total_paid AS totalPaid,
         payment_date AS paymentDate,
         notes
       FROM card_invoice_payments
       WHERE card_id = ?
         AND invoice_month = ?`,
    )
    .get(cardId, invoiceMonth) as CardInvoicePayment | undefined

  if (!row) return null
  return {
    ...row,
    entriesSubtotal: roundMoney(row.entriesSubtotal),
    adjustment: roundMoney(row.adjustment),
    totalPaid: roundMoney(row.totalPaid),
  }
}

/** Mapa `YYYY-MM` → pagamento para um cartão. */
export function loadCardInvoicePaymentsMap(
  db: Database.Database,
  cardId: number,
): Map<string, CardInvoicePayment> {
  const rows = db
    .prepare(
      `SELECT
         id,
         card_id AS cardId,
         invoice_month AS invoiceMonth,
         account_id AS accountId,
         entry_id AS entryId,
         entries_subtotal AS entriesSubtotal,
         adjustment,
         total_paid AS totalPaid,
         payment_date AS paymentDate,
         notes
       FROM card_invoice_payments
       WHERE card_id = ?`,
    )
    .all(cardId) as CardInvoicePayment[]

  return new Map(
    rows.map((row) => [
      row.invoiceMonth,
      {
        ...row,
        entriesSubtotal: roundMoney(row.entriesSubtotal),
        adjustment: roundMoney(row.adjustment),
        totalPaid: roundMoney(row.totalPaid),
      },
    ]),
  )
}

/** Mapa `cardId:YYYY-MM` → valor pago. */
export function loadPaidTotalsForCards(
  db: Database.Database,
  cardIds: number[],
): Map<string, number> {
  if (!cardIds.length) return new Map()
  const placeholders = cardIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT card_id AS cardId, invoice_month AS invoiceMonth, total_paid AS totalPaid
       FROM card_invoice_payments
       WHERE card_id IN (${placeholders})`,
    )
    .all(...cardIds) as { cardId: number; invoiceMonth: string; totalPaid: number }[]

  return new Map(
    rows.map((row) => [
      `${row.cardId}:${row.invoiceMonth}`,
      roundMoney(row.totalPaid),
    ]),
  )
}

export function insertCardInvoicePayment(
  db: Database.Database,
  payment: Omit<CardInvoicePayment, 'id'>,
) {
  const now = todayLocal()
  const result = db
    .prepare(
      `INSERT INTO card_invoice_payments (
         card_id, invoice_month, account_id, entry_id,
         entries_subtotal, adjustment, total_paid, payment_date,
         notes, created_at, updated_at
       ) VALUES (
         @cardId, @invoiceMonth, @accountId, @entryId,
         @entriesSubtotal, @adjustment, @totalPaid, @paymentDate,
         @notes, @createdAt, @updatedAt
       )`,
    )
    .run({
      cardId: payment.cardId,
      invoiceMonth: payment.invoiceMonth,
      accountId: payment.accountId,
      entryId: payment.entryId,
      entriesSubtotal: payment.entriesSubtotal,
      adjustment: payment.adjustment,
      totalPaid: payment.totalPaid,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      createdAt: now,
      updatedAt: now,
    })

  return Number(result.lastInsertRowid)
}
