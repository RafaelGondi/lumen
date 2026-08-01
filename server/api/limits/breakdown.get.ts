import type { LimitBreakdownReport, LimitScope } from '~/types/limits'
import { buildLimitBreakdown } from '../../utils/limits'

export default defineEventHandler((event): LimitBreakdownReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : todayLocal().slice(0, 7)
  const scope: LimitScope =
    query.scope === 'supercategory' ? 'supercategory' : 'category'
  const referenceId = Number(query.referenceId)

  if (!Number.isInteger(referenceId) || referenceId < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Referência inválida.',
    })
  }

  return buildLimitBreakdown(useDb(), month, scope, referenceId)
})