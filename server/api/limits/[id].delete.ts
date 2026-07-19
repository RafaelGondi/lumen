import { parseIdParam } from '../../utils/categoryPayload'

export default defineEventHandler((event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  const result = db
    .prepare('DELETE FROM spending_limits WHERE id = ?')
    .run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Limite não encontrado.',
    })
  }

  return { ok: true }
})
