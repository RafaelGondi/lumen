export type CategoryType = 'expense' | 'income' | 'transfer'

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: string
  icon: string
  supercategoryId: number | null
  supercategoryName: string | null
  supercategoryColor: string | null
  supercategoryIcon: string | null
}

export interface CategoryPayload {
  name: string
  type: CategoryType
  color: string
  icon: string
  supercategoryId: number | null
}

export interface SupercategorySummary {
  id: number
  name: string
  color: string
  icon: string
  type: CategoryType
}

export interface Supercategory {
  id: number
  name: string
  color: string
  icon: string
  categories: SupercategorySummary[]
}

export interface SupercategoryPayload {
  name: string
  color: string
  icon: string
}
