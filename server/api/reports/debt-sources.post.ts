import {
  loadDebtCardSourceOptions,
  loadDebtSourceOptions,
  saveDebtCardSources,
  saveDebtSources,
} from '../../utils/debtEvolution'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ entryIds?: unknown; cardIds?: unknown }>(event)
  if (!Array.isArray(body.entryIds) || !Array.isArray(body.cardIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe as dívidas.' })
  }
  const entryIds = body.entryIds.map(Number)
  const cardIds = body.cardIds.map(Number)
  if (entryIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida inválida.' })
  }
  if (cardIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Cartão inválido.' })
  }
  const db = useDb()
  saveDebtSources(db, entryIds)
  saveDebtCardSources(db, cardIds)
  return {
    sources: loadDebtSourceOptions(db),
    cards: loadDebtCardSourceOptions(db),
  }
})
