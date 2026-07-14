import { searchGlobal } from '../utils/globalSearch'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q : ''

  if (q.trim().length > 0 && q.trim().length < 2) {
    return { query: q.trim(), results: [] }
  }

  const results = searchGlobal(useDb(), q)
  return {
    query: q.trim(),
    results,
  }
})
