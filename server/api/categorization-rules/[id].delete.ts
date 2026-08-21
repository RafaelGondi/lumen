import { parseIdParam } from '../../utils/categoryPayload'

export default defineEventHandler((event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const result = useDb()
    .prepare('DELETE FROM categorization_rules WHERE id = ?')
    .run(id)
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Regra não encontrada.' })
  }
  return { ok: true }
})
