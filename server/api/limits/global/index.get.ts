import type { GlobalLimitReport } from '~/types/limits'
import { buildGlobalLimitReport } from '../../../utils/limits'

export default defineEventHandler((event): GlobalLimitReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : todayLocal().slice(0, 7)

  return buildGlobalLimitReport(useDb(), month)
})
