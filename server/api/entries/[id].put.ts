import { randomUUID } from 'node:crypto'
import type { EntryOccurrenceEditPayload } from '~/types/entry'
import {
  addMonthsScheduled,
  monthEndLocal,
  roundMoney,
} from '~/utils/dateMoney'
import { occurrenceByKey } from '../../utils/occurrences'

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

function monthIndex(month: string) {
  const [year, value] = month.split('-').map(Number)
  return year! * 12 + value! - 1
}

function monthFromIndex(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<EntryOccurrenceEditPayload>(event)

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
  }
  if (!/^\d{4}-\d{2}$/.test(body.occurrenceMonth ?? '')) {
    throw createError({ statusCode: 400, statusMessage: 'Competência inválida.' })
  }
  if (!['occurrence', 'future', 'series'].includes(body.scope)) {
    throw createError({ statusCode: 400, statusMessage: 'Escopo inválido.' })
  }
  if (
    !body.description?.trim() ||
    body.description.trim().length > 120 ||
    typeof body.amount !== 'number' ||
    !Number.isFinite(body.amount) ||
    body.amount <= 0 ||
    !validDate(body.date)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  }

  const db = useDb()
  const parent = db
    .prepare(
      `SELECT
         id,
         type,
         account_id AS accountId,
         category_id AS categoryId,
         description,
         amount,
         statement_name AS statementName,
         notes,
         recurrence,
         date,
         end_date AS endDate,
         installment_count AS installmentCount,
         group_id AS groupId,
         status,
         created_at AS createdAt,
         payment_state AS paymentState,
         payment_date AS paymentDate,
         month_end AS useMonthEnd
       FROM entries
       WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number
        type: 'income' | 'expense'
        accountId: number
        categoryId: number | null
        description: string
        amount: number
        statementName: string | null
        notes: string | null
        recurrence: 'single' | 'installment' | 'fixed'
        date: string
        endDate: string | null
        installmentCount: number | null
        groupId: string | null
        status: string
        createdAt: string
        paymentState: string
        paymentDate: string | null
        useMonthEnd: number
      }
    | undefined

  const occurrence = parent
    ? occurrenceByKey(db, id, body.occurrenceMonth)
    : null
  if (!parent || !occurrence) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ocorrência não encontrada.',
    })
  }

  if (body.categoryId !== null) {
    const category = db
      .prepare('SELECT id FROM categories WHERE id = ? AND type = ?')
      .get(body.categoryId, parent.type)
    if (!category) {
      throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
    }
  }

  const values = {
    description: body.description.trim(),
    amount: roundMoney(body.amount),
    categoryId: body.categoryId,
    statementName: body.statementName?.trim() || null,
    notes: body.notes?.trim() || null,
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
     WHERE id = @id`,
  )

  const edit = db.transaction(() => {
    if (parent.recurrence === 'single') {
      updateParent.run({
        ...values,
        id,
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
        id,
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

    const originalSpan =
      parent.endDate
        ? monthIndex(parent.endDate.slice(0, 7)) -
          monthIndex(parent.date.slice(0, 7))
        : null
    const seriesStartDate = parent.useMonthEnd
      ? monthEndLocal(values.date)
      : values.date

    if (body.scope === 'series' || occurrence.occurrenceIndex === 1) {
      const endDate =
        parent.recurrence === 'installment'
          ? addMonthsScheduled(
              seriesStartDate,
              (parent.installmentCount ?? 1) - 1,
              Boolean(parent.useMonthEnd),
            )
          : originalSpan === null
            ? null
            : addMonthsScheduled(
                seriesStartDate,
                originalSpan,
                Boolean(parent.useMonthEnd),
              )
      const oldStartIndex = monthIndex(parent.date.slice(0, 7))
      const newStartIndex = monthIndex(seriesStartDate.slice(0, 7))
      if (oldStartIndex !== newStartIndex) {
        const payments = db
          .prepare(
            `SELECT occurrence_month AS occurrenceMonth, state,
                    payment_date AS paymentDate, created_at AS createdAt,
                    updated_at AS updatedAt
             FROM entry_occurrence_payments
             WHERE entry_id = ?`,
          )
          .all(id) as {
          occurrenceMonth: string
          state: string
          paymentDate: string | null
          createdAt: string
          updatedAt: string
        }[]
        db.prepare(
          'DELETE FROM entry_occurrence_payments WHERE entry_id = ?',
        ).run(id)
        const insertPayment = db.prepare(
          `INSERT INTO entry_occurrence_payments (
             entry_id, occurrence_month, state, payment_date,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        for (const payment of payments) {
          const offset = monthIndex(payment.occurrenceMonth) - oldStartIndex
          insertPayment.run(
            id,
            monthFromIndex(newStartIndex + offset),
            payment.state,
            payment.paymentDate,
            payment.createdAt,
            payment.updatedAt,
          )
        }
      }

      updateParent.run({
        ...values,
        date: seriesStartDate,
        id,
        endDate,
        installmentCount: parent.installmentCount,
      })
      db.prepare(
        'DELETE FROM entry_occurrence_exceptions WHERE entry_id = ?',
      ).run(id)
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
       WHERE id = ?`,
    ).run(oldEndDate, keptCount, id)

    const result = db.prepare(
      `INSERT INTO entries (
         type, account_id, category_id, description, amount,
         statement_name, notes, recurrence, date, end_date,
         installment_count, installment_index, group_id, status, created_at,
         payment_state, payment_date, month_end
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending', ?,
                 'auto', NULL, ?)`,
    ).run(
      parent.type,
      parent.accountId,
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

    const payments = db
      .prepare(
        `SELECT occurrence_month AS occurrenceMonth, state,
                payment_date AS paymentDate, created_at AS createdAt,
                updated_at AS updatedAt
         FROM entry_occurrence_payments
         WHERE entry_id = ? AND occurrence_month >= ?`,
      )
      .all(id, body.occurrenceMonth) as {
      occurrenceMonth: string
      state: string
      paymentDate: string | null
      createdAt: string
      updatedAt: string
    }[]
    const exceptions = db
      .prepare(
        `SELECT occurrence_month AS occurrenceMonth, action,
                due_date AS dueDate, amount, description,
                category_id AS categoryId, statement_name AS statementName,
                notes, created_at AS createdAt
         FROM entry_occurrence_exceptions
         WHERE entry_id = ? AND occurrence_month > ?`,
      )
      .all(id, body.occurrenceMonth) as {
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
      'DELETE FROM entry_occurrence_payments WHERE entry_id = ? AND occurrence_month >= ?',
    ).run(id, body.occurrenceMonth)
    db.prepare(
      'DELETE FROM entry_occurrence_exceptions WHERE entry_id = ? AND occurrence_month >= ?',
    ).run(id, body.occurrenceMonth)

    const insertPayment = db.prepare(
      `INSERT INTO entry_occurrence_payments (
         entry_id, occurrence_month, state, payment_date, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (const payment of payments) {
      const offset = monthIndex(payment.occurrenceMonth) - oldStartIndex
      insertPayment.run(
        newId,
        monthFromIndex(newStartIndex + offset),
        payment.state,
        payment.paymentDate,
        payment.createdAt,
        payment.updatedAt,
      )
    }

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
  })

  edit()
  return {
    ok: true,
    balance: accountBalance(db, parent.accountId),
  }
})
