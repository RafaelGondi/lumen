import type { SpendingRecurrenceFilter } from '~/types/spendingCalendar'
import { buildSpendingCalendar } from '../utils/spendingCalendar'

const FILTERS: SpendingRecurrenceFilter[] = [
  'all',
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

  return buildSpendingCalendar(useDb(), month, filter)
})
