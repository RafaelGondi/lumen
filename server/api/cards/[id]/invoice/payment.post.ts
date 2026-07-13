import type { CardInvoicePaymentPayload } from '~/types/cardInvoice'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'
import { accountBalance } from '../../../../utils/accountBalance'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import { buildCardInvoice } from '../../../../utils/cardInvoice'
import { upsertCardInvoiceAdjustment } from '../../../../utils/cardInvoiceAdjustment'
import { insertCardInvoicePayment } from '../../../../utils/cardInvoicePayment'
import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string') badRequest(`${label} inválida.`)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : parseDateBr(value)
  if (!normalized) badRequest(`${label} inválida.`)
  const [year, month, day] = normalized.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    badRequest(`${label} inválida.`)
  }
  return normalized
}

function parsePayload(body: unknown): CardInvoicePaymentPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  if (typeof raw.month !== 'string' || !/^\d{4}-\d{2}$/.test(raw.month)) {
    badRequest('Informe o mês no formato YYYY-MM.')
  }
  if (typeof raw.accountId !== 'number' || !Number.isInteger(raw.accountId)) {
    badRequest('Selecione a conta debitada.')
  }

  let adjustment: number | null = null
  if (raw.adjustment !== null && raw.adjustment !== undefined) {
    if (typeof raw.adjustment !== 'number' || !Number.isFinite(raw.adjustment)) {
      badRequest('Ajuste inválido.')
    }
    if (Math.abs(raw.adjustment) > 10_000) {
      badRequest('O ajuste deve ficar entre -R$ 10.000 e R$ 10.000.')
    }
    adjustment = roundMoney(raw.adjustment)
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
    accountId: raw.accountId,
    paymentDate: parseIsoDate(raw.paymentDate, 'Data do pagamento'),
    adjustment,
    notes,
  }
}

function loadCard(id: number): Card {
  const db = useDb()
  const row = db
    .prepare(
      `SELECT
         id,
         name,
         bank_key AS bankKey,
         bank_name AS bankName,
         color,
         last_four AS lastFour,
         credit_limit AS creditLimit,
         closing_day AS closingDay,
         due_day AS dueDay,
         active,
         created_at AS createdAt
       FROM cards
       WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number
        name: string
        bankKey: BankKey
        bankName: string
        color: string
        lastFour: string | null
        creditLimit: number
        closingDay: number
        dueDay: number
        active: number
        createdAt: string
      }
    | undefined

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Cartão não encontrado.',
    })
  }

  return {
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }
}

export default defineEventHandler(async (event) => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parsePayload(await readBody(event))
  const db = useDb()
  const card = loadCard(cardId)

  const account = db
    .prepare('SELECT id, name FROM accounts WHERE id = ?')
    .get(payload.accountId) as { id: number; name: string } | undefined
  if (!account) {
    badRequest('Conta debitada inválida.')
  }

  const existing = db
    .prepare(
      `SELECT id FROM card_invoice_payments
       WHERE card_id = ? AND invoice_month = ?`,
    )
    .get(cardId, payload.month)
  if (existing) {
    badRequest('Esta fatura já foi paga.')
  }

  if (payload.adjustment !== null) {
    upsertCardInvoiceAdjustment(
      db,
      cardId,
      payload.month,
      payload.adjustment,
      null,
    )
  }

  const invoice = buildCardInvoice(db, card, payload.month)
  if (invoice.status === 'paid') {
    badRequest('Esta fatura já foi paga.')
  }
  if (invoice.total <= 0) {
    badRequest('Não há valor a pagar nesta fatura.')
  }

  const createdAt = todayLocal()
  const pay = db.transaction(() => {
    const entryResult = db
      .prepare(
        `INSERT INTO entries (
           type, account_id, card_id, category_id, description, amount,
           statement_name, notes, recurrence, date, end_date,
           installment_count, installment_index, group_id, status, created_at,
           payment_state, payment_date, month_end
         ) VALUES (
           'expense', @accountId, NULL, NULL, @description, @amount,
           NULL, @notes, 'single', @date, NULL,
           NULL, NULL, NULL, 'paid', @createdAt,
           'paid', @paymentDate, 0
         )`,
      )
      .run({
        accountId: payload.accountId,
        description: `Fatura ${card.name} ${invoice.monthLabel}`,
        amount: invoice.total,
        notes: payload.notes,
        date: payload.paymentDate,
        createdAt,
        paymentDate: payload.paymentDate,
      })

    const entryId = Number(entryResult.lastInsertRowid)
    insertCardInvoicePayment(db, {
      cardId,
      invoiceMonth: payload.month,
      accountId: payload.accountId,
      entryId,
      entriesSubtotal: invoice.entriesSubtotal,
      adjustment: invoice.adjustment,
      totalPaid: invoice.total,
      paymentDate: payload.paymentDate,
      notes: payload.notes,
    })

    return {
      entryId,
      balance: accountBalance(db, payload.accountId),
      invoice: buildCardInvoice(db, card, payload.month),
    }
  })

  setResponseStatus(event, 201)
  return pay()
})
