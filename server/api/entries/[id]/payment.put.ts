import type { EntryPaymentPayload } from '~/types/entry'
import { occurrenceByKey } from '../../../utils/occurrences'

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month! - 1 &&
    probe.getDate() === day
  )
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<EntryPaymentPayload>(event)

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
  }
  if (!/^\d{4}-\d{2}$/.test(body.occurrenceMonth ?? '')) {
    throw createError({ statusCode: 400, statusMessage: 'Competência inválida.' })
  }
  if (!['auto', 'paid', 'unpaid'].includes(body.state)) {
    throw createError({ statusCode: 400, statusMessage: 'Estado inválido.' })
  }
  if (body.state === 'paid' && !validDate(body.paymentDate)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe a data do pagamento ou recebimento.',
    })
  }

  const db = useDb()
  const parent = db
    .prepare(
      `SELECT
         account_id AS accountId,
         recurrence,
         type
       FROM entries
       WHERE id = ?`,
    )
    .get(id) as
    | {
        accountId: number
        recurrence: 'single' | 'installment' | 'fixed'
        type: 'income' | 'expense' | 'transfer'
      }
    | undefined

  if (!parent || !occurrenceByKey(db, id, body.occurrenceMonth)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ocorrência não encontrada.',
    })
  }

  const now = todayLocal()
  if (parent.recurrence === 'single') {
    const status =
      body.state === 'paid'
        ? parent.type === 'income'
          ? 'received'
          : 'paid'
        : 'pending'
    db.prepare(
      `UPDATE entries
       SET payment_state = ?, payment_date = ?, status = ?
       WHERE id = ?`,
    ).run(
      body.state,
      body.state === 'paid' ? body.paymentDate : null,
      status,
      id,
    )
  } else if (body.state === 'auto') {
    db.prepare(
      `DELETE FROM entry_occurrence_payments
       WHERE entry_id = ? AND occurrence_month = ?`,
    ).run(id, body.occurrenceMonth)
  } else {
    db.prepare(
      `INSERT INTO entry_occurrence_payments (
         entry_id, occurrence_month, state, payment_date, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(entry_id, occurrence_month) DO UPDATE SET
         state = excluded.state,
         payment_date = excluded.payment_date,
         updated_at = excluded.updated_at`,
    ).run(
      id,
      body.occurrenceMonth,
      body.state,
      body.state === 'paid' ? body.paymentDate : null,
      now,
      now,
    )
  }

  return {
    ok: true,
    balance: accountBalance(db, parent.accountId),
  }
})
