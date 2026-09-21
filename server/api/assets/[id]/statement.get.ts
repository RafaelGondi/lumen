export default defineEventHandler((event) => {
  const assetId = parseAssetId(getRouterParam(event, 'id'))
  return buildAssetStatement(assetId)
})
