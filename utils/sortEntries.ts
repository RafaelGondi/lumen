export type EntrySortKey = 'date' | 'name' | 'amount' | 'category'

export type EntrySortable = {
  date: string
  description: string
  amount: number
  categoryName?: string | null
  categoryId?: number | null
  categoryIcon?: string | null
  categoryColor?: string | null
}

export type EntryCategoryGroup<T extends EntrySortable = EntrySortable> = {
  key: string
  name: string
  categoryId: number | null
  categoryIcon: string | null
  categoryColor: string | null
  total: number
  entries: T[]
}

export const entrySortOptions: { value: EntrySortKey; label: string }[] = [
  { value: 'date', label: 'Data' },
  { value: 'name', label: 'Nome' },
  { value: 'amount', label: 'Valor' },
  { value: 'category', label: 'Categoria' },
]

/** Direção padrão por critério: data/valor = maior primeiro; nome/categoria = A→Z. */
export function defaultSortDir(key: EntrySortKey): 'asc' | 'desc' {
  return key === 'name' || key === 'category' ? 'asc' : 'desc'
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function sortEntries<T extends EntrySortable>(
  entries: T[],
  key: EntrySortKey,
  dir: 'asc' | 'desc' = defaultSortDir(key),
): T[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...entries].sort((left, right) => {
    let primary = 0
    if (key === 'date') {
      primary = compareText(left.date, right.date)
    } else if (key === 'name') {
      primary = compareText(left.description, right.description)
    } else if (key === 'amount') {
      primary = left.amount - right.amount
    } else {
      primary = compareText(
        left.categoryName?.trim() || 'Sem categoria',
        right.categoryName?.trim() || 'Sem categoria',
      )
    }
    if (primary !== 0) return primary * factor
    // Desempate estável: data mais recente, depois nome.
    const byDate = compareText(right.date, left.date)
    if (byDate !== 0) return byDate
    return compareText(left.description, right.description)
  })
}

/** Agrupa por categoria; grupos pelo maior total; itens por data (mais recente). */
export function groupEntriesByCategory<T extends EntrySortable>(
  entries: T[],
): EntryCategoryGroup<T>[] {
  const map = new Map<string, EntryCategoryGroup<T>>()

  for (const entry of entries) {
    const name = entry.categoryName?.trim() || 'Sem categoria'
    const key =
      entry.categoryId != null ? `id:${entry.categoryId}` : `name:${name}`
    const existing = map.get(key)
    if (existing) {
      existing.entries.push(entry)
      existing.total += entry.amount
      continue
    }
    map.set(key, {
      key,
      name,
      categoryId: entry.categoryId ?? null,
      categoryIcon: entry.categoryIcon ?? null,
      categoryColor: entry.categoryColor ?? null,
      total: entry.amount,
      entries: [entry],
    })
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      total: Math.round(group.total * 100) / 100,
      entries: sortEntries(group.entries, 'date', 'desc'),
    }))
    .sort((a, b) => {
      const byTotal = b.total - a.total
      if (byTotal !== 0) return byTotal
      return compareText(a.name, b.name)
    })
}
