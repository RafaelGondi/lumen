import type Database from 'better-sqlite3'
import type {
  CategorySpendReport,
  CategorySpendRow,
  CategorySpendScope,
} from '~/types/categorySpendReport'
import type { SpendingCalendarItem } from '~/types/spendingCalendar'
import type {
  SpendingGuardBreakdownGroup,
  SpendingGuardBreakdownItem,
  SpendingGuardSourceTotals,
} from '~/types/spendingGuard'
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'
import { roundMoney } from '~/utils/dateMoney'
import { loadSuperByCategory } from './limits'
import { buildSpendingCalendar } from './spendingCalendar'

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

type ReferenceMeta = {
  label: string
  color: string
  icon: string
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function shortMonthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `${MONTH_SHORT[value! - 1]}/${year}`
}

function invoicePaymentEntryIds(db: Database.Database) {
  const rows = db
    .prepare('SELECT entry_id AS entryId FROM card_invoice_payments')
    .all() as { entryId: number }[]
  return new Set(rows.map((row) => row.entryId))
}

function loadCardClosingDays(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, closing_day AS closingDay
       FROM cards
       WHERE active = 1`,
    )
    .all() as { id: number; closingDay: number }[]
  return new Map(rows.map((row) => [row.id, row.closingDay]))
}

function collectSpendingItems(db: Database.Database, month: string) {
  const calendar = buildSpendingCalendar(db, month, 'all')
  const paymentEntryIds = invoicePaymentEntryIds(db)
  return calendar.days
    .flatMap((day) => day.items)
    .filter(
      (item) =>
        item.source !== 'account' || !paymentEntryIds.has(item.parentId),
    )
}

function totalsBySource(
  items: Pick<SpendingCalendarItem, 'source' | 'amount'>[],
): SpendingGuardSourceTotals {
  return items.reduce(
    (totals, item) => {
      totals[item.source] = roundMoney(totals[item.source] + item.amount)
      return totals
    },
    { account: 0, card: 0 },
  )
}

function calendarItemToBreakdownItem(
  item: SpendingCalendarItem,
  month: string,
  closingDays: Map<number, number>,
): SpendingGuardBreakdownItem {
  let invoiceMonthLabel: string | null = null
  if (item.source === 'card' && item.cardId) {
    const closingDay = closingDays.get(item.cardId)
    if (closingDay !== undefined) {
      const invoiceMonth = transacaoFaturaMonth(item.date, closingDay)
      if (invoiceMonth !== month) {
        invoiceMonthLabel = shortMonthLabel(invoiceMonth)
      }
    }
  }

  return {
    id: item.id,
    description: item.description,
    amount: item.amount,
    date: item.date,
    source: item.source,
    sourceLabel: item.source === 'card' ? item.cardName : item.accountName,
    categoryName: item.categoryName,
    categoryColor: item.categoryColor,
    categoryIcon: item.categoryIcon,
    invoiceMonthLabel,
  }
}

function loadCategoryMeta(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, name, color, icon
       FROM categories
       WHERE type = 'expense'`,
    )
    .all() as { id: number; name: string; color: string; icon: string }[]

  const map = new Map<number, ReferenceMeta>()
  for (const row of rows) {
    map.set(row.id, {
      label: row.name,
      color: row.color,
      icon: row.icon,
    })
  }
  map.set(0, {
    label: 'Sem categoria',
    color: '#94a3b8',
    icon: 'tag',
  })
  return map
}

function loadSuperMeta(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT id, name, color, icon
       FROM supercategories`,
    )
    .all() as { id: number; name: string; color: string; icon: string }[]

  const map = new Map<number, ReferenceMeta>()
  for (const row of rows) {
    map.set(row.id, {
      label: row.name,
      color: row.color,
      icon: row.icon,
    })
  }
  map.set(0, {
    label: 'Sem supercategoria',
    color: '#94a3b8',
    icon: 'folder-tree',
  })
  return map
}

function referenceIdForItem(
  item: SpendingCalendarItem,
  scope: CategorySpendScope,
  superByCategory: Map<number, number>,
) {
  if (scope === 'category') {
    return item.categoryId ?? 0
  }

  const categoryId = item.categoryId ?? 0
  return categoryId === 0 ? 0 : (superByCategory.get(categoryId) ?? 0)
}

function buildBreakdownGroup(
  referenceId: number,
  meta: ReferenceMeta,
  items: SpendingCalendarItem[],
  month: string,
  closingDays: Map<number, number>,
): SpendingGuardBreakdownGroup {
  const breakdownItems = items
    .map((item) => calendarItemToBreakdownItem(item, month, closingDays))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.amount - a.amount ||
        a.description.localeCompare(b.description, 'pt-BR'),
    )

  return {
    key: String(referenceId),
    label: meta.label,
    color: meta.color,
    icon: meta.icon,
    total: roundMoney(breakdownItems.reduce((sum, item) => sum + item.amount, 0)),
    items: breakdownItems,
  }
}

export function buildCategorySpendReport(
  db: Database.Database,
  month: string,
  scope: CategorySpendScope,
): CategorySpendReport {
  const items = collectSpendingItems(db, month)
  const closingDays = loadCardClosingDays(db)
  const superByCategory = loadSuperByCategory(db)
  const metaMap =
    scope === 'category' ? loadCategoryMeta(db) : loadSuperMeta(db)
  const monthTotal = roundMoney(
    items.reduce((sum, item) => sum + item.amount, 0),
  )
  const sourceTotals = totalsBySource(items)
  const grouped = new Map<number, SpendingCalendarItem[]>()

  for (const item of items) {
    const referenceId = referenceIdForItem(item, scope, superByCategory)
    const list = grouped.get(referenceId) ?? []
    list.push(item)
    grouped.set(referenceId, list)
  }

  const rows: CategorySpendRow[] = []

  for (const [referenceId, groupItems] of grouped) {
    const meta = metaMap.get(referenceId) ?? {
      label: referenceId === 0 ? 'Outros' : `Item ${referenceId}`,
      color: '#94a3b8',
      icon: 'tag',
    }
    const amount = roundMoney(
      groupItems.reduce((sum, item) => sum + item.amount, 0),
    )

    rows.push({
      referenceId,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      amount,
      percent: monthTotal > 0 ? roundPercent((amount / monthTotal) * 100) : 0,
      itemCount: groupItems.length,
      sourceTotals: totalsBySource(groupItems),
      breakdown: buildBreakdownGroup(
        referenceId,
        meta,
        groupItems,
        month,
        closingDays,
      ),
    })
  }

  rows.sort(
    (a, b) =>
      b.amount - a.amount ||
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }),
  )

  const calendar = buildSpendingCalendar(db, month, 'all')

  return {
    month,
    fullLabel: calendar.fullLabel,
    scope,
    monthTotal,
    sourceTotals,
    topReferenceId: rows[0]?.referenceId ?? null,
    rows,
  }
}
