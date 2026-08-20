import type { ProjectionSnapshot } from '~/types/projection'
import { createProjectionSnapshot } from '../../utils/projection'

export default defineEventHandler((): ProjectionSnapshot => {
  return createProjectionSnapshot(useDb(), 'manual')
})
