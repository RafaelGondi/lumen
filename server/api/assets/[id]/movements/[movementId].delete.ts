export default defineEventHandler((event) => {
  const assetId = parseAssetId(getRouterParam(event, 'id'))
  const movementId = parseAssetMovementId(getRouterParam(event, 'movementId'))
  const result = useDb().prepare(
    'DELETE FROM asset_movements WHERE id = ? AND asset_id = ?',
  ).run(movementId, assetId)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Movimentação não encontrada.' })
  }
  return { ok: true }
})
