export type GlobalSearchKind = 'account' | 'card'

export interface GlobalSearchResult {
  id: string
  kind: GlobalSearchKind
  title: string
  subtitle: string
  amount: number
  entryType: 'income' | 'expense' | 'transfer'
  date: string
  month: string
  href: string
  contextLabel: string
  categoryName: string | null
  statementName: string | null
}

export interface GlobalSearchResponse {
  query: string
  results: GlobalSearchResult[]
}
