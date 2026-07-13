export default defineEventHandler((event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  // Categorias associadas voltam para "sem supercategoria" (ON DELETE SET NULL).
  const result = db.prepare('DELETE FROM supercategories WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Supercategoria não encontrada.',
    })
  }

  return { ok: true }
})
