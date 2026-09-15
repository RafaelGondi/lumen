import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import type { CardRewardProjection } from '~/types/cardReward'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { parseCardIdParam } from '../../../../utils/cardPayload'
import { buildCardInvoice } from '../../../../utils/cardInvoice'
import { calculateRewardPoints } from '../../../../utils/cardRewards'

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(year!, value! - 1, 1))
    .replace('.', '')
}

export default defineEventHandler((event): CardRewardProjection => {
  const cardId = parseCardIdParam(getRouterParam(event, 'id'))
  const db = useDb()
  const cardRow = db
    .prepare(
      `SELECT id, name, bank_key AS bankKey, bank_name AS bankName, color,
              last_four AS lastFour, credit_limit AS creditLimit,
              closing_day AS closingDay, due_day AS dueDay, active,
              created_at AS createdAt
       FROM cards WHERE id = ?`,
    )
    .get(cardId) as
    | Omit<Card, 'active' | 'usedAmount' | 'estimatedPayoffLabel'> & {
        active: number
      }
    | undefined
  const program = db
    .prepare(
      `SELECT id, points_balance AS pointsBalance,
              earning_basis AS earningBasis,
              points_per_unit AS pointsPerUnit,
              projection_currency_rate AS currencyRate
       FROM card_reward_programs WHERE card_id = ?`,
    )
    .get(cardId) as
    | {
        id: number
        pointsBalance: number
        earningBasis: 'brl' | 'usd'
        pointsPerUnit: number
        currencyRate: number | null
      }
    | undefined

  if (!cardRow || !program) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Programa de pontos não encontrado.',
    })
  }
  const card: Card = {
    ...cardRow,
    bankKey: cardRow.bankKey as BankKey,
    active: Boolean(cardRow.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }
  const currentMonth = todayLocal().slice(0, 7)
  const hasAccrual = (month: string) =>
    Boolean(
      db
        .prepare(
          'SELECT 1 FROM card_reward_accruals WHERE program_id = ? AND invoice_month = ?',
        )
        .get(program.id, month),
    )
  const currentInvoice = buildCardInvoice(db, card, currentMonth)
  const firstMonth =
    currentInvoice.status === 'paid' || hasAccrual(currentMonth)
      ? addMonthsLocal(`${currentMonth}-01`, 1).slice(0, 7)
      : currentMonth
  let projectedBalance = program.pointsBalance
  const points = Array.from({ length: 6 }, (_, index) => {
    const month = addMonthsLocal(`${firstMonth}-01`, index).slice(0, 7)
    const invoice = buildCardInvoice(db, card, month)
    const alreadyAccrued = hasAccrual(month)
    const projectedPoints =
      invoice.status === 'paid' || alreadyAccrued
        ? 0
        : calculateRewardPoints(
            invoice.entriesSubtotal,
            program.earningBasis,
            program.pointsPerUnit,
            program.currencyRate,
          )
    projectedBalance += projectedPoints
    return {
      month,
      monthLabel: monthLabel(month),
      eligibleAmount: roundMoney(invoice.entriesSubtotal),
      projectedPoints,
      projectedBalance,
    }
  })
  const totalProjectedPoints = points.reduce(
    (sum, point) => sum + point.projectedPoints,
    0,
  )

  return {
    months: points.length,
    earningBasis: program.earningBasis,
    currencyRate:
      program.currencyRate === null ? null : roundMoney(program.currencyRate),
    currentBalance: program.pointsBalance,
    totalProjectedPoints,
    projectedBalance,
    points,
  }
})
