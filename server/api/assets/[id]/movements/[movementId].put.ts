export default defineEventHandler(async (event) => {
  const assetId = parseAssetId(getRouterParam(event, 'id'))
  const movementId = parseAssetMovementId(getRouterParam(event, 'movementId'))
  const payload = parseAssetMovementPayload(await readBody(event))
  const database = useDb()
  const asset = database.prepare(
    'SELECT balance_date AS balanceDate FROM assets WHERE id = ? AND active = 1',
  ).get(assetId) as { balanceDate: string } | undefined
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  if (payload.movementDate < asset.balanceDate) {
    throw createError({ statusCode: 400, statusMessage: 'A movimentação não pode ser anterior ao saldo inicial.' })
  }

  const result = database.prepare(
    `UPDATE asset_movements
     SET kind = ?, amount = ?, movement_date = ?, scheduled_date = ?, notes = ?, updated_at = ?
     WHERE id = ? AND asset_id = ?`,
  ).run(payload.kind, payload.amount, payload.movementDate, payload.scheduledDate, payload.notes, new Date().toISOString(), movementId, assetId)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Movimentação não encontrada.' })
  }
  return { ok: true }
})
