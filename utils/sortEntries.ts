export type EntrySortKey = 'date' | 'name' | 'amount' | 'category'

export type EntrySortable = {
  date: string
  /**
   * Data da compra original, quando difere da data da cobrança.
   *
   * Só as parceladas preenchem: a parcela 2/3 de uma compra de junho é
   * cobrada em agosto, e ordenar por agosto a colocaria no topo como se
   * fosse a compra mais recente da fatura. Opcional — quem não informa
   * continua ordenando por `date`.
   */
  purchaseDate?: string | null
  description: string
  amount: number
  categoryName?: string | null
  categoryId?: number | null
  categoryIcon?: string | null
  categoryColor?: string | null
  supercategoryName?: string | null
  supercategoryId?: number | null
  supercategoryIcon?: string | null
  supercategoryColor?: string | null
}

/** Data que ordena: a da compra quando existe, senão a da cobrança. */
function sortDateOf(entry: EntrySortable) {
  return entry.purchaseDate || entry.date
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
      primary = compareText(sortDateOf(left), sortDateOf(right))
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
    const byDate = compareText(sortDateOf(right), sortDateOf(left))
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

/** Agrupa por supercategoria; grupos pelo maior total; itens por data (mais recente). */
export function groupEntriesBySupercategory<T extends EntrySortable>(
  entries: T[],
): EntryCategoryGroup<T>[] {
  const map = new Map<string, EntryCategoryGroup<T>>()

  for (const entry of entries) {
    const name = entry.supercategoryName?.trim() || 'Sem supercategoria'
    const key =
      entry.supercategoryId != null
        ? `id:${entry.supercategoryId}`
        : `name:${name}`
    const existing = map.get(key)
    if (existing) {
      existing.entries.push(entry)
      existing.total += entry.amount
      continue
    }
    map.set(key, {
      key,
      name,
      categoryId: entry.supercategoryId ?? null,
      categoryIcon: entry.supercategoryIcon ?? null,
      categoryColor: entry.supercategoryColor ?? null,
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
