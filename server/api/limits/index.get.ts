import type { LimitScope, LimitsReport } from '~/types/limits'
import { buildLimitsReport } from '../../utils/limits'

export default defineEventHandler((event): LimitsReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : todayLocal().slice(0, 7)
  const scope: LimitScope =
    query.scope === 'supercategory' ? 'supercategory' : 'category'

  return buildLimitsReport(useDb(), month, scope)
})
