export default defineEventHandler(async (event) => {
  const id = parseAccountIdParam(getRouterParam(event, 'id'))
  const payload = parseAccountPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `UPDATE accounts
         SET bank_key = @bankKey,
             bank_name = @bankName,
             name = @name,
             initial_balance = @initialBalance,
             color = @color
         WHERE id = @id`,
      )
      .run({
        ...payload,
        color: accountColorFor(payload),
        id,
      })

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Conta não encontrada.',
      })
    }

    return { ok: true }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe uma conta com esse banco e nome.',
      })
    }

    throw error
  }
})
