import { parseLimitPayload } from '../../utils/limitPayload'
import { isUniqueConstraintError } from '../../utils/db'
import { assertLimitHierarchy } from '../../utils/limits'

export default defineEventHandler(async (event) => {
  const payload = parseLimitPayload(await readBody(event))
  const db = useDb()

  if (payload.scope === 'category' && payload.referenceId > 0) {
    const exists = db
      .prepare(
        `SELECT 1 FROM categories WHERE id = ? AND type = 'expense'`,
      )
      .get(payload.referenceId)
    if (!exists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Categoria não encontrada.',
      })
    }
  }

  if (payload.scope === 'supercategory' && payload.referenceId > 0) {
    const exists = db
      .prepare(`SELECT 1 FROM supercategories WHERE id = ?`)
      .get(payload.referenceId)
    if (!exists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Supercategoria não encontrada.',
      })
    }
  }

  assertLimitHierarchy(
    db,
    payload.month,
    payload.scope,
    payload.referenceId,
    payload.amount,
  )

  try {
    const result = db
      .prepare(
        `INSERT INTO spending_limits (
           scope, reference_id, month, amount, recurring, created_at
         ) VALUES (@scope, @referenceId, @month, @amount, @recurring, @createdAt)`,
      )
      .run({
        scope: payload.scope,
        referenceId: payload.referenceId,
        month: payload.month,
        amount: payload.amount,
        recurring: payload.recurring ? 1 : 0,
        createdAt: todayLocal(),
      })

    setResponseStatus(event, 201)
    return { id: Number(result.lastInsertRowid) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Já existe um limite para este item neste mês. Edite o existente.',
      })
    }
    throw error
  }
})
