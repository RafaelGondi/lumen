import type Database from 'better-sqlite3'
import type { CardExpenseOccurrence } from '~/types/cardExpense'
import { addMonthsScheduled, roundMoney } from '~/utils/dateMoney'
import {
  faturaDateRange,
  transacaoFaturaMonth,
} from '~/utils/cardInvoiceCycle'

type CardExpenseParent = {
  id: number
  cardId: number
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  supercategoryId: number | null
  supercategoryName: string | null
  supercategoryColor: string | null
  supercategoryIcon: string | null
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

type OccurrenceException = {
  entryId: number
  occurrenceMonth: string
  action: 'edit' | 'exclude'
  dueDate: string | null
  amount: number | null
  description: string | null
  categoryId: number | null
  statementName: string | null
  notes: string | null
}

type CategoryMeta = {
  id: number
  name: string
  color: string
  icon: string
  supercategoryId: number | null
  supercategoryName: string | null
  supercategoryColor: string | null
  supercategoryIcon: string | null
}

function monthIndex(month: string) {
  const [year, value] = month.split('-').map(Number)
  return year! * 12 + value! - 1
}

function monthFromIndex(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

function loadParents(db: Database.Database, cardId: number) {
  return db
    .prepare(
      `SELECT
         e.id,
         e.card_id AS cardId,
         e.category_id AS categoryId,
         c.name AS categoryName,
         c.color AS categoryColor,
         c.icon AS categoryIcon,
         s.id AS supercategoryId,
         s.name AS supercategoryName,
         s.color AS supercategoryColor,
         s.icon AS supercategoryIcon,
         e.description,
         e.amount,
         e.statement_name AS statementName,
         e.notes,
         e.recurrence,
         e.date,
         e.end_date AS endDate,
         e.installment_count AS installmentCount,
         e.month_end AS useMonthEnd
       FROM entries e
       LEFT JOIN categories c ON c.id = e.category_id
       LEFT JOIN supercategories s ON s.id = c.supercategory_id
       WHERE e.card_id = ?
         AND e.account_id IS NULL
         AND e.type = 'expense'`,
    )
    .all(cardId) as CardExpenseParent[]
}

function loadExceptions(db: Database.Database, entryIds: number[]) {
  if (!entryIds.length) return new Map<string, OccurrenceException>()
  const placeholders = entryIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `SELECT
         entry_id AS entryId,
         occurrence_month AS occurrenceMonth,
         action,
         due_date AS dueDate,
         amount,
         description,
         category_id AS categoryId,
         statement_name AS statementName,
         notes
       FROM entry_occurrence_exceptions
       WHERE entry_id IN (${placeholders})`,
    )
    .all(...entryIds) as OccurrenceException[]
  return new Map(
    rows.map((row) => [`${row.entryId}:${row.occurrenceMonth}`, row]),
  )
}

function loadCategories(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.color,
         c.icon,
         s.id AS supercategoryId,
         s.name AS supercategoryName,
         s.color AS supercategoryColor,
         s.icon AS supercategoryIcon
       FROM categories c
       LEFT JOIN supercategories s ON s.id = c.supercategory_id
       WHERE c.type = 'expense'`,
    )
    .all() as CategoryMeta[]
  return new Map(rows.map((row) => [row.id, row]))
}

function occurrenceIndex(parent: CardExpenseParent, occurrenceMonth: string) {
  return monthIndex(occurrenceMonth) - monthIndex(parent.date.slice(0, 7))
}

function isValidOccurrence(parent: CardExpenseParent, index: number) {
  if (index < 0) return false
  if (parent.recurrence === 'single') return index === 0
  if (
    parent.recurrence === 'installment' &&
    index >= (parent.installmentCount ?? 0)
  ) {
    return false
  }
  const date = addMonthsScheduled(
    parent.date,
    index,
    Boolean(parent.useMonthEnd),
  )
  return !parent.endDate || date <= parent.endDate
}

function deriveOccurrence(
  parent: CardExpenseParent,
  occurrenceMonth: string,
  exceptions: Map<string, OccurrenceException>,
  categories: Map<number, CategoryMeta>,
): CardExpenseOccurrence | null {
  const index = occurrenceIndex(parent, occurrenceMonth)
  if (!isValidOccurrence(parent, index)) return null

  const key = `${parent.id}:${occurrenceMonth}`
  const exception = exceptions.get(key)
  if (exception?.action === 'exclude') return null

  const isEdit = exception?.action === 'edit'
  const categoryId = isEdit ? exception.categoryId : parent.categoryId
  const overriddenCategory =
    categoryId === parent.categoryId
      ? null
      : categories.get(categoryId ?? -1)
  const supercategory =
    categoryId === parent.categoryId
      ? {
          supercategoryId: parent.supercategoryId,
          supercategoryName: parent.supercategoryName,
          supercategoryColor: parent.supercategoryColor,
          supercategoryIcon: parent.supercategoryIcon,
        }
      : {
          supercategoryId: overriddenCategory?.supercategoryId ?? null,
          supercategoryName: overriddenCategory?.supercategoryName ?? null,
          supercategoryColor: overriddenCategory?.supercategoryColor ?? null,
          supercategoryIcon: overriddenCategory?.supercategoryIcon ?? null,
        }

  return {
    id: parent.id,
    parentId: parent.id,
    occurrenceKey: key,
    occurrenceMonth,
    occurrenceIndex: index + 1,
    cardId: parent.cardId,
    description:
      isEdit && exception.description !== null
        ? exception.description
        : parent.description,
    amount: roundMoney(
      isEdit && exception.amount !== null ? exception.amount : parent.amount,
    ),
    date:
      isEdit && exception.dueDate
        ? exception.dueDate
        : addMonthsScheduled(
            parent.date,
            index,
            Boolean(parent.useMonthEnd),
          ),
    categoryId,
    categoryName:
      categoryId === parent.categoryId
        ? parent.categoryName
        : overriddenCategory?.name ?? null,
    categoryColor:
      categoryId === parent.categoryId
        ? parent.categoryColor
        : overriddenCategory?.color ?? null,
    categoryIcon:
      categoryId === parent.categoryId
        ? parent.categoryIcon
        : overriddenCategory?.icon ?? null,
    supercategoryId: supercategory.supercategoryId,
    supercategoryName: supercategory.supercategoryName,
    supercategoryColor: supercategory.supercategoryColor,
    supercategoryIcon: supercategory.supercategoryIcon,
    statementName: isEdit ? exception.statementName : parent.statementName,
    notes: isEdit ? exception.notes : parent.notes,
    recurrence: parent.recurrence,
    endDate: parent.endDate,
    installmentCount: parent.installmentCount,
    installmentIndex:
      parent.recurrence === 'installment' ? index + 1 : null,
    useMonthEnd: Boolean(parent.useMonthEnd),
    isException: isEdit,
  }
}

function monthsInRange(startDate: string, endDate: string) {
  const result: string[] = []
  const start = monthIndex(startDate.slice(0, 7))
  const end = monthIndex(endDate.slice(0, 7))
  for (let index = start; index <= end; index += 1) {
    result.push(monthFromIndex(index))
  }
  return result
}

export function cardExpensesForInvoice(
  db: Database.Database,
  cardId: number,
  invoiceMonth: string,
  cutoff: number,
) {
  const parents = loadParents(db, cardId)
  const exceptions = loadExceptions(
    db,
    parents.map((parent) => parent.id),
  )
  const categories = loadCategories(db)
  const [year, month] = invoiceMonth.split('-').map(Number)
  const range = faturaDateRange(year!, month!, cutoff)
  const baseMonths = monthsInRange(range.startDate, range.endDate)
  const result = new Map<string, CardExpenseOccurrence>()

  for (const parent of parents) {
    const candidateMonths = new Set(baseMonths)
    for (const exception of exceptions.values()) {
      if (
        exception.entryId === parent.id &&
        exception.action === 'edit' &&
        exception.dueDate &&
        exception.dueDate >= range.startDate &&
        exception.dueDate <= range.endDate
      ) {
        candidateMonths.add(exception.occurrenceMonth)
      }
    }

    for (const occurrenceMonth of candidateMonths) {
      const occurrence = deriveOccurrence(
        parent,
        occurrenceMonth,
        exceptions,
        categories,
      )
      if (
        occurrence &&
        occurrence.date >= range.startDate &&
        occurrence.date <= range.endDate &&
        transacaoFaturaMonth(occurrence.date, cutoff) === invoiceMonth
      ) {
        result.set(occurrence.occurrenceKey, occurrence)
      }
    }
  }

  return [...result.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  )
}

export function cardExpenseOccurrenceByKey(
  db: Database.Database,
  cardId: number,
  entryId: number,
  occurrenceMonth: string,
) {
  const parent = loadParents(db, cardId).find((item) => item.id === entryId)
  if (!parent) return null
  return deriveOccurrence(
    parent,
    occurrenceMonth,
    loadExceptions(db, [entryId]),
    loadCategories(db),
  )
}

