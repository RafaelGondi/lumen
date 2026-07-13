import { parseCardPayload } from '../../utils/cardPayload'

export default defineEventHandler(async (event) => {
  const payload = parseCardPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `INSERT INTO cards (
           name, bank_key, bank_name, color, last_four, credit_limit,
           closing_day, due_day, active, created_at
         ) VALUES (
           @name, @bankKey, @bankName, @color, @lastFour, @creditLimit,
           @closingDay, @dueDay, @active, @createdAt
         )`,
      )
      .run({
        name: payload.name,
        bankKey: payload.bankKey,
        bankName: payload.bankName,
        color: payload.color,
        lastFour: payload.lastFour,
        creditLimit: payload.creditLimit,
        closingDay: payload.closingDay,
        dueDay: payload.dueDay,
        active: payload.active === false ? 0 : 1,
        createdAt: todayLocal(),
      })

    setResponseStatus(event, 201)
    return { id: Number(result.lastInsertRowid) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe um cartão com esse banco e nome.',
      })
    }
    throw error
  }
})
