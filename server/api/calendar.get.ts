import type { SpendingRecurrenceFilter } from '~/types/spendingCalendar'
import { buildSpendingCalendar } from '../utils/spendingCalendar'

const FILTERS: SpendingRecurrenceFilter[] = [
  'all',
  'purchased',
  'single',
  'installment',
  'fixed',
]

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : (() => {
          const today = new Date()
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
        })()

  const filterRaw = typeof query.filter === 'string' ? query.filter : 'all'
  const filter = FILTERS.includes(filterRaw as SpendingRecurrenceFilter)
    ? (filterRaw as SpendingRecurrenceFilter)
    : 'all'

  const categoryIds =
    typeof query.categories === 'string'
      ? query.categories
          .split(',')
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0)
      : []

  const supercategoryIds =
    typeof query.supercategories === 'string'
      ? query.supercategories
          .split(',')
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0)
      : []

  return buildSpendingCalendar(
    useDb(),
    month,
    filter,
    categoryIds,
    supercategoryIds,
  )
})
