import type { MoneyFlowReport } from '~/types/moneyFlow'
import { buildMoneyFlowReport } from '../../utils/moneyFlow'

export default defineEventHandler((event): MoneyFlowReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : todayLocal().slice(0, 7)

  const [year, monthValue] = month.split('-').map(Number)
  const probe = new Date(year!, monthValue! - 1, 1)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== monthValue! - 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Mês inválido.' })
  }

  return buildMoneyFlowReport(useDb(), month)
})
