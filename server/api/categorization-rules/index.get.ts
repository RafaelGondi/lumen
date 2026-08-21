import type { CategorizationRule } from '~/types/categorizationRule'

export default defineEventHandler((): CategorizationRule[] => {
  const db = useDb()
  const rows = db
    .prepare(
      `SELECT
         r.id,
         r.match_field AS field,
         r.match_operator AS operator,
         r.pattern,
         r.category_id AS categoryId,
         c.name AS categoryName,
         c.type AS categoryType,
         c.color AS categoryColor,
         c.icon AS categoryIcon,
         r.active,
         r.match_count AS matchCount,
         r.last_matched_at AS lastMatchedAt,
         r.created_at AS createdAt,
         r.updated_at AS updatedAt
       FROM categorization_rules r
       JOIN categories c ON c.id = r.category_id
       ORDER BY r.active DESC, r.created_at DESC, r.id DESC`,
    )
    .all() as (Omit<CategorizationRule, 'active'> & { active: number })[]

  return rows.map((row) => ({ ...row, active: Boolean(row.active) }))
})
