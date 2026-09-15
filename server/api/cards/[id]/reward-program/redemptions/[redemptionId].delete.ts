import { parseCardIdParam } from '../../../../../utils/cardPayload'

function parseRedemptionId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Resgate inválido.' })
  }
  return id
}

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const redemptionId = parseRedemptionId(
    getRouterParam(event, 'redemptionId'),
  )
  const db = useDb()
  const redemption = db
    .prepare(
      `SELECT r.id, r.program_id AS programId, r.destination,
              r.invoice_month AS invoiceMonth,
              r.invoice_reward_id AS invoiceRewardId,
              r.entry_id AS entryId, r.points_used AS pointsUsed
       FROM card_reward_redemptions r
       INNER JOIN card_reward_programs p ON p.id = r.program_id
       WHERE r.id = ? AND p.card_id = ?`,
    )
    .get(redemptionId, cardId) as
    | {
        id: number
        programId: number
        destination: 'invoice' | 'account'
        invoiceMonth: string | null
        invoiceRewardId: number | null
        entryId: number | null
        pointsUsed: number
      }
    | undefined

  if (!redemption) {
    throw createError({ statusCode: 404, statusMessage: 'Resgate não encontrado.' })
  }
  if (redemption.destination === 'invoice') {
    const payment = db
      .prepare(
        `SELECT 1 FROM card_invoice_payments
         WHERE card_id = ? AND invoice_month = ?`,
      )
      .get(cardId, redemption.invoiceMonth)
    if (payment) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Não é possível alterar uma fatura já paga.',
      })
    }
  }

  db.transaction(() => {
    db.prepare('DELETE FROM card_reward_redemptions WHERE id = ?').run(
      redemption.id,
    )
    if (redemption.invoiceRewardId) {
      db.prepare('DELETE FROM card_invoice_rewards WHERE id = ?').run(
        redemption.invoiceRewardId,
      )
    }
    if (redemption.entryId) {
      db.prepare('DELETE FROM entries WHERE id = ?').run(redemption.entryId)
    }
    db.prepare(
      `UPDATE card_reward_programs
       SET points_balance = points_balance + ?, updated_at = ?
       WHERE id = ?`,
    ).run(redemption.pointsUsed, todayLocal(), redemption.programId)
  })()

  return { ok: true }
})
