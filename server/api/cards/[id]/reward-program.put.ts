import { parseCardIdParam } from '../../../utils/cardPayload'
import {
  assertCardExists,
  loadCardRewardProgram,
  parseRewardProgramPayload,
} from '../../../utils/cardRewards'

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parseRewardProgramPayload(await readBody(event))
  const db = useDb()
  assertCardExists(db, cardId)
  const now = todayLocal()

  db.prepare(
    `INSERT INTO card_reward_programs (
       card_id, name, points_balance, value_per_thousand,
       earning_basis, points_per_unit, projection_currency_rate,
       default_destination, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(card_id) DO UPDATE SET
       name = excluded.name,
       points_balance = excluded.points_balance,
       value_per_thousand = excluded.value_per_thousand,
       earning_basis = excluded.earning_basis,
       points_per_unit = excluded.points_per_unit,
       projection_currency_rate = excluded.projection_currency_rate,
       default_destination = excluded.default_destination,
       updated_at = excluded.updated_at`,
  ).run(
    cardId,
    payload.name,
    payload.pointsBalance,
    payload.valuePerThousand,
    payload.earningBasis,
    payload.pointsPerUnit,
    payload.projectionCurrencyRate,
    payload.defaultDestination,
    now,
    now,
  )

  return loadCardRewardProgram(db, cardId)
})
