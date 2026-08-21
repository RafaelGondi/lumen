import type { ComparisonReport, ComparisonScope } from '~/types/comparison'
import { buildComparisonReport } from '../../utils/comparison'

function validMonth(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return fallback
  const [year, month] = value.split('-').map(Number)
  const probe = new Date(year!, month! - 1, 1)
  if (probe.getFullYear() !== year || probe.getMonth() !== month! - 1) {
    throw createError({ statusCode: 400, statusMessage: 'Mês inválido.' })
  }
  return value
}

function previousMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(year!, value! - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default defineEventHandler((event): ComparisonReport => {
  const query = getQuery(event)
  const currentMonth = todayLocal().slice(0, 7)
  const compareMonth = validMonth(query.compareMonth, currentMonth)
  const baseMonth = validMonth(query.baseMonth, previousMonth(compareMonth))
  const scope: ComparisonScope =
    query.scope === 'category' ? 'category' : 'supercategory'

  return buildComparisonReport(useDb(), baseMonth, compareMonth, scope)
})
