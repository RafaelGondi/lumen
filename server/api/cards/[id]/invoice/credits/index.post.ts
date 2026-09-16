import type { Card } from '~/types/card'
import type { CardInvoiceCreditPayload } from '~/types/cardInvoice'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'
import { buildCardInvoice } from '../../../../../utils/cardInvoice'
import { parseCardIdParam } from '../../../../../utils/cardPayload'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseIsoDate(value: unknown): string {
  if (typeof value !== 'string') badRequest('Data do estorno inválida.')
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : parseDateBr(value)
  if (!normalized) badRequest('Data do estorno inválida.')
  const [year, month, day] = normalized.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    badRequest('Data do estorno inválida.')
  }
  return normalized
}

function parsePayload(body: unknown): CardInvoiceCreditPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) {
    badRequest('Informe o mês no formato YYYY-MM.')
  }
  const description =
    typeof raw.description === 'string' ? raw.description.trim() : ''
  if (description.length < 2 || description.length > 120) {
    badRequest('Informe uma descrição entre 2 e 120 caracteres.')
  }
  if (
    typeof raw.creditAmount !== 'number' ||
    !Number.isFinite(raw.creditAmount) ||
    raw.creditAmount <= 0 ||
    raw.creditAmount > 1_000_000
  ) {
    badRequest('Informe um valor de estorno válido.')
  }

  let notes: string | null = null
  if (raw.notes !== null && raw.notes !== undefined && raw.notes !== '') {
    if (typeof raw.notes !== 'string') badRequest('Observação inválida.')
    const trimmed = raw.notes.trim()
    if (trimmed.length > 300) {
      badRequest('Observação com no máximo 300 caracteres.')
    }
    notes = trimmed || null
  }

  return {
    month: raw.month,
    description,
    creditAmount: roundMoney(raw.creditAmount),
    creditedAt: parseIsoDate(raw.creditedAt),
    notes,
  }
}

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parsePayload(await readBody(event))
  const db = useDb()

  const card = db
    .prepare(
      `SELECT id, name, bank_key AS bankKey, bank_name AS bankName, color,
              last_four AS lastFour, credit_limit AS creditLimit,
              closing_day AS closingDay, due_day AS dueDay, active,
              created_at AS createdAt
       FROM cards WHERE id = ?`,
    )
    .get(cardId) as
    | Omit<Card, 'usedAmount' | 'estimatedPayoffLabel' | 'active'> & {
        active: number
      }
    | undefined
  if (!card) {
    throw createError({ statusCode: 404, statusMessage: 'Cartão não encontrado.' })
  }

  const payment = db
    .prepare(
      `SELECT 1 FROM card_invoice_payments
       WHERE card_id = ? AND invoice_month = ?`,
    )
    .get(cardId, payload.month)
  if (payment) badRequest('Não é possível alterar uma fatura já paga.')

  const invoice = buildCardInvoice(
    db,
    {
      ...card,
      active: Boolean(card.active),
      usedAmount: 0,
      estimatedPayoffLabel: null,
    },
    payload.month,
  )
  if (payload.creditAmount > invoice.total) {
    badRequest('O estorno não pode ser maior que o valor atual da fatura.')
  }

  const now = todayLocal()
  const result = db
    .prepare(
      `INSERT INTO card_invoice_credits (
         card_id, invoice_month, description, credit_amount,
         credited_at, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      cardId,
      payload.month,
      payload.description,
      payload.creditAmount,
      payload.creditedAt,
      payload.notes,
      now,
      now,
    )

  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid), ...payload }
})
