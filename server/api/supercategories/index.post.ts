export default defineEventHandler(async (event) => {
  const payload = parseSupercategoryPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `INSERT INTO supercategories (name, color, icon, created_at)
         VALUES (@name, @color, @icon, @createdAt)`,
      )
      .run({ ...payload, createdAt: todayLocal() })

    setResponseStatus(event, 201)

    return { id: Number(result.lastInsertRowid) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma supercategoria com esse nome.',
      })
    }

    throw error
  }
})
