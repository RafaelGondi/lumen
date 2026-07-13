export default defineEventHandler(async (event) => {
  const payload = parseCategoryPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `INSERT INTO categories (name, type, color, icon, supercategory_id, created_at)
         VALUES (@name, @type, @color, @icon, @supercategoryId, @createdAt)`,
      )
      .run({ ...payload, createdAt: todayLocal() })

    setResponseStatus(event, 201)

    return { id: Number(result.lastInsertRowid) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma categoria com esse nome e tipo.',
      })
    }

    throw error
  }
})
