import type Database from 'better-sqlite3'
import type {
  CardRewardDestination,
  CardRewardEarningBasis,
  CardRewardProgram,
  CardRewardProgramPayload,
  CardRewardRedemption,
} from '~/types/cardReward'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'

type ProgramRow = Omit<
  CardRewardProgram,
  'equivalentBalance' | 'accruals' | 'adjustments' | 'redemptions'
>

export function rewardBadRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

export function parseRewardDate(value: unknown, label = 'Data'): string {
  if (typeof value !== 'string') rewardBadRequest(`${label} inválida.`)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : parseDateBr(value)
  if (!normalized) rewardBadRequest(`${label} inválida.`)
  const [year, month, day] = normalized.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    rewardBadRequest(`${label} inválida.`)
  }
  return normalized
}

export function parseRewardNotes(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') rewardBadRequest('Observação inválida.')
  const notes = value.trim()
  if (notes.length > 300) {
    rewardBadRequest('Observação com no máximo 300 caracteres.')
  }
  return notes || null
}

export function parseRewardProgramPayload(
  body: unknown,
): CardRewardProgramPayload {
  if (!body || typeof body !== 'object') {
    rewardBadRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || name.length > 80) {
    rewardBadRequest('Informe um programa com até 80 caracteres.')
  }
  if (
    typeof raw.pointsBalance !== 'number' ||
    !Number.isInteger(raw.pointsBalance) ||
    raw.pointsBalance < 0 ||
    raw.pointsBalance > 1_000_000_000
  ) {
    rewardBadRequest('Informe um saldo válido de pontos.')
  }
  if (
    typeof raw.valuePerThousand !== 'number' ||
    !Number.isFinite(raw.valuePerThousand) ||
    raw.valuePerThousand <= 0 ||
    raw.valuePerThousand > 100_000
  ) {
    rewardBadRequest('Informe uma equivalência válida por mil pontos.')
  }
  if (raw.defaultDestination !== 'invoice' && raw.defaultDestination !== 'account') {
    rewardBadRequest('Selecione o destino padrão do resgate.')
  }
  if (raw.earningBasis !== 'brl' && raw.earningBasis !== 'usd') {
    rewardBadRequest('Selecione como o cartão acumula pontos.')
  }
  if (
    typeof raw.pointsPerUnit !== 'number' ||
    !Number.isFinite(raw.pointsPerUnit) ||
    raw.pointsPerUnit <= 0 ||
    raw.pointsPerUnit > 1_000
  ) {
    rewardBadRequest('Informe uma pontuação válida por unidade monetária.')
  }
  let projectionCurrencyRate: number | null = null
  if (
    raw.projectionCurrencyRate !== null &&
    raw.projectionCurrencyRate !== undefined
  ) {
    if (
      typeof raw.projectionCurrencyRate !== 'number' ||
      !Number.isFinite(raw.projectionCurrencyRate) ||
      raw.projectionCurrencyRate <= 0 ||
      raw.projectionCurrencyRate > 1_000
    ) {
      rewardBadRequest('Informe uma cotação de referência válida.')
    }
    projectionCurrencyRate = roundMoney(raw.projectionCurrencyRate)
  }

  return {
    name,
    pointsBalance: raw.pointsBalance,
    valuePerThousand: roundMoney(raw.valuePerThousand),
    earningBasis: raw.earningBasis,
    pointsPerUnit: Math.round(raw.pointsPerUnit * 10000) / 10000,
    projectionCurrencyRate:
      raw.earningBasis === 'usd' ? projectionCurrencyRate : null,
    defaultDestination: raw.defaultDestination,
  }
}

export function loadCardRewardProgram(
  db: Database.Database,
  cardId: number,
): CardRewardProgram | null {
  const program = db
    .prepare(
      `SELECT id, card_id AS cardId, name,
              points_balance AS pointsBalance,
              value_per_thousand AS valuePerThousand,
              earning_basis AS earningBasis,
              points_per_unit AS pointsPerUnit,
              projection_currency_rate AS projectionCurrencyRate,
              default_destination AS defaultDestination
       FROM card_reward_programs
       WHERE card_id = ?`,
    )
    .get(cardId) as ProgramRow | undefined

  if (!program) return null

  const accruals = db
    .prepare(
      `SELECT id, invoice_month AS invoiceMonth, payment_id AS paymentId,
              eligible_amount AS eligibleAmount,
              earning_basis AS earningBasis,
              points_per_unit AS pointsPerUnit,
              currency_rate AS currencyRate,
              points_earned AS pointsEarned,
              created_at AS createdAt
       FROM card_reward_accruals
       WHERE program_id = ?
       ORDER BY invoice_month DESC, id DESC`,
    )
    .all(program.id) as CardRewardProgram['accruals']

  const redemptions = db
    .prepare(
      `SELECT r.id, r.destination,
              r.invoice_month AS invoiceMonth,
              r.invoice_reward_id AS invoiceRewardId,
              r.account_id AS accountId,
              a.name AS accountName,
              r.entry_id AS entryId,
              r.points_used AS pointsUsed,
              r.cash_amount AS cashAmount,
              r.redeemed_at AS redeemedAt,
              r.notes
       FROM card_reward_redemptions r
       LEFT JOIN accounts a ON a.id = r.account_id
       WHERE r.program_id = ?
       ORDER BY r.redeemed_at DESC, r.id DESC`,
    )
    .all(program.id) as CardRewardRedemption[]

  const adjustments = db
    .prepare(
      `SELECT id, points_delta AS pointsDelta,
              adjusted_at AS adjustedAt, reason, created_at AS createdAt
       FROM card_reward_adjustments
       WHERE program_id = ?
       ORDER BY adjusted_at DESC, id DESC`,
    )
    .all(program.id) as CardRewardProgram['adjustments']

  return {
    ...program,
    valuePerThousand: roundMoney(program.valuePerThousand),
    projectionCurrencyRate:
      program.projectionCurrencyRate === null
        ? null
        : roundMoney(program.projectionCurrencyRate),
    equivalentBalance: roundMoney(
      (program.pointsBalance / 1000) * program.valuePerThousand,
    ),
    accruals: accruals.map((item) => ({
      ...item,
      eligibleAmount: roundMoney(item.eligibleAmount),
      currencyRate:
        item.currencyRate === null ? null : roundMoney(item.currencyRate),
    })),
    adjustments,
    redemptions: redemptions.map((item) => ({
      ...item,
      cashAmount: roundMoney(item.cashAmount),
    })),
  }
}

export function calculateRewardPoints(
  eligibleAmount: number,
  earningBasis: CardRewardEarningBasis,
  pointsPerUnit: number,
  currencyRate: number | null,
) {
  const units =
    earningBasis === 'usd'
      ? eligibleAmount / (currencyRate ?? Number.NaN)
      : eligibleAmount
  return Number.isFinite(units) ? Math.floor(units * pointsPerUnit) : 0
}

export function assertCardExists(db: Database.Database, cardId: number) {
  const card = db.prepare('SELECT id FROM cards WHERE id = ?').get(cardId)
  if (!card) {
    throw createError({ statusCode: 404, statusMessage: 'Cartão não encontrado.' })
  }
}

export function parseDestination(value: unknown): CardRewardDestination {
  if (value !== 'invoice' && value !== 'account') {
    rewardBadRequest('Selecione o destino do resgate.')
  }
  return value
}
