export default defineEventHandler((event) => {
  const query = getQuery(event)
  const months = parseProjectionMonths(query.months)
  const assetId = query.assetId === undefined ? undefined : Number(query.assetId)
  if (assetId !== undefined && (!Number.isInteger(assetId) || assetId <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Patrimônio inválido.' })
  }
  return buildAssetProjection(months, assetId)
})
