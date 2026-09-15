import { parseCardIdParam } from '../../../../../utils/cardPayload'

function parseRewardId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Crédito inválido.' })
  }
  return id
}

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const rewardId = parseRewardId(getRouterParam(event, 'rewardId'))
  const db = useDb()
  const reward = db
    .prepare(
      `SELECT invoice_month AS invoiceMonth
       FROM card_invoice_rewards
       WHERE id = ? AND card_id = ?`,
    )
    .get(rewardId, cardId) as { invoiceMonth: string } | undefined

  if (!reward) {
    throw createError({ statusCode: 404, statusMessage: 'Crédito não encontrado.' })
  }
  const payment = db
    .prepare(
      `SELECT 1 FROM card_invoice_payments
       WHERE card_id = ? AND invoice_month = ?`,
    )
    .get(cardId, reward.invoiceMonth)
  if (payment) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não é possível alterar uma fatura já paga.',
    })
  }

  const redemption = db
    .prepare(
      `SELECT id, program_id AS programId, points_used AS pointsUsed
       FROM card_reward_redemptions
       WHERE invoice_reward_id = ?`,
    )
    .get(rewardId) as
    | { id: number; programId: number; pointsUsed: number }
    | undefined

  db.transaction(() => {
    if (redemption) {
      db.prepare('DELETE FROM card_reward_redemptions WHERE id = ?').run(
        redemption.id,
      )
      db.prepare(
        `UPDATE card_reward_programs
         SET points_balance = points_balance + ?, updated_at = ?
         WHERE id = ?`,
      ).run(redemption.pointsUsed, todayLocal(), redemption.programId)
    }
    db.prepare(
      'DELETE FROM card_invoice_rewards WHERE id = ? AND card_id = ?',
    ).run(rewardId, cardId)
  })()

  return { ok: true }
})
