import { addMonthsLocal } from '~/utils/dateMoney'
import {
  parseProjectionScenarioPayload,
  updateProjectionScenario,
} from '../../../utils/projectionScenarios'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cenário inválido.' })
  }
  const today = todayLocal()
  const minimumMonth = addMonthsLocal(today, 1).slice(0, 7)
  const payload = parseProjectionScenarioPayload(await readBody(event), minimumMonth)
  const updated = updateProjectionScenario(useDb(), id, payload, today)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Cenário não encontrado.' })
  }
  return { ok: true }
})
