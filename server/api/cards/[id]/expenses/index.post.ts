import { randomUUID } from 'node:crypto'
import { addMonthsScheduled, monthEndLocal } from '~/utils/dateMoney'
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import { parseCardExpensePayload } from '../../../../utils/cardExpensePayload'

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parseCardExpensePayload(await readBody(event))
  const db = useDb()

  const card = db
    .prepare('SELECT id, closing_day AS closingDay FROM cards WHERE id = ?')
    .get(cardId) as { id: number; closingDay: number } | undefined
  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  if (payload.categoryId !== null) {
    const category = db
      .prepare(`SELECT id FROM categories WHERE id = ? AND type = 'expense'`)
      .get(payload.categoryId)
    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Categoria de despesa inválida.',
      })
    }
  }

  const startDate = payload.useMonthEnd
    ? monthEndLocal(payload.date)
    : payload.date
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
         type, account_id, card_id, category_id, description, amount,
         statement_name, notes, recurrence, date, end_date,
         installment_count, installment_index, group_id, status, created_at,
         payment_state, payment_date, month_end
       ) VALUES (
         'expense', NULL, @cardId, @categoryId, @description, @amount,
         @statementName, @notes, @recurrence, @date, @endDate,
         @installmentCount, NULL, @groupId, 'pending', @createdAt,
         'auto', NULL, @monthEnd
       )`,
    )
    .run({
      cardId,
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
      createdAt: todayLocal(),
      monthEnd: payload.useMonthEnd ? 1 : 0,
    })

  setResponseStatus(event, 201)
  return {
    id: Number(result.lastInsertRowid),
    invoiceMonth: transacaoFaturaMonth(startDate, card.closingDay),
  }
})

