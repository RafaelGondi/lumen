import type { MonthlyResultReport, MonthlyResultScope } from '~/types/monthlyResult'
import { buildMonthlyResultReport } from '../../utils/monthlyResult'

export default defineEventHandler((event): MonthlyResultReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : todayLocal().slice(0, 7)

  const [year, monthValue] = month.split('-').map(Number)
  const probe = new Date(year!, monthValue! - 1, 1)
  if (probe.getFullYear() !== year || probe.getMonth() !== monthValue! - 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido.',
    })
  }

  const requestedScope =
    typeof query.scope === 'string' ? query.scope : 'category'
  const validScopes: MonthlyResultScope[] = [
    'category',
    'supercategory',
    'recurrence',
  ]
  const scope: MonthlyResultScope = validScopes.includes(
    requestedScope as MonthlyResultScope,
  )
    ? (requestedScope as MonthlyResultScope)
    : 'category'

  return buildMonthlyResultReport(useDb(), month, scope)
})
