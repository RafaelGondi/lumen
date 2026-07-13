import { randomUUID } from 'node:crypto'
import {
  addMonthsScheduled,
  monthEndLocal,
} from '~/utils/dateMoney'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import {
  parseCardExpenseEditPayload,
  parseExpenseId,
} from '../../../../utils/cardExpensePayload'
import { cardExpenseOccurrenceByKey } from '../../../../utils/cardExpenses'

function monthIndex(month: string) {
  const [year, value] = month.split('-').map(Number)
  return year! * 12 + value! - 1
}

function monthFromIndex(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const expenseId = parseExpenseId(getRouterParam(event, 'expenseId'))
  const body = parseCardExpenseEditPayload(await readBody(event))
  const db = useDb()

  const parent = db
    .prepare(
      `SELECT
         id,
         card_id AS cardId,
         category_id AS categoryId,
         description,
         amount,
         statement_name AS statementName,
         notes,
         recurrence,
         date,
         end_date AS endDate,
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
        id: number
        cardId: number
        categoryId: number | null
        description: string
        amount: number
        statementName: string | null
        notes: string | null
        recurrence: 'single' | 'installment' | 'fixed'
        date: string
        endDate: string | null
        installmentCount: number | null
        useMonthEnd: number
      }
    | undefined

  const occurrence = parent
    ? cardExpenseOccurrenceByKey(
        db,
        cardId,
        expenseId,
        body.occurrenceMonth,
      )
    : null
  if (!parent || !occurrence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ocorrência da despesa não encontrada.',
    })
  }

  if (body.categoryId !== null) {
    const category = db
      .prepare(`SELECT id FROM categories WHERE id = ? AND type = 'expense'`)
      .get(body.categoryId)
    if (!category) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Categoria de despesa inválida.',
      })
    }
  }

  const values = {
    description: body.description,
    amount: body.amount,
    categoryId: body.categoryId,
    statementName: body.statementName,
    notes: body.notes,
    date: body.date,
  }
  const updateParent = db.prepare(
    `UPDATE entries
     SET description = @description,
         amount = @amount,
         category_id = @categoryId,
         statement_name = @statementName,
         notes = @notes,
         date = @date,
         end_date = @endDate,
         installment_count = @installmentCount
     WHERE id = @id AND card_id = @cardId`,
  )

  db.transaction(() => {
    if (parent.recurrence === 'single') {
      updateParent.run({
        ...values,
        id: expenseId,
        cardId,
        endDate: null,
        installmentCount: null,
      })
      return
    }

    if (body.scope === 'occurrence') {
      db.prepare(
        `INSERT INTO entry_occurrence_exceptions (
           entry_id, occurrence_month, action, due_date, amount,
           description, category_id, statement_name, notes, created_at
         ) VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entry_id, occurrence_month) DO UPDATE SET
           action = 'edit',
           due_date = excluded.due_date,
           amount = excluded.amount,
           description = excluded.description,
           category_id = excluded.category_id,
           statement_name = excluded.statement_name,
           notes = excluded.notes`,
      ).run(
        expenseId,
        body.occurrenceMonth,
        values.date,
        values.amount,
        values.description,
        values.categoryId,
        values.statementName,
        values.notes,
        todayLocal(),
      )
      return
    }

    const seriesStartDate = parent.useMonthEnd
      ? monthEndLocal(values.date)
      : values.date
    const originalSpan = parent.endDate
      ? monthIndex(parent.endDate.slice(0, 7)) -
        monthIndex(parent.date.slice(0, 7))
      : null

    if (body.scope === 'series' || occurrence.occurrenceIndex === 1) {
      const installmentCount =
        parent.recurrence === 'installment'
          ? (body.installmentCount ?? parent.installmentCount)
          : parent.installmentCount
      // Só a 1ª parcela pode reposicionar o início da série pela data do form.
      const seriesAnchor =
        occurrence.occurrenceIndex === 1
          ? seriesStartDate
          : parent.useMonthEnd
            ? monthEndLocal(parent.date)
            : parent.date
      const endDate =
        parent.recurrence === 'installment'
          ? addMonthsScheduled(
              seriesAnchor,
              (installmentCount ?? 1) - 1,
              Boolean(parent.useMonthEnd),
            )
          : originalSpan === null
            ? null
            : addMonthsScheduled(
                seriesAnchor,
                originalSpan,
                Boolean(parent.useMonthEnd),
              )

      updateParent.run({
        ...values,
        date: seriesAnchor,
        id: expenseId,
        cardId,
        endDate,
        installmentCount,
      })
      db.prepare(
        'DELETE FROM entry_occurrence_exceptions WHERE entry_id = ?',
      ).run(expenseId)
      return
    }

    const keptCount = occurrence.occurrenceIndex - 1
    const remainingCount =
      parent.recurrence === 'installment'
        ? (parent.installmentCount ?? occurrence.occurrenceIndex) - keptCount
        : null
    const oldEndDate = addMonthsScheduled(
      parent.date,
      keptCount - 1,
      Boolean(parent.useMonthEnd),
    )
    const newEndDate =
      parent.recurrence === 'installment'
        ? addMonthsScheduled(
            seriesStartDate,
            (remainingCount ?? 1) - 1,
            Boolean(parent.useMonthEnd),
          )
        : parent.endDate

    db.prepare(
      `UPDATE entries
       SET end_date = ?,
           installment_count = CASE
             WHEN recurrence = 'installment' THEN ?
             ELSE installment_count
           END
       WHERE id = ? AND card_id = ?`,
    ).run(oldEndDate, keptCount, expenseId, cardId)

    const result = db
      .prepare(
        `INSERT INTO entries (
           type, account_id, card_id, category_id, description, amount,
           statement_name, notes, recurrence, date, end_date,
           installment_count, installment_index, group_id, status, created_at,
           payment_state, payment_date, month_end
         ) VALUES (
           'expense', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?,
           'pending', ?, 'auto', NULL, ?
         )`,
      )
      .run(
        cardId,
        values.categoryId,
        values.description,
        values.amount,
        values.statementName,
        values.notes,
        parent.recurrence,
        seriesStartDate,
        newEndDate,
        remainingCount,
        randomUUID(),
        todayLocal(),
        parent.useMonthEnd,
      )
    const newId = Number(result.lastInsertRowid)
    const oldStartIndex = monthIndex(body.occurrenceMonth)
    const newStartIndex = monthIndex(seriesStartDate.slice(0, 7))

    const exceptions = db
      .prepare(
        `SELECT
           occurrence_month AS occurrenceMonth,
           action,
           due_date AS dueDate,
           amount,
           description,
           category_id AS categoryId,
           statement_name AS statementName,
           notes,
           created_at AS createdAt
         FROM entry_occurrence_exceptions
         WHERE entry_id = ? AND occurrence_month > ?`,
      )
      .all(expenseId, body.occurrenceMonth) as {
      occurrenceMonth: string
      action: string
      dueDate: string | null
      amount: number | null
      description: string | null
      categoryId: number | null
      statementName: string | null
      notes: string | null
      createdAt: string
    }[]

    db.prepare(
      `DELETE FROM entry_occurrence_exceptions
       WHERE entry_id = ? AND occurrence_month >= ?`,
    ).run(expenseId, body.occurrenceMonth)
    const insertException = db.prepare(
      `INSERT INTO entry_occurrence_exceptions (
         entry_id, occurrence_month, action, due_date, amount,
         description, category_id, statement_name, notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const exception of exceptions) {
      const offset = monthIndex(exception.occurrenceMonth) - oldStartIndex
      insertException.run(
        newId,
        monthFromIndex(newStartIndex + offset),
        exception.action,
        exception.dueDate,
        exception.amount,
        exception.description,
        exception.categoryId,
        exception.statementName,
        exception.notes,
        exception.createdAt,
      )
    }
  })()

  return { ok: true }
})

