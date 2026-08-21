import { parseIdParam } from '../../utils/categoryPayload'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const payload = parseCategorizationRulePayload(await readBody(event))
  const db = useDb()
  const category = db
    .prepare('SELECT id FROM categories WHERE id = ?')
    .get(payload.categoryId)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  const duplicate = db
    .prepare(
      `SELECT id FROM categorization_rules
       WHERE id <> ? AND match_field = ? AND match_operator = ?
         AND lower(trim(pattern)) = lower(trim(?))`,
    )
    .get(id, payload.field, payload.operator, payload.pattern)
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe uma regra com esta mesma condição.',
    })
  }

  const result = db
    .prepare(
      `UPDATE categorization_rules
       SET match_field = ?, match_operator = ?, pattern = ?,
           category_id = ?, active = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      payload.field,
      payload.operator,
      payload.pattern,
      payload.categoryId,
      payload.active ? 1 : 0,
      todayLocal(),
      id,
    )
  if (result.changes === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Regra não encontrada.' })
  }
  return { ok: true }
})
