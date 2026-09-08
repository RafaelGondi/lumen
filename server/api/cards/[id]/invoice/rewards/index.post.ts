import type { CardInvoiceRewardPayload } from '~/types/cardInvoice'
import type { Card } from '~/types/card'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'
import { buildCardInvoice } from '../../../../../utils/cardInvoice'
import { parseCardIdParam } from '../../../../../utils/cardPayload'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseIsoDate(value: unknown): string {
  if (typeof value !== 'string') badRequest('Data do crédito inválida.')
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : parseDateBr(value)
  if (!normalized) badRequest('Data do crédito inválida.')
  const [year, month, day] = normalized.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    badRequest('Data do crédito inválida.')
  }
  return normalized
}

function parsePayload(body: unknown): CardInvoiceRewardPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) {
    badRequest('Informe o mês no formato YYYY-MM.')
  }
  if (typeof raw.program !== 'string' || !raw.program.trim()) {
    badRequest('Informe o programa de pontos.')
  }
  const program = raw.program.trim()
  if (program.length > 80) {
    badRequest('Programa com no máximo 80 caracteres.')
  }
  if (
    typeof raw.pointsUsed !== 'number' ||
    !Number.isInteger(raw.pointsUsed) ||
    raw.pointsUsed <= 0 ||
    raw.pointsUsed > 1_000_000_000
  ) {
    badRequest('Informe uma quantidade válida de pontos.')
  }
  if (
    typeof raw.creditAmount !== 'number' ||
    !Number.isFinite(raw.creditAmount) ||
    raw.creditAmount <= 0 ||
    raw.creditAmount > 100_000
  ) {
    badRequest('Informe um valor de crédito válido.')
  }

  let notes: string | null = null
  if (raw.notes !== null && raw.notes !== undefined && raw.notes !== '') {
    if (typeof raw.notes !== 'string') badRequest('Notas inválidas.')
    const trimmed = raw.notes.trim()
    if (trimmed.length > 200) badRequest('Notas com no máximo 200 caracteres.')
    notes = trimmed || null
  }

  return {
    month: raw.month,
    program,
    pointsUsed: raw.pointsUsed,
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
    badRequest('O crédito não pode ser maior que o valor atual da fatura.')
  }

  const now = todayLocal()
  const result = db
    .prepare(
      `INSERT INTO card_invoice_rewards (
         card_id, invoice_month, program, points_used, credit_amount,
         credited_at, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      cardId,
      payload.month,
      payload.program,
      payload.pointsUsed,
      payload.creditAmount,
      payload.creditedAt,
      payload.notes,
      now,
      now,
    )

  setResponseStatus(event, 201)
  return {
    id: Number(result.lastInsertRowid),
    ...payload,
  }
})
