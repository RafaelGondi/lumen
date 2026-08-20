import { ensureMonthlyProjectionSnapshot } from '../utils/projection'

/**
 * Garante o snapshot mensal na primeira atividade da aplicação no mês, mesmo
 * que o usuário não abra o relatório de projeção naquele dia.
 */
export default defineEventHandler(() => {
  ensureMonthlyProjectionSnapshot(useDb())
})
