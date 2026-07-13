import type { Category } from '~/types/category'

export default defineEventHandler((): Category[] => {
  const db = useDb()

  return db
    .prepare(
      `SELECT
         c.id,
         c.name,
         c.type,
         c.color,
         c.icon,
         c.supercategory_id AS supercategoryId,
         s.name AS supercategoryName,
         s.color AS supercategoryColor,
         s.icon AS supercategoryIcon
       FROM categories c
       LEFT JOIN supercategories s ON s.id = c.supercategory_id
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as Category[]
})
