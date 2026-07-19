import { parseGlobalLimitPayload } from '../../../utils/limitPayload'
import { isUniqueConstraintError } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const payload = parseGlobalLimitPayload(await readBody(event))
  const db = useDb()

  try {
    const result = db
      .prepare(
        `INSERT INTO spending_limit_global (kind, value, effective_from, created_at)
         VALUES (@kind, @value, @effectiveFrom, @createdAt)
         ON CONFLICT(effective_from) DO UPDATE SET
           kind = excluded.kind,
           value = excluded.value`,
      )
      .run({
        kind: payload.kind,
        value: payload.value,
        effectiveFrom: payload.effectiveFrom,
        createdAt: todayLocal(),
      })

    setResponseStatus(event, 201)
    return { id: Number(result.lastInsertRowid) }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Já existe um limite global para este mês.',
      })
    }
    throw error
  }
})
