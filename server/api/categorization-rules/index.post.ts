export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  const payload = parseCategorizationRuleBatchPayload(raw)
  const db = useDb()
  const category = db
    .prepare('SELECT id FROM categories WHERE id = ?')
    .get(payload.categoryId)
  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada.' })
  }

  const duplicateStatement = db.prepare(
    `SELECT pattern FROM categorization_rules
     WHERE match_field = ? AND match_operator = ?
       AND lower(trim(pattern)) = lower(trim(?))`,
  )
  const duplicate = payload.patterns.find((pattern) =>
    duplicateStatement.get(payload.field, payload.operator, pattern),
  )
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: `Já existe uma regra para “${duplicate}”.`,
    })
  }

  const now = todayLocal()
  const insert = db.prepare(
    `INSERT INTO categorization_rules (
       match_field, match_operator, pattern, category_id, active,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertAll = db.transaction(() =>
    payload.patterns.map((pattern) =>
      Number(
        insert.run(
          payload.field,
          payload.operator,
          pattern,
          payload.categoryId,
          payload.active ? 1 : 0,
          now,
          now,
        ).lastInsertRowid,
      ),
    ),
  )
  const ids = insertAll()

  setResponseStatus(event, 201)
  return { ids, count: ids.length }
})
