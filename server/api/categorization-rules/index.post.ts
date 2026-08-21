export default defineEventHandler(async (event) => {
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
       WHERE match_field = ? AND match_operator = ?
         AND lower(trim(pattern)) = lower(trim(?))`,
    )
    .get(payload.field, payload.operator, payload.pattern)
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe uma regra com esta mesma condição.',
    })
  }

  const now = todayLocal()
  const result = db
    .prepare(
      `INSERT INTO categorization_rules (
         match_field, match_operator, pattern, category_id, active,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.field,
      payload.operator,
      payload.pattern,
      payload.categoryId,
      payload.active ? 1 : 0,
      now,
      now,
    )

  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid) }
})
