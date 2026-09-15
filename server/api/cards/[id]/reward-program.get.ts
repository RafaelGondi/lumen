import { parseCardIdParam } from '../../../utils/cardPayload'
import {
  assertCardExists,
  loadCardRewardProgram,
} from '../../../utils/cardRewards'

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const db = useDb()
  assertCardExists(db, cardId)
  return loadCardRewardProgram(db, cardId)
})
