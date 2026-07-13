import { addMonthsScheduled } from '~/utils/dateMoney'
import { occurrenceByKey } from '../../utils/occurrences'

export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const scope =
    query.scope === 'future' || query.scope === 'series'
      ? query.scope
      : 'occurrence'
  const occurrenceMonth =
    typeof query.occurrenceMonth === 'string' ? query.occurrenceMonth : ''

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificador inválido.',
    })
  }

  const db = useDb()
  const row = db
    .prepare(
      `SELECT
         account_id AS accountId,
         recurrence,
         date,
         installment_count AS installmentCount,
         month_end AS useMonthEnd
       FROM entries
       WHERE id = ?`,
    )
    .get(id) as
    | {
        accountId: number
        recurrence: 'single' | 'installment' | 'fixed'
        date: string
        installmentCount: number | null
        useMonthEnd: number
      }
    | undefined

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Lançamento não encontrado.',
    })
  }

  if (
    row.recurrence !== 'single' &&
    scope !== 'series' &&
    !/^\d{4}-\d{2}$/.test(occurrenceMonth)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe a competência da ocorrência.',
    })
  }

  const remove = db.transaction(() => {
    if (row.recurrence === 'single' || scope === 'series') {
      db.prepare('DELETE FROM entries WHERE id = ?').run(id)
      return
    }

    const occurrence = occurrenceByKey(db, id, occurrenceMonth)
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
      ).run(id, occurrenceMonth, todayLocal())
      db.prepare(
        `DELETE FROM entry_occurrence_payments
         WHERE entry_id = ? AND occurrence_month = ?`,
      ).run(id, occurrenceMonth)
      return
    }

    const keptCount = occurrence.occurrenceIndex - 1
    if (keptCount <= 0) {
      db.prepare('DELETE FROM entries WHERE id = ?').run(id)
      return
    }

    const previousDate = addMonthsScheduled(
      row.date,
      keptCount - 1,
      Boolean(row.useMonthEnd),
    )
    db.prepare(
      `UPDATE entries
       SET end_date = ?,
           installment_count = CASE
             WHEN recurrence = 'installment' THEN ?
             ELSE installment_count
           END
       WHERE id = ?`,
    ).run(previousDate, keptCount, id)
    db.prepare(
      `DELETE FROM entry_occurrence_payments
       WHERE entry_id = ? AND occurrence_month >= ?`,
    ).run(id, occurrenceMonth)
    db.prepare(
      `DELETE FROM entry_occurrence_exceptions
       WHERE entry_id = ? AND occurrence_month >= ?`,
    ).run(id, occurrenceMonth)
  })

  remove()

  return {
    ok: true,
    balance: accountBalance(db, row.accountId),
  }
})
