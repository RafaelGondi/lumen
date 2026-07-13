import type Database from 'better-sqlite3'
import {
  seedCategories,
  seedSupercategories,
} from './categorySeedData'
import { todayLocal } from './db'

/** Substitui categorias/supercategorias pelo conjunto seed da aplicação antiga. */
export function seedCategoriesFromLegacy(db: Database.Database) {
  const createdAt = todayLocal()

  const insertAll = db.transaction(() => {
    db.prepare('DELETE FROM categories').run()
    db.prepare('DELETE FROM supercategories').run()

    const insertSuper = db.prepare(
      `INSERT INTO supercategories (name, color, icon, created_at)
       VALUES (@name, @color, @icon, @createdAt)`,
    )

    for (const item of seedSupercategories) {
      insertSuper.run({ ...item, createdAt })
    }

    const superIds = Object.fromEntries(
      (
        db
          .prepare('SELECT id, name FROM supercategories')
          .all() as { id: number; name: string }[]
      ).map((row) => [row.name, row.id]),
    ) as Record<string, number>

    const insertCategory = db.prepare(
      `INSERT INTO categories (name, type, color, icon, supercategory_id, created_at)
       VALUES (@name, @type, @color, @icon, @supercategoryId, @createdAt)`,
    )

    for (const item of seedCategories) {
      insertCategory.run({
        name: item.name,
        type: item.type,
        color: item.color,
        icon: item.icon,
        supercategoryId: item.supercategory
          ? (superIds[item.supercategory] ?? null)
          : null,
        createdAt,
      })
    }
  })

  insertAll()

  return {
    supercategories: seedSupercategories.length,
    categories: seedCategories.length,
  }
}

export function seedCategoriesIfEmpty(db: Database.Database) {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM supercategories) AS supercategories,
         (SELECT COUNT(*) FROM categories) AS categories`,
    )
    .get() as { supercategories: number; categories: number }

  if (row.supercategories > 0 || row.categories > 0) return null

  return seedCategoriesFromLegacy(db)
}
