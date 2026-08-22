export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cenário inválido.' })
  }
  const result = useDb()
    .prepare('DELETE FROM projection_scenarios WHERE id = ?')
    .run(id)
  if (!result.changes) {
    throw createError({ statusCode: 404, statusMessage: 'Cenário não encontrado.' })
  }
  return { ok: true }
})
