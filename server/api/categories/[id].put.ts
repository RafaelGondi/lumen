export default defineEventHandler(async (event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const payload = parseCategoryPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `UPDATE categories
         SET name = @name,
             type = @type,
             color = @color,
             icon = @icon,
             supercategory_id = @supercategoryId
         WHERE id = @id`,
      )
      .run({ ...payload, id })

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Categoria não encontrada.',
      })
    }

    return { ok: true }
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
