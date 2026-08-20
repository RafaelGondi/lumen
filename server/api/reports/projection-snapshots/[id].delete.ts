export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificador inválido.',
    })
  }

  const result = useDb()
    .prepare(
      `DELETE FROM projection_snapshots
       WHERE id = ? AND kind = 'manual'`,
    )
    .run(id)
  if (!result.changes) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Snapshots automáticos são preservados.',
    })
  }

  return { ok: true }
})
