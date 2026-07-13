import type { BankKey } from '~/types/account'
import type { Card } from '~/types/card'
import { cardUsageSummary } from '../../utils/cardInvoice'

interface CardRow {
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

export default defineEventHandler((): Card[] => {
  const db = useDb()
  const rows = db
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
       WHERE active = 1
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as CardRow[]

  return rows.map((row) => {
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
})
