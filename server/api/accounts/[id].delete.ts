export default defineEventHandler((event) => {
  const id = parseAccountIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conta não encontrada.',
    })
  }

  return { ok: true }
})
