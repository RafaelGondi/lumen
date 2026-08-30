import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const apply = process.argv.includes('--apply')
const dbPath = '.data/lumen.sqlite3'
const marker = 'Ajuste técnico do ciclo em 29/08/2026.'

const singleAdjustments = [
  {
    id: 62,
    description: 'Livro - Meditações de Marco Aurélio',
    originalDate: '2026-06-12',
    adjustedDate: '2026-06-11',
  },
  {
    id: 63,
    description: 'Livro - Dao de Jing',
    originalDate: '2026-06-12',
    adjustedDate: '2026-06-11',
  },
  {
    id: 205,
    description: 'Livro - Dao de Jing',
    originalDate: '2026-07-12',
    adjustedDate: '2026-07-11',
  },
  {
    id: 206,
    description: 'Livro - Meditações de Marco Aurélio',
    originalDate: '2026-07-12',
    adjustedDate: '2026-07-11',
  },
]

const installmentAdjustments = [
  {
    entryId: 134,
    occurrenceMonth: '2026-07',
    originalDate: '2026-07-25',
    adjustedDate: '2026-07-24',
  },
  {
    entryId: 134,
    occurrenceMonth: '2026-08',
    originalDate: '2026-08-25',
    adjustedDate: '2026-08-24',
  },
  {
    entryId: 134,
    occurrenceMonth: '2026-09',
    originalDate: '2026-09-25',
    adjustedDate: '2026-09-24',
  },
  {
    entryId: 134,
    occurrenceMonth: '2026-10',
    originalDate: '2026-10-25',
    adjustedDate: '2026-10-24',
  },
]

function formatDateBr(date) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function auditNote(existing, originalDate) {
  const note = `${marker} Data original: ${formatDateBr(originalDate)}. Data antecipada em um dia para preservar a competência histórica da fatura após a correção da regra de fechamento.`
  if (!existing?.trim()) return note
  if (existing.includes(marker)) return existing
  return `${existing.trim()}\n\n${note}`
}

function fail(message) {
  throw new Error(`Migração abortada: ${message}`)
}

const db = new Database(dbPath, { readonly: !apply, fileMustExist: true })
db.pragma('foreign_keys = ON')

try {
  const planned = []

  for (const adjustment of singleAdjustments) {
    const row = db
      .prepare(
        `SELECT id, card_id AS cardId, description, date, recurrence, notes
         FROM entries WHERE id = ?`,
      )
      .get(adjustment.id)

    if (!row) fail(`lançamento ${adjustment.id} não encontrado`)
    if (row.cardId !== 8) fail(`lançamento ${adjustment.id} não pertence ao cartão Amazon`)
    if (row.description !== adjustment.description) {
      fail(`descrição inesperada no lançamento ${adjustment.id}`)
    }
    if (row.recurrence !== 'single') {
      fail(`lançamento ${adjustment.id} deixou de ser avulso`)
    }

    const alreadyApplied =
      row.date === adjustment.adjustedDate && row.notes?.includes(marker)
    if (!alreadyApplied && row.date !== adjustment.originalDate) {
      fail(`data inesperada no lançamento ${adjustment.id}: ${row.date}`)
    }

    planned.push({
      kind: 'single',
      id: adjustment.id,
      description: row.description,
      from: row.date,
      to: adjustment.adjustedDate,
      alreadyApplied,
      notes: auditNote(row.notes, adjustment.originalDate),
    })
  }

  const parent = db
    .prepare(
      `SELECT id, card_id AS cardId, category_id AS categoryId, description,
              amount, statement_name AS statementName, notes, recurrence,
              date, end_date AS endDate, installment_count AS installmentCount
       FROM entries WHERE id = 134`,
    )
    .get()

  if (!parent) fail('parcelamento 134 não encontrado')
  if (
    parent.cardId !== 9 ||
    parent.description !== 'Poke ifood' ||
    parent.recurrence !== 'installment' ||
    parent.installmentCount !== 5 ||
    parent.date !== '2026-06-25' ||
    parent.endDate !== '2026-10-25'
  ) {
    fail('estrutura inesperada no parcelamento Poke ifood (134)')
  }

  for (const adjustment of installmentAdjustments) {
    const exception = db
      .prepare(
        `SELECT action, due_date AS dueDate, notes
         FROM entry_occurrence_exceptions
         WHERE entry_id = ? AND occurrence_month = ?`,
      )
      .get(adjustment.entryId, adjustment.occurrenceMonth)

    const alreadyApplied =
      exception?.action === 'edit' &&
      exception.dueDate === adjustment.adjustedDate &&
      exception.notes?.includes(marker)

    if (exception && !alreadyApplied) {
      fail(
        `já existe uma exceção inesperada para ${adjustment.entryId}:${adjustment.occurrenceMonth}`,
      )
    }

    planned.push({
      kind: 'installment_occurrence',
      id: `${adjustment.entryId}:${adjustment.occurrenceMonth}`,
      description: parent.description,
      from: alreadyApplied ? adjustment.adjustedDate : adjustment.originalDate,
      to: adjustment.adjustedDate,
      alreadyApplied,
      notes: auditNote(exception?.notes ?? parent.notes, adjustment.originalDate),
      adjustment,
    })
  }

  const pending = planned.filter((item) => !item.alreadyApplied)
  if (!apply) {
    console.log(
      JSON.stringify(
        { mode: 'dry-run', pending: pending.length, adjustments: planned },
        null,
        2,
      ),
    )
    process.exit(0)
  }

  if (pending.length === 0) {
    console.log(JSON.stringify({ mode: 'apply', changed: 0, alreadyApplied: 8 }, null, 2))
    process.exit(0)
  }

  mkdirSync('.data/backups', { recursive: true })
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')
  const backupPath = join('.data', 'backups', `lumen-before-cycle-adjustment-${stamp}.sqlite3`)
  await db.backup(backupPath)

  const updateSingle = db.prepare(
    `UPDATE entries SET date = ?, notes = ? WHERE id = ? AND date = ?`,
  )
  const insertException = db.prepare(
    `INSERT INTO entry_occurrence_exceptions (
       entry_id, occurrence_month, action, due_date, amount, description,
       category_id, statement_name, notes, created_at
     ) VALUES (?, ?, 'edit', ?, ?, ?, ?, ?, ?, '2026-08-29')`,
  )

  db.transaction(() => {
    for (const item of pending) {
      if (item.kind === 'single') {
        const changed = updateSingle.run(item.to, item.notes, item.id, item.from)
        if (changed.changes !== 1) fail(`não foi possível atualizar ${item.id}`)
        continue
      }

      insertException.run(
        item.adjustment.entryId,
        item.adjustment.occurrenceMonth,
        item.adjustment.adjustedDate,
        parent.amount,
        parent.description,
        parent.categoryId,
        parent.statementName,
        item.notes,
      )
    }
  })()

  const integrity = db.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') fail(`integrity_check retornou ${integrity}`)

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        changed: pending.length,
        backupPath,
        integrity,
        adjustments: pending.map(({ kind, id, description, from, to }) => ({
          kind,
          id,
          description,
          from,
          to,
        })),
      },
      null,
      2,
    ),
  )
} finally {
  db.close()
}
