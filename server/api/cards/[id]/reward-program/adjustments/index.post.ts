import type { CardRewardAdjustmentPayload } from '~/types/cardReward'
import { parseCardIdParam } from '../../../../../utils/cardPayload'
import {
  loadCardRewardProgram,
  parseRewardDate,
  rewardBadRequest,
} from '../../../../../utils/cardRewards'

function parsePayload(body: unknown): CardRewardAdjustmentPayload {
  if (!body || typeof body !== 'object') {
    rewardBadRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  const pointsDelta = raw.pointsDelta
  if (
    typeof pointsDelta !== 'number' ||
    !Number.isInteger(pointsDelta) ||
    pointsDelta === 0 ||
    Math.abs(pointsDelta) > 1_000_000_000
  ) {
    rewardBadRequest('Informe uma quantidade válida de pontos.')
  }
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
  if (reason.length < 3 || reason.length > 200) {
    rewardBadRequest('Informe um motivo entre 3 e 200 caracteres.')
  }
  return {
    pointsDelta,
    adjustedAt: parseRewardDate(raw.adjustedAt, 'Data do ajuste'),
    reason,
  }
}

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parsePayload(await readBody(event))
  const db = useDb()
  const program = db
    .prepare(
      `SELECT id, points_balance AS pointsBalance
       FROM card_reward_programs WHERE card_id = ?`,
    )
    .get(cardId) as { id: number; pointsBalance: number } | undefined

  if (!program) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cadastre o programa de pontos antes de fazer ajustes.',
    })
  }
  if (program.pointsBalance + payload.pointsDelta < 0) {
    rewardBadRequest('O ajuste deixaria o saldo de pontos negativo.')
  }

  const now = todayLocal()
  db.transaction(() => {
    db.prepare(
      `INSERT INTO card_reward_adjustments (
         program_id, points_delta, adjusted_at, reason, created_at
       ) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      program.id,
      payload.pointsDelta,
      payload.adjustedAt,
      payload.reason,
      now,
    )
    db.prepare(
      `UPDATE card_reward_programs
       SET points_balance = points_balance + ?, updated_at = ?
       WHERE id = ?`,
    ).run(payload.pointsDelta, now, program.id)
  })()

  setResponseStatus(event, 201)
  return loadCardRewardProgram(db, cardId)
})
