import type { EvolutionReport } from '~/types/evolution'
import { buildEvolutionReport } from '../../utils/evolution'

export default defineEventHandler((event): EvolutionReport => {
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && query.month
      ? query.month
      : todayLocal().slice(0, 7)

  return buildEvolutionReport(useDb(), month)
})
