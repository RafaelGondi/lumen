import type { CategoryType } from '~/types/category'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    type?: CategoryType
    description?: string
    statementName?: string | null
  }>(event)
  if (!['expense', 'income', 'transfer'].includes(body.type ?? '')) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo inválido.' })
  }
  return findCategorizationRule(useDb(), {
    type: body.type!,
    description: body.description?.trim() ?? '',
    statementName: body.statementName?.trim() || null,
  })
})
