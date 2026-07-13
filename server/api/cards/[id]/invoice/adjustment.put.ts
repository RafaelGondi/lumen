import type { CardInvoiceAdjustmentPayload } from '~/types/cardInvoice'
import { roundMoney } from '~/utils/dateMoney'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import { upsertCardInvoiceAdjustment } from '../../../../utils/cardInvoiceAdjustment'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parsePayload(body: unknown): CardInvoiceAdjustmentPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) {
    badRequest('Informe o mês no formato YYYY-MM.')
  }
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount)) {
    badRequest('Informe um valor de ajuste válido.')
  }
  // Limite razoável para arredondamento / correção pontual.
  if (Math.abs(raw.amount) > 10_000) {
    badRequest('O ajuste deve ficar entre -R$ 10.000 e R$ 10.000.')
  }

  let notes: string | null = null
  if (raw.notes !== null && raw.notes !== undefined && raw.notes !== '') {
    if (typeof raw.notes !== 'string') badRequest('Notas inválidas.')
    const trimmed = raw.notes.trim()
    if (trimmed.length > 200) {
      badRequest('Notas com no máximo 200 caracteres.')
    }
    notes = trimmed || null
  }

  return {
    month: raw.month,
    amount: roundMoney(raw.amount),
    notes,
  }
}

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parsePayload(await readBody(event))
  const db = useDb()

  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId)
  if (!card) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  const row = upsertCardInvoiceAdjustment(
    db,
    cardId,
    payload.month,
    payload.amount,
    payload.notes,
  )

  return {
    cardId,
    month: payload.month,
    amount: row?.amount ?? 0,
    notes: row?.notes ?? null,
  }
})
