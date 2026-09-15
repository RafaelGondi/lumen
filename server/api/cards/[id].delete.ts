import { parseCardIdParam } from '../../utils/cardPayload'

export default defineEventHandler((event) => {
  const id = parseCardIdParam(getRouterParam(event, 'id'))
  const db = useDb()

  const remove = db.transaction(() => {
    const program = db
      .prepare('SELECT id FROM card_reward_programs WHERE card_id = ?')
      .get(id) as { id: number } | undefined

    if (program) {
      // Bancos já inicializados podem ter as FKs históricas como RESTRICT.
      // Removemos o histórico na ordem correta antes de excluir o programa.
      // Entradas em conta criadas por resgates são mantidas: representam
      // dinheiro que efetivamente entrou e não dependem mais do cartão.
      db.prepare('DELETE FROM card_reward_accruals WHERE program_id = ?').run(
        program.id,
      )
      db.prepare('DELETE FROM card_reward_adjustments WHERE program_id = ?').run(
        program.id,
      )
      db.prepare('DELETE FROM card_reward_redemptions WHERE program_id = ?').run(
        program.id,
      )
      db.prepare('DELETE FROM card_reward_programs WHERE id = ?').run(program.id)
    }

    return db.prepare('DELETE FROM cards WHERE id = ?').run(id)
  })

  const result = remove()

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  return { ok: true }
})
