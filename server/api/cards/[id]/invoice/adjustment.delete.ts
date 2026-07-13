import { parseCardIdParam } from '../../../../utils/cardPayload'
import { removeCardInvoiceAdjustment } from '../../../../utils/cardInvoiceAdjustment'

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : null

  if (!month) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o mês no formato YYYY-MM.',
    })
  }

  const db = useDb()
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId)
  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  removeCardInvoiceAdjustment(db, cardId, month)
  setResponseStatus(event, 204)
  return null
})
