export default defineEventHandler((event) => {
  const query = getQuery(event)
  const term =
    typeof query.q === 'string' ? query.q.trim().toLowerCase() : ''

  const db = useDb()
  const rows = db
    .prepare(
      `SELECT name, MAX(last_used) AS lastUsed, SUM(uses) AS uses
       FROM (
         SELECT
           TRIM(statement_name) AS name,
           date AS last_used,
           1 AS uses
         FROM entries
         WHERE statement_name IS NOT NULL
           AND TRIM(statement_name) <> ''
         UNION ALL
         SELECT
           TRIM(statement_name) AS name,
           created_at AS last_used,
           1 AS uses
         FROM entry_occurrence_exceptions
         WHERE statement_name IS NOT NULL
           AND TRIM(statement_name) <> ''
       )
       GROUP BY LOWER(TRIM(name))
       ORDER BY uses DESC, lastUsed DESC, name COLLATE NOCASE ASC
       LIMIT 80`,
    )
    .all() as { name: string; lastUsed: string; uses: number }[]

  const names = rows
    .map((row) => row.name)
    .filter((name) => (term ? name.toLowerCase().includes(term) : true))

  return names
})
