import { parseCardIdParam } from '../../utils/cardPayload'

export default defineEventHandler((event) => {
  const id = parseCardIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  // Nesta fase não há compras/faturas vinculadas — exclusão hard ok.
  // Quando houver vínculos, bloquear ou soft-delete (active = 0).
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(id)

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  return { ok: true }
})
