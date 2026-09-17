import { parseManualDebtPaymentPayload } from '../../../utils/manualDebtPayload'
import { roundMoney } from '~/utils/dateMoney'
import { todayLocal } from '../../../utils/db'

type DebtRow = {
  id: number
  name: string
  currentBalance: number
  categoryId: number | null
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida inválida.' })
  }
  const payload = parseManualDebtPaymentPayload(await readBody(event))
  if (payload.paymentDate > todayLocal()) {
    throw createError({ statusCode: 400, statusMessage: 'A data do pagamento não pode estar no futuro.' })
  }
  const db = useDb()
  if (payload.accountId !== null) {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(payload.accountId)
    if (!account) {
      throw createError({ statusCode: 400, statusMessage: 'Conta inválida.' })
    }
  }

  const now = new Date().toISOString()
  const save = db.transaction(() => {
    const debt = db.prepare(
      `SELECT id, name, current_balance AS currentBalance,
              category_id AS categoryId
       FROM manual_debts WHERE id = ? AND active = 1`,
    ).get(id) as DebtRow | undefined
    if (!debt) {
      throw createError({ statusCode: 404, statusMessage: 'Dívida não encontrada.' })
    }
    if (payload.amount > debt.currentBalance + 0.005) {
      throw createError({
        statusCode: 400,
        statusMessage: 'O pagamento não pode superar o saldo da dívida.',
      })
    }

    const nextBalance = roundMoney(Math.max(0, debt.currentBalance - payload.amount))
    let entryId: number | null = null
    if (payload.accountId !== null) {
      const result = db.prepare(
        `INSERT INTO entries (
           type, account_id, destination_account_id, card_id, category_id,
           description, amount, statement_name, notes, recurrence, date,
           end_date, installment_count, installment_index, group_id, status,
           created_at, payment_state, payment_date, month_end, track_as_debt
         ) VALUES (
           'expense', ?, NULL, NULL, ?, ?, ?, NULL, ?, 'single', ?,
           NULL, NULL, NULL, NULL, ?, ?, 'auto', NULL, 0, 0
         )`,
      ).run(
        payload.accountId,
        debt.categoryId,
        `Pagamento de dívida — ${debt.name}`,
        payload.amount,
        payload.notes,
        payload.paymentDate,
        'paid',
        now,
      )
      entryId = Number(result.lastInsertRowid)
    }

    db.prepare(
      `INSERT INTO manual_debt_payments (
         debt_id, amount, payment_date, account_id, entry_id, notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      payload.amount,
      payload.paymentDate,
      payload.accountId,
      entryId,
      payload.notes,
      now,
    )
    db.prepare(
      `UPDATE manual_debts
       SET current_balance = ?, active = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextBalance, nextBalance > 0 ? 1 : 0, now, id)
    return { entryId, nextBalance }
  })

  const { entryId, nextBalance } = save()
  setResponseStatus(event, 201)
  return { debtId: id, currentBalance: nextBalance, entryId }
})
