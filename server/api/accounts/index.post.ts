export default defineEventHandler(async (event) => {
  const payload = parseAccountPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `INSERT INTO accounts (
           bank_key, bank_name, name, initial_balance, color, created_at
         ) VALUES (
           @bankKey, @bankName, @name, @initialBalance, @color, @createdAt
         )`,
      )
      .run({
        ...payload,
        color: accountColorFor(payload),
        createdAt: todayLocal(),
      })

    setResponseStatus(event, 201)

    return { id: Number(result.lastInsertRowid) }
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
