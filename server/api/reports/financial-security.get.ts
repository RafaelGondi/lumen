import type { FinancialSecurityReport } from '~/types/financialSecurity'
import { buildFinancialSecurityReport } from '../../utils/financialSecurity'

export default defineEventHandler((event): FinancialSecurityReport => {
  const query = getQuery(event)
  const costMode = query.costMode === 'historical' || query.costMode === 'projected'
    ? query.costMode
    : undefined
  return buildFinancialSecurityReport(useDb(), costMode)
})
