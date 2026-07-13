export default defineEventHandler(() => {
  const db = useDb()
  const result = seedCategoriesFromLegacy(db)

  return {
    ok: true,
    ...result,
  }
})
