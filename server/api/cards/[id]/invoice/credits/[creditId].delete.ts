import { parseCardIdParam } from '../../../../../utils/cardPayload'

function parseCreditId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Estorno inválido.' })
  }
  return id
}

export default defineEventHandler((event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const creditId = parseCreditId(getRouterParam(event, 'creditId'))
  const db = useDb()
  const credit = db
    .prepare(
      `SELECT invoice_month AS invoiceMonth
       FROM card_invoice_credits
       WHERE id = ? AND card_id = ?`,
    )
    .get(creditId, cardId) as { invoiceMonth: string } | undefined

  if (!credit) {
    throw createError({ statusCode: 404, statusMessage: 'Estorno não encontrado.' })
  }
  const payment = db
    .prepare(
      `SELECT 1 FROM card_invoice_payments
       WHERE card_id = ? AND invoice_month = ?`,
    )
    .get(cardId, credit.invoiceMonth)
  if (payment) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não é possível alterar uma fatura já paga.',
    })
  }

  db.prepare(
    'DELETE FROM card_invoice_credits WHERE id = ? AND card_id = ?',
  ).run(creditId, cardId)

  return { ok: true }
})
