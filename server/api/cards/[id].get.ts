import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import { cardUsageSummary } from '../../utils/cardInvoice'
import { parseCardIdParam } from '../../utils/cardPayload'

export default defineEventHandler((event): Card => {
  const id = parseCardIdParam(getRouterParam(event, 'id'))
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

  const base = {
    id: row.id,
    name: row.name,
    bankKey: row.bankKey,
    bankName: row.bankName,
    color: row.color,
    lastFour: row.lastFour,
    creditLimit: row.creditLimit,
    closingDay: row.closingDay,
    dueDay: row.dueDay,
    active: Boolean(row.active),
    createdAt: row.createdAt,
  }
  const usage = cardUsageSummary(db, base)

  return {
    ...base,
    usedAmount: usage.usedAmount,
    estimatedPayoffLabel: usage.estimatedPayoffLabel,
  }
})
