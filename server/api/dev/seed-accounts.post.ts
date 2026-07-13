export default defineEventHandler(() => {
  const db = useDb()
  const result = seedAccountsFromLegacy(db)

  return {
    ok: true,
    ...result,
  }
})
