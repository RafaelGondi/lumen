import type { EntryOccurrence } from '~/types/entry'
import { occurrencesForCashMonth } from '../../utils/occurrences'

export default defineEventHandler((event): EntryOccurrence[] => {
  const query = getQuery(event)
  const accountId = Number(query.accountId)
  const month =
    typeof query.month === 'string' && query.month
      ? query.month
      : todayLocal().slice(0, 7)

  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe a conta.',
    })
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Mês inválido. Use YYYY-MM.',
    })
  }

  const db = useDb()
  return occurrencesForCashMonth(db, month, accountId)
})
