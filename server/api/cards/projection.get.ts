import type { CardsProjectionSummary } from '~/types/cardInvoice'
import { buildConsolidatedCardsProjection } from '../../utils/cardInvoice'

export default defineEventHandler((): CardsProjectionSummary => {
  return buildConsolidatedCardsProjection(useDb())
})
