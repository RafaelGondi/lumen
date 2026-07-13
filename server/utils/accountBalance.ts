import type Database from 'better-sqlite3'
import {
  accountBalanceAtCutoff,
  allAccountBalancesAtCutoff,
} from './occurrences'

/** Saldo real até hoje, incluindo ocorrências derivadas liquidadas. */
export function accountBalance(db: Database.Database, accountId: number): number {
  return accountBalanceAtCutoff(db, accountId, todayLocal())
}

export function accountBalances(
  db: Database.Database,
): Map<number, number> {
  return allAccountBalancesAtCutoff(db, todayLocal())
}
