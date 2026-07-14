import type Database from 'better-sqlite3'
import { formatDateBr, roundMoney } from '~/utils/dateMoney'
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'
import type { GlobalSearchResult } from '~/types/search'
import { todayLocal } from './db'

type EntryHit = {
  id: number
  type: 'income' | 'expense' | 'transfer'
  accountId: number | null
  accountName: string | null
  cardId: number | null
  cardName: string | null
  closingDay: number | null
  description: string
  amount: number
  date: string
  statementName: string | null
  notes: string | null
  categoryName: string | null
  recurrence: string
  occurrenceMonth: string | null
}

function matchesTerm(
  term: string,
  ...values: Array<string | null | undefined>
) {
  return values.some((value) => value?.toLowerCase().includes(term))
}

function buildSubtitle(hit: EntryHit) {
  const parts: string[] = []
  if (hit.statementName) parts.push(hit.statementName)
  if (hit.categoryName) parts.push(hit.categoryName)
  parts.push(formatDateBr(hit.date))
  return parts.join(' · ')
}

function toResult(hit: EntryHit): GlobalSearchResult | null {
  const isCard = hit.cardId != null
  if (isCard) {
    if (!hit.cardId || !hit.closingDay) return null
    const month = transacaoFaturaMonth(hit.date, hit.closingDay)
    return {
      id: `card-${hit.cardId}-${hit.id}-${hit.date}`,
      kind: 'card',
      title: hit.description,
      subtitle: buildSubtitle(hit),
      amount: roundMoney(hit.amount),
      entryType: hit.type,
      date: hit.date,
      month,
      href: `/cartoes/${hit.cardId}?month=${month}`,
      contextLabel: hit.cardName ?? 'Cartão',
      categoryName: hit.categoryName,
      statementName: hit.statementName,
    }
  }

  if (!hit.accountId) return null
  const month = (hit.occurrenceMonth ?? hit.date.slice(0, 7)).slice(0, 7)
  return {
    id: `account-${hit.accountId}-${hit.id}-${month}`,
    kind: 'account',
    title: hit.description,
    subtitle: buildSubtitle(hit),
    amount: roundMoney(hit.amount),
    entryType: hit.type,
    date: hit.date,
    month,
    href: `/contas/${hit.accountId}?month=${month}`,
    contextLabel: hit.accountName ?? 'Conta',
    categoryName: hit.categoryName,
    statementName: hit.statementName,
  }
}

export function searchGlobal(
  db: Database.Database,
  rawQuery: string,
  limit = 25,
): GlobalSearchResult[] {
  const term = rawQuery.trim().toLowerCase()
  if (term.length < 2) return []

  const like = `%${term}%`
  const entryRows = db
    .prepare(
      `SELECT
         e.id,
         e.type,
         e.account_id AS accountId,
         a.name AS accountName,
         e.card_id AS cardId,
         card.name AS cardName,
         card.closing_day AS closingDay,
         e.description,
         e.amount,
         e.date,
         e.statement_name AS statementName,
         e.notes,
         c.name AS categoryName,
         e.recurrence,
         NULL AS occurrenceMonth
       FROM entries e
       LEFT JOIN accounts a ON a.id = e.account_id
       LEFT JOIN cards card ON card.id = e.card_id
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.type IN ('income', 'expense', 'transfer')
         AND (
           LOWER(e.description) LIKE ?
           OR LOWER(COALESCE(e.statement_name, '')) LIKE ?
           OR LOWER(COALESCE(e.notes, '')) LIKE ?
           OR LOWER(COALESCE(c.name, '')) LIKE ?
         )
       ORDER BY e.date DESC, e.id DESC
       LIMIT ?`,
    )
    .all(like, like, like, like, limit * 2) as EntryHit[]

  const exceptionRows = db
    .prepare(
      `SELECT
         e.id,
         e.type,
         e.account_id AS accountId,
         a.name AS accountName,
         e.card_id AS cardId,
         card.name AS cardName,
         card.closing_day AS closingDay,
         COALESCE(ex.description, e.description) AS description,
         COALESCE(ex.amount, e.amount) AS amount,
         COALESCE(ex.due_date, e.date) AS date,
         COALESCE(ex.statement_name, e.statement_name) AS statementName,
         COALESCE(ex.notes, e.notes) AS notes,
         c.name AS categoryName,
         e.recurrence,
         ex.occurrence_month AS occurrenceMonth
       FROM entry_occurrence_exceptions ex
       JOIN entries e ON e.id = ex.entry_id
       LEFT JOIN accounts a ON a.id = e.account_id
       LEFT JOIN cards card ON card.id = e.card_id
       LEFT JOIN categories c
         ON c.id = COALESCE(ex.category_id, e.category_id)
       WHERE ex.action = 'edit'
         AND e.type IN ('income', 'expense', 'transfer')
         AND (
           LOWER(COALESCE(ex.description, e.description)) LIKE ?
           OR LOWER(COALESCE(ex.statement_name, e.statement_name, '')) LIKE ?
           OR LOWER(COALESCE(ex.notes, e.notes, '')) LIKE ?
           OR LOWER(COALESCE(c.name, '')) LIKE ?
         )
       ORDER BY COALESCE(ex.due_date, e.date) DESC, e.id DESC
       LIMIT ?`,
    )
    .all(like, like, like, like, limit) as EntryHit[]

  // Séries recorrentes: se o parent bate, inclui ocorrência do mês atual (se existir na série).
  const recurringHits = db
    .prepare(
      `SELECT
         e.id,
         e.type,
         e.account_id AS accountId,
         a.name AS accountName,
         e.card_id AS cardId,
         card.name AS cardName,
         card.closing_day AS closingDay,
         e.description,
         e.amount,
         e.date,
         e.statement_name AS statementName,
         e.notes,
         c.name AS categoryName,
         e.recurrence,
         NULL AS occurrenceMonth
       FROM entries e
       LEFT JOIN accounts a ON a.id = e.account_id
       LEFT JOIN cards card ON card.id = e.card_id
       LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.recurrence IN ('fixed', 'installment')
         AND e.type IN ('income', 'expense', 'transfer')
         AND (
           LOWER(e.description) LIKE ?
           OR LOWER(COALESCE(e.statement_name, '')) LIKE ?
           OR LOWER(COALESCE(e.notes, '')) LIKE ?
           OR LOWER(COALESCE(c.name, '')) LIKE ?
         )
       ORDER BY e.date DESC
       LIMIT ?`,
    )
    .all(like, like, like, like, 15) as EntryHit[]

  const today = todayLocal()
  const currentMonth = today.slice(0, 7)
  const enrichedRecurring = recurringHits.map((hit) => {
    if (hit.date.slice(0, 7) >= currentMonth) return hit
    // Aponta para o mês corrente quando a série já começou.
    return {
      ...hit,
      date: `${currentMonth}-01`,
      occurrenceMonth: currentMonth,
    }
  })

  const merged = [...exceptionRows, ...entryRows, ...enrichedRecurring]
  const seen = new Set<string>()
  const results: GlobalSearchResult[] = []

  for (const hit of merged) {
    if (
      !matchesTerm(
        term,
        hit.description,
        hit.statementName,
        hit.notes,
        hit.categoryName,
      )
    ) {
      continue
    }
    const result = toResult(hit)
    if (!result || seen.has(result.id)) continue
    seen.add(result.id)
    results.push(result)
    if (results.length >= limit) break
  }

  return results
}
