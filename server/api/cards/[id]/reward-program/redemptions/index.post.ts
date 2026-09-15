import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import type { CardRewardRedemptionPayload } from '~/types/cardReward'
import { roundMoney } from '~/utils/dateMoney'
import { buildCardInvoice } from '../../../../../utils/cardInvoice'
import { parseCardIdParam } from '../../../../../utils/cardPayload'
import {
  loadCardRewardProgram,
  parseDestination,
  parseRewardDate,
  parseRewardNotes,
  rewardBadRequest,
} from '../../../../../utils/cardRewards'

function parsePayload(body: unknown): CardRewardRedemptionPayload {
  if (!body || typeof body !== 'object') {
    rewardBadRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  const destination = parseDestination(raw.destination)
  if (
    typeof raw.pointsUsed !== 'number' ||
    !Number.isInteger(raw.pointsUsed) ||
    raw.pointsUsed <= 0 ||
    raw.pointsUsed > 1_000_000_000
  ) {
    rewardBadRequest('Informe uma quantidade válida de pontos.')
  }

  let invoiceMonth: string | null = null
  let accountId: number | null = null
  if (destination === 'invoice') {
    if (typeof raw.invoiceMonth !== 'string' || !/^\d{4}-\d{2}$/.test(raw.invoiceMonth)) {
      rewardBadRequest('Informe a fatura que receberá o crédito.')
    }
    invoiceMonth = raw.invoiceMonth
  } else {
    if (
      typeof raw.accountId !== 'number' ||
      !Number.isInteger(raw.accountId) ||
      raw.accountId <= 0
    ) {
      rewardBadRequest('Selecione a conta que receberá o dinheiro.')
    }
    accountId = raw.accountId
  }

  return {
    destination,
    pointsUsed: raw.pointsUsed,
    redeemedAt: parseRewardDate(raw.redeemedAt, 'Data do resgate'),
    invoiceMonth,
    accountId,
    notes: parseRewardNotes(raw.notes),
  }
}

function loadCard(db: ReturnType<typeof useDb>, cardId: number): Card {
  const row = db
    .prepare(
      `SELECT id, name, bank_key AS bankKey, bank_name AS bankName, color,
              last_four AS lastFour, credit_limit AS creditLimit,
              closing_day AS closingDay, due_day AS dueDay, active,
              created_at AS createdAt
       FROM cards WHERE id = ?`,
    )
    .get(cardId) as
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
    throw createError({ statusCode: 404, statusMessage: 'Cartão não encontrado.' })
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
  const card = loadCard(db, cardId)
  const program = loadCardRewardProgram(db, cardId)
  if (!program) rewardBadRequest('Cadastre o programa de pontos primeiro.')
  if (payload.pointsUsed > program.pointsBalance) {
    rewardBadRequest('O resgate supera o saldo disponível de pontos.')
  }

  const cashAmount = roundMoney(
    (payload.pointsUsed / 1000) * program.valuePerThousand,
  )
  if (cashAmount <= 0) {
    rewardBadRequest('A quantidade informada não gera valor para resgate.')
  }
  const createdAt = todayLocal()

  db.transaction(() => {
    let invoiceRewardId: number | null = null
    let entryId: number | null = null

    if (payload.destination === 'invoice') {
      const payment = db
        .prepare(
          `SELECT 1 FROM card_invoice_payments
           WHERE card_id = ? AND invoice_month = ?`,
        )
        .get(cardId, payload.invoiceMonth)
      if (payment) rewardBadRequest('Não é possível alterar uma fatura já paga.')

      const invoice = buildCardInvoice(db, card, payload.invoiceMonth!)
      if (cashAmount > invoice.total) {
        rewardBadRequest('O crédito não pode superar o valor atual da fatura.')
      }
      const reward = db
        .prepare(
          `INSERT INTO card_invoice_rewards (
             card_id, invoice_month, program, points_used, credit_amount,
             credited_at, notes, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          cardId,
          payload.invoiceMonth,
          program.name,
          payload.pointsUsed,
          cashAmount,
          payload.redeemedAt,
          payload.notes,
          createdAt,
          createdAt,
        )
      invoiceRewardId = Number(reward.lastInsertRowid)
    } else {
      const account = db
        .prepare('SELECT id FROM accounts WHERE id = ?')
        .get(payload.accountId)
      if (!account) rewardBadRequest('Conta de destino não encontrada.')

      const status = payload.redeemedAt <= todayLocal() ? 'received' : 'pending'
      const entry = db
        .prepare(
          `INSERT INTO entries (
             type, account_id, destination_account_id, card_id, category_id,
             description, amount, statement_name, notes, recurrence, date,
             end_date, installment_count, installment_index, group_id, status,
             created_at, payment_state, payment_date, month_end
           ) VALUES (
             'income', ?, NULL, NULL, NULL, ?, ?, ?, ?, 'single', ?,
             NULL, NULL, NULL, NULL, ?, ?, 'auto', NULL, 0
           )`,
        )
        .run(
          payload.accountId,
          `Resgate de pontos ${program.name}`,
          cashAmount,
          program.name,
          payload.notes,
          payload.redeemedAt,
          status,
          createdAt,
        )
      entryId = Number(entry.lastInsertRowid)
    }

    db.prepare(
      `INSERT INTO card_reward_redemptions (
         program_id, destination, invoice_month, invoice_reward_id,
         account_id, entry_id, points_used, cash_amount, redeemed_at,
         notes, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      program.id,
      payload.destination,
      payload.invoiceMonth,
      invoiceRewardId,
      payload.accountId,
      entryId,
      payload.pointsUsed,
      cashAmount,
      payload.redeemedAt,
      payload.notes,
      createdAt,
    )

    const updated = db
      .prepare(
        `UPDATE card_reward_programs
         SET points_balance = points_balance - ?, updated_at = ?
         WHERE id = ? AND points_balance >= ?`,
      )
      .run(payload.pointsUsed, createdAt, program.id, payload.pointsUsed)
    if (updated.changes !== 1) {
      rewardBadRequest('Saldo de pontos insuficiente para o resgate.')
    }
  })()

  setResponseStatus(event, 201)
  return loadCardRewardProgram(db, cardId)
})
