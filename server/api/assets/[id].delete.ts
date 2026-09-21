export default defineEventHandler((event) => {
  const id = parseAssetId(getRouterParam(event, 'id'))
  const result = useDb().prepare(
    `UPDATE assets SET active = 0, updated_at = ? WHERE id = ? AND active = 1`,
  ).run(new Date().toISOString(), id)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Patrimônio não encontrado.' })
  }
  return { ok: true }
})
