import { buildFinancialSecurityReport, saveFinancialSecuritySettings } from '../../utils/financialSecurity'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ assetIds?: unknown; costMode?: unknown }>(event)
  if (!Array.isArray(body.assetIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe os patrimônios.' })
  }
  const assetIds = body.assetIds.map(Number)
  if (assetIds.some(id => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Patrimônio inválido.' })
  }
  if (body.costMode !== 'historical' && body.costMode !== 'projected') {
    throw createError({ statusCode: 400, statusMessage: 'Critério de custo inválido.' })
  }
  saveFinancialSecuritySettings(useDb(), assetIds, body.costMode)
  return buildFinancialSecurityReport(useDb())
})
