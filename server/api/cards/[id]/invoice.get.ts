import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import { buildCardInvoice } from '../../../utils/cardInvoice'
import { parseCardIdParam } from '../../../utils/cardPayload'

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

export default defineEventHandler((event): CardInvoiceDetail => {
  const id = parseCardIdParam(getRouterParam(event, 'id'))
  const query = getQuery(event)
  const month =
    typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
      ? query.month
      : (() => {
          const now = new Date()
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        })()

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o mês no formato YYYY-MM.',
    })
  }

  const [year, monthValue] = month.split('-').map(Number)
  const probe = new Date(year!, monthValue! - 1, 1)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== monthValue! - 1
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido.',
    })
  }

  const card = loadCard(id)
  return buildCardInvoice(useDb(), card, month)
})
