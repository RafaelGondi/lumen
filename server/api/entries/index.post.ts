import { randomUUID } from 'node:crypto'
import { parseEntryPayload } from '../../utils/entryPayload'
import { addMonthsScheduled, monthEndLocal } from '~/utils/dateMoney'

export default defineEventHandler(async (event) => {
  const payload = parseEntryPayload(await readBody(event))
  const db = useDb()

  const account = db
    .prepare('SELECT id FROM accounts WHERE id = ?')
    .get(payload.accountId)

  if (!account) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conta não encontrada.',
    })
  }

  if (payload.type === 'transfer') {
    const destination = db
      .prepare('SELECT id FROM accounts WHERE id = ?')
      .get(payload.destinationAccountId)
    if (!destination) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Conta de destino inválida.',
      })
    }
  }

  if (payload.categoryId !== null) {
    const category = db
      .prepare(`SELECT id FROM categories WHERE id = ? AND type = ?`)
      .get(payload.categoryId, payload.type)

    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage:
          payload.type === 'expense'
            ? 'Categoria de despesa inválida.'
            : payload.type === 'transfer'
              ? 'Categoria de transferência inválida.'
              : 'Categoria de receita inválida.',
      })
    }
  }

  const startDate = payload.useMonthEnd
    ? monthEndLocal(payload.date)
    : payload.date
  const settledStatus =
    startDate <= todayLocal()
      ? payload.type === 'income'
        ? 'received'
        : 'paid'
      : 'pending'
  const createdAt = todayLocal()
  const endDate =
    payload.recurrence === 'installment'
      ? addMonthsScheduled(
          startDate,
          payload.installmentCount! - 1,
          payload.useMonthEnd,
        )
      : payload.recurrence === 'fixed'
        ? payload.endDate
        : null
  const result = db
    .prepare(
      `INSERT INTO entries (
         type, account_id, destination_account_id, category_id, description,
         amount, statement_name, notes, recurrence, date, end_date,
         installment_count, installment_index, group_id, status, created_at,
         payment_state, payment_date, month_end
       ) VALUES (
         @type, @accountId, @destinationAccountId, @categoryId, @description,
         @amount, @statementName, @notes, @recurrence, @date, @endDate,
         @installmentCount, NULL, @groupId, @status, @createdAt,
         'auto', NULL, @monthEnd
       )`,
    )
    .run({
      type: payload.type,
      accountId: payload.accountId,
      destinationAccountId: payload.destinationAccountId,
      categoryId: payload.categoryId,
      description: payload.description,
      amount: payload.amount,
      statementName: payload.statementName,
      notes: payload.notes,
      recurrence: payload.recurrence,
      date: startDate,
      endDate,
      installmentCount:
        payload.recurrence === 'installment'
          ? payload.installmentCount
          : null,
      groupId: payload.recurrence === 'single' ? null : randomUUID(),
      status: settledStatus,
      createdAt,
      monthEnd: payload.useMonthEnd ? 1 : 0,
    })

  const id = Number(result.lastInsertRowid)
  setResponseStatus(event, 201)

  return {
    id,
    ids: [id],
    balance: accountBalance(db, payload.accountId),
  }
})
