import type { DebtEvolutionReport } from '~/types/debtEvolution'
import { buildDebtEvolutionReport } from '../../utils/debtEvolution'

export default defineEventHandler((): DebtEvolutionReport => {
  return buildDebtEvolutionReport(useDb())
})
