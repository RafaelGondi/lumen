import { parseCardIdParam, parseCardPayload } from '../../utils/cardPayload'

export default defineEventHandler(async (event) => {
  const id = parseCardIdParam(getRouterParam(event, 'id'))
  const payload = parseCardPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `UPDATE cards
         SET name = @name,
             bank_key = @bankKey,
             bank_name = @bankName,
             color = @color,
             last_four = @lastFour,
             credit_limit = @creditLimit,
             closing_day = @closingDay,
             due_day = @dueDay,
             active = @active
         WHERE id = @id`,
      )
      .run({
        id,
        name: payload.name,
        bankKey: payload.bankKey,
        bankName: payload.bankName,
        color: payload.color,
        lastFour: payload.lastFour,
        creditLimit: payload.creditLimit,
        closingDay: payload.closingDay,
        dueDay: payload.dueDay,
        active: payload.active === false ? 0 : 1,
      })

    if (result.changes === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Cartão não encontrado.',
      })
    }

    return { ok: true }
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
