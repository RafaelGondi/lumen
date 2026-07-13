import type { Supercategory, SupercategorySummary } from '~/types/category'

interface SupercategoryRow {
  id: number
  name: string
  color: string
  icon: string
}

interface MemberRow extends SupercategorySummary {
  supercategoryId: number
}

export default defineEventHandler((): Supercategory[] => {
  const db = useDb()

  const supercategories = db
    .prepare(
      `SELECT id, name, color, icon
       FROM supercategories
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as SupercategoryRow[]

  const members = db
    .prepare(
      `SELECT id, name, color, icon, type, supercategory_id AS supercategoryId
       FROM categories
       WHERE supercategory_id IS NOT NULL
       ORDER BY name COLLATE NOCASE`,
    )
    .all() as MemberRow[]

  return supercategories.map((supercategory) => ({
    ...supercategory,
    categories: members
      .filter((member) => member.supercategoryId === supercategory.id)
      .map(({ supercategoryId: _sid, ...member }) => member),
  }))
})
