import { parseManualDebtPayload } from '../../utils/manualDebtPayload'
import { todayLocal } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const payload = parseManualDebtPayload(await readBody(event))
  const db = useDb()
  const today = todayLocal()

  if (payload.startDate > today) {
    throw createError({ statusCode: 400, statusMessage: 'A data de início não pode estar no futuro.' })
  }
  if (payload.targetDate && payload.targetDate < today) {
    throw createError({ statusCode: 400, statusMessage: 'A previsão de pagamento não pode estar no passado.' })
  }

  if (payload.categoryId !== null) {
    const category = db.prepare(
      `SELECT id FROM categories WHERE id = ? AND type = 'expense'`,
    ).get(payload.categoryId)
    if (!category) {
      throw createError({ statusCode: 400, statusMessage: 'Categoria inválida.' })
    }
  }

  const now = new Date().toISOString()
  const result = db.prepare(
    `INSERT INTO manual_debts (
       name, creditor, current_balance, start_date, target_date,
       category_id, notes, enabled, active, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
  ).run(
    payload.name,
    payload.creditor,
    payload.currentBalance,
    payload.startDate,
    payload.targetDate,
    payload.categoryId,
    payload.notes,
    now,
    now,
  )

  setResponseStatus(event, 201)
  return { id: Number(result.lastInsertRowid) }
})
