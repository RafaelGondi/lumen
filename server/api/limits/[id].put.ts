import type { LimitScope } from '~/types/limits'
import { parseIdParam } from '../../utils/categoryPayload'
import { parseLimitUpdatePayload } from '../../utils/limitPayload'
import { assertLimitHierarchy } from '../../utils/limits'

export default defineEventHandler(async (event) => {
  const id = parseIdParam(getRouterParam(event, 'id'))
  const payload = parseLimitUpdatePayload(await readBody(event))
  const db = useDb()

  const existing = db
    .prepare(
      `SELECT scope, reference_id AS referenceId, month
       FROM spending_limits
       WHERE id = ?`,
    )
    .get(id) as
    | { scope: LimitScope; referenceId: number; month: string }
    | undefined

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Limite não encontrado.',
    })
  }

  assertLimitHierarchy(
    db,
    existing.month,
    existing.scope,
    existing.referenceId,
    payload.amount,
  )

  const result = db
    .prepare(
      `UPDATE spending_limits
       SET amount = @amount, recurring = @recurring
       WHERE id = @id`,
    )
    .run({
      id,
      amount: payload.amount,
      recurring: payload.recurring ? 1 : 0,
    })

  if (result.changes === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Limite não encontrado.',
    })
  }

  return { ok: true }
})
