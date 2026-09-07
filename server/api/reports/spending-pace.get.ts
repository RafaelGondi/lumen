import type { SpendingPaceReport } from '~/types/spendingPace'
import { buildSpendingPaceReport } from '../../utils/spendingPace'

function parseIds(value: unknown) {
  return typeof value === 'string'
    ? value
        .split(',')
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    : []
}

export default defineEventHandler((event): SpendingPaceReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' ? query.month : todayLocal().slice(0, 7)

  return buildSpendingPaceReport(
    useDb(),
    month,
    parseIds(query.categories),
    parseIds(query.supercategories),
  )
})
