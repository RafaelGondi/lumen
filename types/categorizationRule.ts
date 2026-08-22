import type { CategoryType } from './category'

export type CategorizationRuleField =
  | 'description'
  | 'statement_name'
  | 'either'

export type CategorizationRuleOperator = 'contains' | 'starts_with' | 'equals'

export interface CategorizationRule {
  id: number
  field: CategorizationRuleField
  operator: CategorizationRuleOperator
  pattern: string
  categoryId: number
  categoryName: string
  categoryType: CategoryType
  categoryColor: string
  categoryIcon: string
  active: boolean
  matchCount: number
  lastMatchedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CategorizationRulePayload {
  field: CategorizationRuleField
  operator: CategorizationRuleOperator
  pattern: string
  categoryId: number
  active: boolean
}

export interface CategorizationRuleBatchPayload {
  field: CategorizationRuleField
  operator: CategorizationRuleOperator
  patterns: string[]
  categoryId: number
  active: boolean
}

export interface CategorizationMatch {
  ruleId: number
  categoryId: number
  categoryName: string
  categoryColor: string
  categoryIcon: string
}
