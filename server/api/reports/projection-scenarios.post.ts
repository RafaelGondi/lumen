import { addMonthsLocal } from '~/utils/dateMoney'
import {
  createProjectionScenario,
  parseProjectionScenarioPayload,
} from '../../utils/projectionScenarios'

export default defineEventHandler(async (event) => {
  const today = todayLocal()
  const minimumMonth = addMonthsLocal(today, 1).slice(0, 7)
  const payload = parseProjectionScenarioPayload(await readBody(event), minimumMonth)
  const id = createProjectionScenario(useDb(), payload, today)
  return { id }
})
