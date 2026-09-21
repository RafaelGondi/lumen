export default defineEventHandler(async (event) => {
  const assetId = parseAssetId(getRouterParam(event, 'id'))
  const payload = parseAssetMovementPayload(await readBody(event))
  const database = useDb()
  const asset = database.prepare(
    'SELECT balance_date AS balanceDate FROM assets WHERE id = ? AND active = 1',
  ).get(assetId) as { balanceDate: string } | undefined
  if (!asset) throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  if (payload.movementDate < asset.balanceDate) {
    throw createError({ statusCode: 400, statusMessage: 'A movimentação não pode ser anterior ao saldo inicial.' })
  }
  if (payload.scheduledDate && payload.scheduledDate < asset.balanceDate) {
    throw createError({ statusCode: 400, statusMessage: 'A previsão substituída é anterior ao saldo inicial.' })
  }

  const now = new Date().toISOString()
  if (payload.scheduledDate) {
    const existing = database.prepare(
      `SELECT id FROM asset_movements
       WHERE asset_id = ? AND kind = ? AND scheduled_date = ?`,
    ).get(assetId, payload.kind, payload.scheduledDate) as { id: number } | undefined
    if (existing) {
      database.prepare(
        `UPDATE asset_movements
         SET amount = ?, movement_date = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      ).run(payload.amount, payload.movementDate, payload.notes, now, existing.id)
      return { id: existing.id }
    }
  }

  const result = database.prepare(
    `INSERT INTO asset_movements (
       asset_id, kind, amount, movement_date, scheduled_date, notes, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(assetId, payload.kind, payload.amount, payload.movementDate, payload.scheduledDate, payload.notes, now, now)
  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid) }
})
