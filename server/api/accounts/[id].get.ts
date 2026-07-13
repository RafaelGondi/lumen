import type { Account, BankKey } from '~/types/account'

interface AccountRow {
  id: number
  bankKey: BankKey
  bankName: string
  name: string
  initialBalance: number
  color: string
}

export default defineEventHandler((event): Account => {
  const id = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificador inválido.',
    })
  }

  const db = useDb()
  const row = db
    .prepare(
      `SELECT
         id,
         bank_key AS bankKey,
         bank_name AS bankName,
         name,
         initial_balance AS initialBalance,
         color
       FROM accounts
       WHERE id = ?`,
    )
    .get(id) as AccountRow | undefined

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conta não encontrada.',
    })
  }

  return {
    ...row,
    balance: accountBalance(db, row.id),
  }
})
