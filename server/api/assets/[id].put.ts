export default defineEventHandler(async (event) => {
  const id = parseAssetId(getRouterParam(event, 'id'))
  const payload = parseAssetPayload(await readBody(event))
  const database = useDb()
  const current = database.prepare(
    `SELECT current_balance AS currentBalance, balance_date AS balanceDate,
            EXISTS (SELECT 1 FROM asset_movements WHERE asset_id = assets.id) AS hasMovements
     FROM assets WHERE id = ? AND active = 1`,
  ).get(id) as { currentBalance: number; balanceDate: string; hasMovements: number } | undefined
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  }
  if (
    current.hasMovements
    && (payload.currentBalance !== current.currentBalance || payload.balanceDate !== current.balanceDate)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use o extrato para corrigir o saldo sem perder o histórico.',
    })
  }

  const result = database.prepare(
    `UPDATE assets
     SET type = ?, name = ?, current_balance = ?, monthly_contribution = ?,
         annual_yield_rate = ?, balance_date = ?, notes = ?, updated_at = ?
     WHERE id = ? AND active = 1`,
  ).run(
    payload.type,
    payload.name,
    payload.currentBalance,
    payload.monthlyContribution,
    payload.annualYieldRate,
    payload.balanceDate,
    payload.notes,
    new Date().toISOString(),
    id,
  )
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  }
  return { ok: true }
})
