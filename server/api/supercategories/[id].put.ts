export default defineEventHandler(async (event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const payload = parseSupercategoryPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `UPDATE supercategories
         SET name = @name, color = @color, icon = @icon
         WHERE id = @id`,
      )
      .run({ ...payload, id })

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Supercategoria não encontrada.',
      })
    }

    return { ok: true }
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
