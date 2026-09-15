import type Database from 'better-sqlite3'
import type { BankKey } from '~/types/account'
import type {
  SpendingCalendarDay,
  SpendingCalendarItem,
  SpendingCalendarReport,
  SpendingRecurrenceFilter,
} from '~/types/spendingCalendar'
import { addMonthsScheduled, roundMoney } from '~/utils/dateMoney'
import {
  occurrenceByKey,
  occurrencesForCashMonth,
  occurrencesForCompetenceMonth,
} from './occurrences'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

type CardParent = {
  id: number
  cardId: number
  cardName: string
  cardColor: string
  bankKey: BankKey
  bankName: string
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  description: string
  amount: number
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
}

type CategoryMeta = {
  id: number
  name: string
  color: string
  icon: string
}

type CategoryHierarchy = {
  id: number
  supercategoryId: number | null
}

function monthIndex(month: string) {
  const [year, value] = month.split('-').map(Number)
  return year! * 12 + value! - 1
}

function monthFromIndex(index: number) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

function monthBounds(month: string) {
  const [year, value] = month.split('-').map(Number)
  const start = `${month}-01`
  const endDay = new Date(year!, value!, 0).getDate()
  const end = `${month}-${String(endDay).padStart(2, '0')}`
  return { start, end, daysInMonth: endDay, year: year!, month: value! }
}

function todayIsoLocal() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function matchesFilter(
  recurrence: 'single' | 'installment' | 'fixed',
  filter: SpendingRecurrenceFilter,
) {
  if (filter === 'all') return true
  if (filter === 'purchased') return recurrence !== 'fixed'
  return recurrence === filter
}

function loadCardParents(db: Database.Database) {
  return db
    .prepare(
      `SELECT
         e.id,
         e.card_id AS cardId,
         cards.name AS cardName,
         cards.color AS cardColor,
         cards.bank_key AS bankKey,
         cards.bank_name AS bankName,
         e.category_id AS categoryId,
         c.name AS categoryName,
         c.color AS categoryColor,
         c.icon AS categoryIcon,
         e.description,
         e.amount,
         e.recurrence,
         e.date,
         e.end_date AS endDate,
         e.installment_count AS installmentCount,
         e.month_end AS useMonthEnd
       FROM entries e
       INNER JOIN cards ON cards.id = e.card_id
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.account_id IS NULL
         AND e.type = 'expense'
         AND cards.active = 1`,
    )
    .all() as CardParent[]
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
         category_id AS categoryId
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
      `SELECT id, name, color, icon
       FROM categories
       WHERE type = 'expense'`,
    )
    .all() as CategoryMeta[]
  return new Map(rows.map((row) => [row.id, row]))
}

function loadCategoryHierarchy(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, supercategory_id AS supercategoryId
       FROM categories
       WHERE type = 'expense'`,
    )
    .all() as CategoryHierarchy[]
  return new Map(rows.map((row) => [row.id, row.supercategoryId]))
}

function isValidCardOccurrence(parent: CardParent, index: number) {
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

function deriveCardOccurrence(
  parent: CardParent,
  occurrenceMonth: string,
  exceptions: Map<string, OccurrenceException>,
  categories: Map<number, CategoryMeta>,
): SpendingCalendarItem | null {
  const index =
    monthIndex(occurrenceMonth) - monthIndex(parent.date.slice(0, 7))
  if (!isValidCardOccurrence(parent, index)) return null

  const key = `${parent.id}:${occurrenceMonth}`
  const exception = exceptions.get(key)
  if (exception?.action === 'exclude') return null

  const isEdit = exception?.action === 'edit'
  const categoryId = isEdit ? exception.categoryId : parent.categoryId
  const overridden =
    categoryId === parent.categoryId
      ? null
      : categories.get(categoryId ?? -1)

  return {
    id: key,
    source: 'card',
    parentId: parent.id,
    occurrenceMonth,
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
    recurrence: parent.recurrence,
    installmentIndex:
      parent.recurrence === 'installment' ? index + 1 : null,
    installmentCount: parent.installmentCount,
    categoryId,
    categoryName:
      categoryId === parent.categoryId
        ? parent.categoryName
        : overridden?.name ?? null,
    categoryColor:
      categoryId === parent.categoryId
        ? parent.categoryColor
        : overridden?.color ?? null,
    categoryIcon:
      categoryId === parent.categoryId
        ? parent.categoryIcon
        : overridden?.icon ?? null,
    accountId: null,
    accountName: null,
    cardId: parent.cardId,
    cardName: parent.cardName,
    cardColor: parent.cardColor,
    bankKey: parent.bankKey,
    bankName: parent.bankName,
  }
}

function candidateMonthsForCard(parent: CardParent, calendarMonth: string) {
  const start = monthIndex(parent.date.slice(0, 7))
  const calendar = monthIndex(calendarMonth)
  const end =
    parent.recurrence === 'installment'
      ? start + Math.max((parent.installmentCount ?? 1) - 1, 0)
      : parent.endDate
        ? monthIndex(parent.endDate.slice(0, 7))
        : parent.recurrence === 'fixed'
          ? calendar + 1
          : start

  const result: string[] = []
  const from = Math.max(start, calendar - 1)
  const to = Math.min(end, calendar + 1)
  for (let index = from; index <= to; index += 1) {
    result.push(monthFromIndex(index))
  }
  return result
}

function cardItemsForMonth(
  db: Database.Database,
  month: string,
  filter: SpendingRecurrenceFilter,
) {
  const parents = loadCardParents(db)
  const exceptions = loadExceptions(
    db,
    parents.map((parent) => parent.id),
  )
  const categories = loadCategories(db)
  const { start, end } = monthBounds(month)
  const result = new Map<string, SpendingCalendarItem>()

  for (const parent of parents) {
    if (!matchesFilter(parent.recurrence, filter)) continue
    if (filter === 'purchased' && parent.date.slice(0, 7) !== month) continue
    const candidateMonths =
      filter === 'purchased'
        ? [parent.date.slice(0, 7)]
        : candidateMonthsForCard(parent, month)
    for (const occurrenceMonth of candidateMonths) {
      const item = deriveCardOccurrence(
        parent,
        occurrenceMonth,
        exceptions,
        categories,
      )
      if (item && filter === 'purchased') {
        item.date = parent.date
      }
      if (item && item.date >= start && item.date <= end) {
        if (filter === 'purchased' && item.installmentCount) {
          item.amount = roundMoney(item.amount * item.installmentCount)
        }
        result.set(item.id, item)
      }
    }
  }

  return [...result.values()]
}

function accountItemsForMonth(
  db: Database.Database,
  month: string,
  filter: SpendingRecurrenceFilter,
  dateBasis: 'cash' | 'competence',
) {
  const invoicePaymentEntryIds = new Set(
    (
      db
        .prepare('SELECT entry_id AS entryId FROM card_invoice_payments')
        .all() as { entryId: number }[]
    ).map((row) => row.entryId),
  )

  if (filter === 'purchased') {
    const parents = db
      .prepare(
        `SELECT id, date
         FROM entries
         WHERE account_id IS NOT NULL
           AND card_id IS NULL
           AND type = 'expense'
           AND recurrence IN ('single', 'installment')
           AND substr(date, 1, 7) = ?`,
      )
      .all(month) as { id: number; date: string }[]

    return parents.flatMap((parent): SpendingCalendarItem[] => {
      if (invoicePaymentEntryIds.has(parent.id)) return []
      const occurrence = occurrenceByKey(
        db,
        parent.id,
        parent.date.slice(0, 7),
      )
      if (!occurrence || occurrence.type !== 'expense') return []

      return [
        {
          id: occurrence.occurrenceKey,
          source: 'account',
          parentId: occurrence.parentId,
          occurrenceMonth: occurrence.occurrenceMonth,
          description: occurrence.description,
          amount: occurrence.installmentCount
            ? roundMoney(occurrence.amount * occurrence.installmentCount)
            : occurrence.amount,
          date: parent.date,
          recurrence: occurrence.recurrence,
          installmentIndex: occurrence.installmentIndex,
          installmentCount: occurrence.installmentCount,
          categoryId: occurrence.categoryId,
          categoryName: occurrence.categoryName,
          categoryColor: occurrence.categoryColor,
          categoryIcon: occurrence.categoryIcon,
          accountId: occurrence.accountId,
          accountName: occurrence.accountName,
          cardId: null,
          cardName: null,
          cardColor: null,
          bankKey: null,
          bankName: null,
        },
      ]
    })
  }

  const occurrences =
    dateBasis === 'competence'
      ? occurrencesForCompetenceMonth(db, month)
      : occurrencesForCashMonth(db, month)

  return occurrences
    .filter(
      (occurrence) =>
        occurrence.type === 'expense' &&
        !invoicePaymentEntryIds.has(occurrence.parentId) &&
        matchesFilter(occurrence.recurrence, filter),
    )
    .map(
      (occurrence): SpendingCalendarItem => ({
        id: occurrence.occurrenceKey,
        source: 'account',
        parentId: occurrence.parentId,
        occurrenceMonth: occurrence.occurrenceMonth,
        description: occurrence.description,
        amount: occurrence.amount,
        date: occurrence.date,
        recurrence: occurrence.recurrence,
        installmentIndex: occurrence.installmentIndex,
        installmentCount: occurrence.installmentCount,
        categoryId: occurrence.categoryId,
        categoryName: occurrence.categoryName,
        categoryColor: occurrence.categoryColor,
        categoryIcon: occurrence.categoryIcon,
        accountId: occurrence.accountId,
        accountName: occurrence.accountName,
        cardId: null,
        cardName: null,
        cardColor: null,
        bankKey: null,
        bankName: null,
      }),
    )
}

function dominantColor(items: SpendingCalendarItem[]) {
  const totals = new Map<string, number>()
  for (const item of items) {
    const color = item.categoryColor
    if (!color) continue
    totals.set(color, roundMoney((totals.get(color) ?? 0) + item.amount))
  }
  let best: string | null = null
  let bestAmount = 0
  for (const [color, amount] of totals) {
    if (amount > bestAmount) {
      best = color
      bestAmount = amount
    }
  }
  return best
}

function computeStats(days: SpendingCalendarDay[], today: string) {
  const spendFlags = days.map((day) => day.count > 0)
  const daysWithSpend = spendFlags.filter(Boolean).length
  // Streaks representam comportamento já ocorrido. Em meses atuais, dias
  // posteriores a hoje ainda não podem ser considerados dias sem compra;
  // em meses futuros, portanto, não há streak a contabilizar.
  const observedSpendFlags = days
    .filter((day) => day.date <= today)
    .map((day) => day.count > 0)

  let longestStreak = 0
  let run = 0
  for (const hasSpend of observedSpendFlags) {
    if (!hasSpend) {
      run += 1
      longestStreak = Math.max(longestStreak, run)
    } else {
      run = 0
    }
  }

  let currentStreak = 0
  for (let index = observedSpendFlags.length - 1; index >= 0; index -= 1) {
    if (observedSpendFlags[index]) break
    currentStreak += 1
  }

  let peakDay: number | null = null
  let peakTotal = 0
  for (const day of days) {
    if (day.total > peakTotal) {
      peakTotal = day.total
      peakDay = day.day
    }
  }

  return {
    currentStreak,
    longestStreak,
    peakDay: peakTotal > 0 ? peakDay : null,
    peakTotal,
    daysWithSpend,
    daysInMonth: days.length,
  }
}

export function buildSpendingCalendar(
  db: Database.Database,
  month: string,
  filter: SpendingRecurrenceFilter,
  categoryIds: number[] = [],
  supercategoryIds: number[] = [],
  dateBasis: 'cash' | 'competence' = 'cash',
): SpendingCalendarReport {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido.',
    })
  }

  const { daysInMonth, year, month: monthNumber } = monthBounds(month)
  const today = todayIsoLocal()
  const selectedCategoryIds = new Set(categoryIds)
  const selectedSupercategoryIds = new Set(supercategoryIds)
  const categoryHierarchy = loadCategoryHierarchy(db)
  const items = [
    ...accountItemsForMonth(db, month, filter, dateBasis),
    ...cardItemsForMonth(db, month, filter),
  ]
    .filter(
      (item) =>
        (selectedCategoryIds.size === 0 ||
          (item.categoryId !== null &&
            selectedCategoryIds.has(item.categoryId))) &&
        (selectedSupercategoryIds.size === 0 ||
          (item.categoryId !== null &&
            selectedSupercategoryIds.has(
              categoryHierarchy.get(item.categoryId) ?? -1,
            ))),
    )
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        a.description.localeCompare(b.description, 'pt-BR'),
    )

  const byDate = new Map<string, SpendingCalendarItem[]>()
  for (const item of items) {
    const list = byDate.get(item.date) ?? []
    list.push(item)
    byDate.set(item.date, list)
  }

  let maxTotal = 0
  const days: SpendingCalendarDay[] = []
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const dayItems = byDate.get(date) ?? []
    const total = roundMoney(
      dayItems.reduce((sum, item) => sum + item.amount, 0),
    )
    maxTotal = Math.max(maxTotal, total)
    days.push({
      date,
      day,
      total,
      count: dayItems.length,
      isToday: date === today,
      intensity: 0,
      dominantColor: dominantColor(dayItems),
      items: dayItems,
    })
  }

  for (const day of days) {
    day.intensity =
      maxTotal > 0 ? Math.min(1, roundMoney(day.total / maxTotal)) : 0
  }

  return {
    month,
    fullLabel: `${MONTH_NAMES[monthNumber - 1]} de ${year}`,
    filter,
    monthTotal: roundMoney(items.reduce((sum, item) => sum + item.amount, 0)),
    days,
    stats: computeStats(days, today),
  }
}
