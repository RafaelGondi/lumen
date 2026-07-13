import type Database from 'better-sqlite3'
import { addMonthsScheduled, roundMoney } from '~/utils/dateMoney'
import type { EntryOccurrence } from '~/types/entry'

type ParentEntry = {
  id: number
  type: 'income' | 'expense' | 'transfer'
  accountId: number
  accountName: string
  destinationAccountId: number | null
  destinationAccountName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  description: string
  amount: number
  statementName: string | null
  notes: string | null
  recurrence: 'single' | 'installment' | 'fixed'
  date: string
  endDate: string | null
  installmentCount: number | null
  groupId: string | null
  paymentState: 'auto' | 'paid' | 'unpaid'
  paymentDate: string | null
  useMonthEnd: boolean
}

type OccurrencePayment = {
  entryId: number
  occurrenceMonth: string
  state: 'paid' | 'unpaid'
  paymentDate: string | null
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
}

function monthIndex(month: string) {
  const [year, value] = month.split('-').map(Number)
  return year! * 12 + value! - 1
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

function loadParents(
  db: Database.Database,
  accountId?: number,
): ParentEntry[] {
  // Sem accountId (dashboard): só income/expense — transferências são neutras no P&L.
  const where = accountId
    ? `WHERE e.card_id IS NULL
         AND (
           (e.type IN ('income', 'expense') AND e.account_id = ?)
           OR (
             e.type = 'transfer'
             AND (e.account_id = ? OR e.destination_account_id = ?)
           )
         )`
    : `WHERE e.card_id IS NULL
         AND e.type IN ('income', 'expense')`
  const query = db.prepare(
    `SELECT
       e.id,
       e.type,
       e.account_id AS accountId,
       a.name AS accountName,
       e.destination_account_id AS destinationAccountId,
       d.name AS destinationAccountName,
       e.category_id AS categoryId,
       c.name AS categoryName,
       c.color AS categoryColor,
       c.icon AS categoryIcon,
       e.description,
       e.amount,
       e.statement_name AS statementName,
       e.notes,
       e.recurrence,
       e.date,
       e.end_date AS endDate,
       e.installment_count AS installmentCount,
       e.group_id AS groupId,
       e.payment_state AS paymentState,
       e.payment_date AS paymentDate,
       e.month_end AS useMonthEnd
     FROM entries e
     JOIN accounts a ON a.id = e.account_id
     LEFT JOIN accounts d ON d.id = e.destination_account_id
     LEFT JOIN categories c ON c.id = e.category_id
     ${where}`,
  )

  return (
    accountId
      ? query.all(accountId, accountId, accountId)
      : query.all()
  ) as ParentEntry[]
}

function loadPayments(db: Database.Database): Map<string, OccurrencePayment> {
  const rows = db
    .prepare(
      `SELECT
         entry_id AS entryId,
         occurrence_month AS occurrenceMonth,
         state,
         payment_date AS paymentDate
       FROM entry_occurrence_payments`,
    )
    .all() as OccurrencePayment[]

  return new Map(
    rows.map((row) => [`${row.entryId}:${row.occurrenceMonth}`, row]),
  )
}

function loadExceptions(db: Database.Database) {
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
       FROM entry_occurrence_exceptions`,
    )
    .all() as OccurrenceException[]

  return new Map(
    rows.map((row) => [`${row.entryId}:${row.occurrenceMonth}`, row]),
  )
}

function loadCategories(db: Database.Database) {
  const rows = db
    .prepare('SELECT id, name, color, icon FROM categories')
    .all() as CategoryMeta[]
  return new Map(rows.map((row) => [row.id, row]))
}

function occurrenceIndexForMonth(parent: ParentEntry, occurrenceMonth: string) {
  return monthIndex(occurrenceMonth) - monthIndex(parent.date.slice(0, 7))
}

function isValidOccurrence(parent: ParentEntry, index: number) {
  if (index < 0) return false
  if (parent.recurrence === 'single') return index === 0
  if (
    parent.recurrence === 'installment' &&
    index >= (parent.installmentCount ?? 0)
  ) {
    return false
  }

  const dueDate = addMonthsScheduled(
    parent.date,
    index,
    parent.useMonthEnd,
  )
  return !parent.endDate || dueDate <= parent.endDate
}

function deriveOccurrence(
  parent: ParentEntry,
  occurrenceMonth: string,
  payments: Map<string, OccurrencePayment>,
  exceptions: Map<string, OccurrenceException>,
  categories: Map<number, CategoryMeta>,
  today: string,
  viewingAccountId?: number,
): EntryOccurrence | null {
  const index = occurrenceIndexForMonth(parent, occurrenceMonth)
  if (!isValidOccurrence(parent, index)) return null

  const key = `${parent.id}:${occurrenceMonth}`
  const exception = exceptions.get(key)
  if (exception?.action === 'exclude') return null

  const dueDate =
    exception?.action === 'edit' && exception.dueDate
      ? exception.dueDate
      : addMonthsScheduled(parent.date, index, parent.useMonthEnd)
  const amount =
    exception?.action === 'edit' && exception.amount !== null
      ? exception.amount
      : parent.amount
  const description =
    exception?.action === 'edit' && exception.description !== null
      ? exception.description
      : parent.description
  const categoryId =
    exception?.action === 'edit'
      ? exception.categoryId
      : parent.categoryId
  const category =
    categoryId === parent.categoryId
      ? null
      : categories.get(categoryId ?? -1)
  const payment =
    parent.recurrence === 'single'
      ? {
          state: parent.paymentState,
          paymentDate: parent.paymentDate,
        }
      : payments.get(key) ?? { state: 'auto' as const, paymentDate: null }
  const settled =
    payment.state === 'paid'
      ? Boolean(payment.paymentDate && payment.paymentDate <= today)
      : payment.state === 'unpaid'
        ? false
        : dueDate <= today
  const cashDate =
    payment.state === 'paid' && payment.paymentDate
      ? payment.paymentDate
      : dueDate

  const transferDirection =
    parent.type === 'transfer' && viewingAccountId != null
      ? viewingAccountId === parent.destinationAccountId
        ? ('in' as const)
        : ('out' as const)
      : null

  return {
    id: parent.id,
    parentId: parent.id,
    occurrenceKey:
      parent.type === 'transfer' && transferDirection
        ? `${key}:${transferDirection}`
        : key,
    occurrenceMonth,
    occurrenceIndex: index + 1,
    type: parent.type,
    accountId: parent.accountId,
    accountName: parent.accountName,
    destinationAccountId: parent.destinationAccountId,
    destinationAccountName: parent.destinationAccountName,
    categoryId,
    categoryName:
      categoryId === parent.categoryId
        ? parent.categoryName
        : category?.name ?? null,
    categoryColor:
      categoryId === parent.categoryId
        ? parent.categoryColor
        : category?.color ?? null,
    categoryIcon:
      categoryId === parent.categoryId
        ? parent.categoryIcon
        : category?.icon ?? null,
    description,
    amount: roundMoney(amount),
    statementName:
      exception?.action === 'edit'
        ? exception.statementName
        : parent.statementName,
    notes:
      exception?.action === 'edit' ? exception.notes : parent.notes,
    recurrence: parent.recurrence,
    date: cashDate,
    dueDate,
    endDate: parent.endDate,
    installmentCount: parent.installmentCount,
    installmentIndex:
      parent.recurrence === 'installment' ? index + 1 : null,
    groupId: parent.groupId,
    status: settled
      ? parent.type === 'income'
        ? 'received'
        : 'paid'
      : 'pending',
    paymentState: payment.state,
    paymentDate: payment.paymentDate,
    settled,
    isException: exception?.action === 'edit',
    useMonthEnd: Boolean(parent.useMonthEnd),
    transferDirection,
  }
}

function candidateMonthsForCashMonth(
  db: Database.Database,
  parent: ParentEntry,
  cashMonth: string,
) {
  const result = new Set<string>([cashMonth])

  if (
    parent.recurrence === 'single' &&
    parent.paymentState === 'paid' &&
    parent.paymentDate?.slice(0, 7) === cashMonth
  ) {
    result.add(parent.date.slice(0, 7))
  }

  const paymentMonths = db
    .prepare(
      `SELECT occurrence_month AS occurrenceMonth
       FROM entry_occurrence_payments
       WHERE entry_id = ?
         AND state = 'paid'
         AND substr(payment_date, 1, 7) = ?`,
    )
    .all(parent.id, cashMonth) as { occurrenceMonth: string }[]

  const exceptionMonths = db
    .prepare(
      `SELECT occurrence_month AS occurrenceMonth
       FROM entry_occurrence_exceptions
       WHERE entry_id = ?
         AND action = 'edit'
         AND substr(due_date, 1, 7) = ?`,
    )
    .all(parent.id, cashMonth) as { occurrenceMonth: string }[]

  for (const row of [...paymentMonths, ...exceptionMonths]) {
    result.add(row.occurrenceMonth)
  }

  return result
}

export function occurrencesForCashMonth(
  db: Database.Database,
  cashMonth: string,
  accountId?: number,
): EntryOccurrence[] {
  const today = todayLocal()
  const parents = loadParents(db, accountId)
  const payments = loadPayments(db)
  const exceptions = loadExceptions(db)
  const categories = loadCategories(db)
  const result = new Map<string, EntryOccurrence>()

  for (const parent of parents) {
    const candidates = candidateMonthsForCashMonth(db, parent, cashMonth)
    for (const occurrenceMonth of candidates) {
      const occurrence = deriveOccurrence(
        parent,
        occurrenceMonth,
        payments,
        exceptions,
        categories,
        today,
        accountId,
      )
      if (occurrence?.date.slice(0, 7) === cashMonth) {
        result.set(occurrence.occurrenceKey, occurrence)
      }
    }
  }

  return [...result.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
  )
}

function occurrenceMonthsThrough(
  parent: ParentEntry,
  cutoff: string,
  paidFutureMonths: string[],
) {
  const startIndex = monthIndex(parent.date.slice(0, 7))
  const cutoffIndex = monthIndex(cutoff.slice(0, 7))
  const result = new Set<string>()
  const lastIndex =
    parent.recurrence === 'installment'
      ? Math.min(
          cutoffIndex,
          startIndex + Math.max((parent.installmentCount ?? 1) - 1, 0),
        )
      : parent.endDate
        ? Math.min(cutoffIndex, monthIndex(parent.endDate.slice(0, 7)))
        : cutoffIndex

  for (let index = startIndex; index <= lastIndex; index += 1) {
    result.add(monthFromIndex(index))
  }
  for (const month of paidFutureMonths) result.add(month)
  return result
}

export function settledOccurrencesUntil(
  db: Database.Database,
  cutoff: string,
  accountId?: number,
): EntryOccurrence[] {
  const parents = loadParents(db, accountId)
  const payments = loadPayments(db)
  const exceptions = loadExceptions(db)
  const categories = loadCategories(db)
  const result: EntryOccurrence[] = []

  for (const parent of parents) {
    const paidFutureMonths = db
      .prepare(
        `SELECT occurrence_month AS occurrenceMonth
         FROM entry_occurrence_payments
         WHERE entry_id = ?
           AND state = 'paid'
           AND payment_date <= ?`,
      )
      .all(parent.id, cutoff) as { occurrenceMonth: string }[]
    const explicitlyPaidMonths = paidFutureMonths.map(
      (row) => row.occurrenceMonth,
    )
    if (
      parent.recurrence === 'single' &&
      parent.paymentState === 'paid' &&
      parent.paymentDate &&
      parent.paymentDate <= cutoff
    ) {
      explicitlyPaidMonths.push(parent.date.slice(0, 7))
    }
    const months = occurrenceMonthsThrough(
      parent,
      cutoff,
      explicitlyPaidMonths,
    )

    for (const occurrenceMonth of months) {
      const occurrence = deriveOccurrence(
        parent,
        occurrenceMonth,
        payments,
        exceptions,
        categories,
        cutoff,
        accountId,
      )
      if (occurrence?.settled) result.push(occurrence)
    }
  }

  return result
}

export function occurrenceByKey(
  db: Database.Database,
  entryId: number,
  occurrenceMonth: string,
) {
  const parent = db
    .prepare(
      `SELECT
         e.id,
         e.type,
         e.account_id AS accountId,
         a.name AS accountName,
         e.destination_account_id AS destinationAccountId,
         d.name AS destinationAccountName,
         e.category_id AS categoryId,
         c.name AS categoryName,
         c.color AS categoryColor,
         c.icon AS categoryIcon,
         e.description,
         e.amount,
         e.statement_name AS statementName,
         e.notes,
         e.recurrence,
         e.date,
         e.end_date AS endDate,
         e.installment_count AS installmentCount,
         e.group_id AS groupId,
         e.payment_state AS paymentState,
         e.payment_date AS paymentDate,
         e.month_end AS useMonthEnd
       FROM entries e
       JOIN accounts a ON a.id = e.account_id
       LEFT JOIN accounts d ON d.id = e.destination_account_id
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.id = ?
         AND e.card_id IS NULL`,
    )
    .get(entryId) as ParentEntry | undefined
  if (!parent) return null
  return deriveOccurrence(
    parent,
    occurrenceMonth,
    loadPayments(db),
    loadExceptions(db),
    loadCategories(db),
    todayLocal(),
    parent.accountId,
  )
}

export function accountBalanceAtCutoff(
  db: Database.Database,
  accountId: number,
  cutoff: string,
) {
  const account = db
    .prepare(
      'SELECT initial_balance AS initialBalance FROM accounts WHERE id = ?',
    )
    .get(accountId) as { initialBalance: number } | undefined
  if (!account) return 0

  const movement = settledOccurrencesUntil(db, cutoff, accountId).reduce(
    (sum, occurrence) => {
      if (occurrence.type === 'income') return sum + occurrence.amount
      if (occurrence.type === 'expense') return sum - occurrence.amount
      if (occurrence.type === 'transfer') {
        return (
          sum +
          (occurrence.transferDirection === 'in'
            ? occurrence.amount
            : -occurrence.amount)
        )
      }
      return sum
    },
    0,
  )
  return roundMoney(account.initialBalance + movement)
}

export function allAccountBalancesAtCutoff(
  db: Database.Database,
  cutoff: string,
) {
  const accounts = db
    .prepare('SELECT id FROM accounts')
    .all() as { id: number }[]
  return new Map(
    accounts.map((account) => [
      account.id,
      accountBalanceAtCutoff(db, account.id, cutoff),
    ]),
  )
}
