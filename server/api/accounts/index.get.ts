import type { Account, AccountKind, BankKey } from '~/types/account'

interface AccountRow {
  id: number
  kind: AccountKind
  bankKey: BankKey
  bankName: string
  name: string
  initialBalance: number
  color: string
}

export default defineEventHandler((): Account[] => {
  const db = useDb()
  const balances = accountBalances(db)

  const rows = db
    .prepare(
      `SELECT
         id,
         CASE
           WHEN bank_key = 'cash'
             OR (bank_key = 'custom' AND bank_name = 'Dinheiro em espécie')
           THEN 'cash'
           ELSE 'bank'
         END AS kind,
         bank_key AS bankKey,
         bank_name AS bankName,
         name,
         initial_balance AS initialBalance,
         color
       FROM accounts
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as AccountRow[]

  return rows.map((row) => ({
    ...row,
    balance: balances.get(row.id) ?? row.initialBalance,
  }))
})
