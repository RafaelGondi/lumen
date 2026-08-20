import type { ProjectionReport } from '~/types/projection'
import { buildProjectionReport } from '../../utils/projection'

export default defineEventHandler((event): ProjectionReport => {
  const query = getQuery(event)
  const horizon = Number(query.horizon ?? 12)
  if (![6, 12, 18].includes(horizon)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Horizonte inválido.',
    })
  }

  return buildProjectionReport(useDb(), horizon)
})
