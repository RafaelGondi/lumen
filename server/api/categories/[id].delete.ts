export default defineEventHandler((event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Categoria não encontrada.',
    })
  }

  return { ok: true }
})
