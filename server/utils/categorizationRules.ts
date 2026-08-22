import type Database from 'better-sqlite3'
import type {
  CategorizationMatch,
  CategorizationRuleField,
  CategorizationRuleOperator,
  CategorizationRuleBatchPayload,
  CategorizationRulePayload,
} from '~/types/categorizationRule'
import type { CategoryType } from '~/types/category'

type RuleCandidate = CategorizationMatch & {
  field: CategorizationRuleField
  operator: CategorizationRuleOperator
  pattern: string
}

export function normalizeRuleText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

function matches(operator: CategorizationRuleOperator, source: string, pattern: string) {
  if (!source || !pattern) return false
  if (operator === 'equals') return source === pattern
  if (operator === 'starts_with') return source.startsWith(pattern)
  return source.includes(pattern)
}

function specificity(rule: RuleCandidate) {
  const operatorScore =
    rule.operator === 'equals' ? 3 : rule.operator === 'starts_with' ? 2 : 1
  const fieldScore = rule.field === 'either' ? 0 : 1
  return operatorScore * 10_000 + fieldScore * 1_000 + normalizeRuleText(rule.pattern).length
}

export function findCategorizationRule(
  db: Database.Database,
  input: {
    type: CategoryType
    description: string
    statementName?: string | null
  },
): CategorizationMatch | null {
  const rules = db
    .prepare(
      `SELECT
         r.id AS ruleId,
         r.match_field AS field,
         r.match_operator AS operator,
         r.pattern,
         c.id AS categoryId,
         c.name AS categoryName,
         c.color AS categoryColor,
         c.icon AS categoryIcon
       FROM categorization_rules r
       JOIN categories c ON c.id = r.category_id
       WHERE r.active = 1 AND c.type = ?`,
    )
    .all(input.type) as RuleCandidate[]

  const description = normalizeRuleText(input.description)
  const statementName = normalizeRuleText(input.statementName)

  const matched = rules
    .filter((rule) => {
      const pattern = normalizeRuleText(rule.pattern)
      if (rule.field === 'description') {
        return matches(rule.operator, description, pattern)
      }
      if (rule.field === 'statement_name') {
        return matches(rule.operator, statementName, pattern)
      }
      return (
        matches(rule.operator, description, pattern) ||
        matches(rule.operator, statementName, pattern)
      )
    })
    .sort((a, b) => specificity(b) - specificity(a) || a.ruleId - b.ruleId)[0]

  if (!matched) return null
  return {
    ruleId: matched.ruleId,
    categoryId: matched.categoryId,
    categoryName: matched.categoryName,
    categoryColor: matched.categoryColor,
    categoryIcon: matched.categoryIcon,
  }
}

export function recordCategorizationMatch(
  db: Database.Database,
  ruleId: number,
) {
  db.prepare(
    `UPDATE categorization_rules
     SET match_count = match_count + 1,
         last_matched_at = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(todayLocal(), todayLocal(), ruleId)
}

export function parseCategorizationRulePayload(
  raw: unknown,
): CategorizationRulePayload {
  const body = (raw ?? {}) as Record<string, unknown>
  const field = body.field
  const operator = body.operator
  const pattern = typeof body.pattern === 'string' ? body.pattern.trim() : ''
  const categoryId = body.categoryId

  if (!['description', 'statement_name', 'either'].includes(String(field))) {
    throw createError({ statusCode: 400, statusMessage: 'Campo da regra inválido.' })
  }
  if (!['contains', 'starts_with', 'equals'].includes(String(operator))) {
    throw createError({ statusCode: 400, statusMessage: 'Condição da regra inválida.' })
  }
  if (!pattern || pattern.length > 120) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe um texto entre 1 e 120 caracteres.',
    })
  }
  if (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
  }

  return {
    field: field as CategorizationRuleField,
    operator: operator as CategorizationRuleOperator,
    pattern,
    categoryId,
    active: body.active !== false,
  }
}

export function parseCategorizationRuleBatchPayload(
  raw: unknown,
): CategorizationRuleBatchPayload {
  const body = (raw ?? {}) as Record<string, unknown>
  const patterns = Array.isArray(body.patterns)
    ? body.patterns
        .filter((pattern): pattern is string => typeof pattern === 'string')
        .map((pattern) => pattern.trim())
        .filter(Boolean)
    : typeof body.pattern === 'string'
      ? [body.pattern.trim()].filter(Boolean)
      : []

  const uniquePatterns = [...new Map(
    patterns.map((pattern) => [normalizeRuleText(pattern), pattern]),
  ).values()]

  if (uniquePatterns.length === 0 || uniquePatterns.length > 30) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe entre 1 e 30 condições.',
    })
  }

  if (uniquePatterns.some((pattern) => pattern.length > 120)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cada condição pode ter no máximo 120 caracteres.',
    })
  }

  const first = parseCategorizationRulePayload({
    ...body,
    pattern: uniquePatterns[0],
  })

  return {
    field: first.field,
    operator: first.operator,
    patterns: uniquePatterns,
    categoryId: first.categoryId,
    active: first.active,
  }
}
