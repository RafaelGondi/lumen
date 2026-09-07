import type Database from 'better-sqlite3'
import { todayLocal } from './db'

const seedAccounts = [
  {
    bankKey: 'itau',
    bankName: 'Itaú',
    name: 'Itaú',
    color: '#ec7000',
  },
  {
    bankKey: 'mercadopago',
    bankName: 'Mercado Pago',
    name: 'Mercado Pago',
    color: '#00bcff',
  },
  {
    bankKey: 'inter',
    bankName: 'Inter',
    name: 'Inter',
    color: '#ff7a00',
  },
  {
    bankKey: 'bradesco',
    bankName: 'Bradesco',
    name: 'Bradesco',
    color: '#cc092f',
  },
  {
    bankKey: 'btg',
    bankName: 'BTG Pactual',
    name: 'BTG',
    color: '#001e62',
  },
] as const

/** Contas iniciais com saldo vazio (0). */
export function seedAccountsFromLegacy(db: Database.Database) {
  const createdAt = todayLocal()

  const insertAll = db.transaction(() => {
    db.prepare('DELETE FROM accounts').run()

    const insert = db.prepare(
      `INSERT INTO accounts (
         bank_key, bank_name, name, initial_balance, color, created_at
       ) VALUES (
         @bankKey, @bankName, @name, 0, @color, @createdAt
       )`,
    )

    for (const account of seedAccounts) {
      insert.run({ ...account, createdAt })
    }
  })

  insertAll()

  return { accounts: seedAccounts.length }
}

export function seedAccountsIfEmpty(db: Database.Database) {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM accounts')
    .get() as { count: number }

  if (row.count > 0) return null

  return seedAccountsFromLegacy(db)
}
