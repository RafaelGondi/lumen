import { addMonthsScheduled } from '~/utils/dateMoney'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import { parseExpenseId } from '../../../../utils/cardExpensePayload'
import { cardExpenseOccurrenceByKey } from '../../../../utils/cardExpenses'

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const expenseId = parseExpenseId(getRouterParam(event, 'expenseId'))
  const query = getQuery(event)
  const scope =
    query.scope === 'future' || query.scope === 'series'
      ? query.scope
      : 'occurrence'
  const occurrenceMonth =
    typeof query.occurrenceMonth === 'string' ? query.occurrenceMonth : ''
  const db = useDb()

  const parent = db
    .prepare(
      `SELECT
         recurrence,
         date,
         installment_count AS installmentCount,
         month_end AS useMonthEnd
       FROM entries
       WHERE id = ?
         AND card_id = ?
         AND account_id IS NULL
         AND type = 'expense'`,
    )
    .get(expenseId, cardId) as
    | {
        recurrence: 'single' | 'installment' | 'fixed'
        date: string
        installmentCount: number | null
        useMonthEnd: number
      }
    | undefined
  if (!parent) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Despesa não encontrada.',
    })
  }

  if (
    parent.recurrence !== 'single' &&
    scope !== 'series' &&
    !/^\d{4}-\d{2}$/.test(occurrenceMonth)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe a competência da ocorrência.',
    })
  }

  db.transaction(() => {
    if (parent.recurrence === 'single' || scope === 'series') {
      db.prepare(
        'DELETE FROM entries WHERE id = ? AND card_id = ?',
      ).run(expenseId, cardId)
      return
    }

    const occurrence = cardExpenseOccurrenceByKey(
      db,
      cardId,
      expenseId,
      occurrenceMonth,
    )
    if (!occurrence) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Ocorrência não encontrada.',
      })
    }

    if (scope === 'occurrence') {
      db.prepare(
        `INSERT INTO entry_occurrence_exceptions (
           entry_id, occurrence_month, action, created_at
         ) VALUES (?, ?, 'exclude', ?)
         ON CONFLICT(entry_id, occurrence_month) DO UPDATE SET
           action = 'exclude',
           due_date = NULL,
           amount = NULL,
           description = NULL,
           category_id = NULL,
           statement_name = NULL,
           notes = NULL`,
      ).run(expenseId, occurrenceMonth, todayLocal())
      return
    }

    const keptCount = occurrence.occurrenceIndex - 1
    if (keptCount <= 0) {
      db.prepare(
        'DELETE FROM entries WHERE id = ? AND card_id = ?',
      ).run(expenseId, cardId)
      return
    }
    const previousDate = addMonthsScheduled(
      parent.date,
      keptCount - 1,
      Boolean(parent.useMonthEnd),
    )
    db.prepare(
      `UPDATE entries
       SET end_date = ?,
           installment_count = CASE
             WHEN recurrence = 'installment' THEN ?
             ELSE installment_count
           END
       WHERE id = ? AND card_id = ?`,
    ).run(previousDate, keptCount, expenseId, cardId)
    db.prepare(
      `DELETE FROM entry_occurrence_exceptions
       WHERE entry_id = ? AND occurrence_month >= ?`,
    ).run(expenseId, occurrenceMonth)
  })()

  return { ok: true }
})

