import {
  loadDebtCardSourceOptions,
  loadDebtSourceOptions,
  loadManualDebtOptions,
  saveDebtCardSources,
  saveDebtSources,
  saveManualDebtSources,
} from '../../utils/debtEvolution'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ entryIds?: unknown; cardIds?: unknown; manualDebtIds?: unknown }>(event)
  if (!Array.isArray(body.entryIds) || !Array.isArray(body.cardIds) || !Array.isArray(body.manualDebtIds)) {
    throw createError({ statusCode: 400, statusMessage: 'Informe as dívidas.' })
  }
  const entryIds = body.entryIds.map(Number)
  const cardIds = body.cardIds.map(Number)
  const manualDebtIds = body.manualDebtIds.map(Number)
  if (entryIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida inválida.' })
  }
  if (cardIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Cartão inválido.' })
  }
  if (manualDebtIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Dívida avulsa inválida.' })
  }
  const db = useDb()
  saveDebtSources(db, entryIds)
  saveDebtCardSources(db, cardIds)
  saveManualDebtSources(db, manualDebtIds)
  return {
    sources: loadDebtSourceOptions(db),
    cards: loadDebtCardSourceOptions(db),
    manualDebts: loadManualDebtOptions(db),
  }
})
