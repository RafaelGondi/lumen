import type { DashboardMonth } from '~/types/finance'
import { buildDashboardMonth } from '../utils/dashboard'

export default defineEventHandler((event): DashboardMonth => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && query.month
      ? query.month
      : todayLocal().slice(0, 7)

  return buildDashboardMonth(month)
})
