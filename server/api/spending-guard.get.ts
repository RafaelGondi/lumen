import type { SpendingGuardReport } from '~/types/spendingGuard'
import { buildSpendingGuard } from '../utils/spendingGuard'

export default defineEventHandler((event): SpendingGuardReport => {
  const query = getQuery(event)
  const referenceDate =
    typeof query.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(query.date)
      ? query.date
      : todayLocal()
  const month =
    typeof query.month === 'string' &&
    /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : referenceDate.slice(0, 7)
  return buildSpendingGuard(useDb(), month, referenceDate)
})
