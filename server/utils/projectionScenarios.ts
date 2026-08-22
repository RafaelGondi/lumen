import type Database from 'better-sqlite3'
import type {
  ProjectionScenario,
  ProjectionScenarioItem,
  ProjectionScenarioItemPayload,
  ProjectionScenarioPayload,
} from '~/types/projection'
import { roundMoney } from '~/utils/dateMoney'

export type StoredProjectionScenario = Omit<ProjectionScenario, 'points'>

type ScenarioRow = {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

type ScenarioItemRow = {
  id: number
  scenarioId: number
  type: ProjectionScenarioItem['type']
  amount: number
  startMonth: string
  day: number
  durationMonths: number | null
}

const CHANGE_TYPES = ['income', 'expense', 'reduction', 'installment'] as const

export function listStoredProjectionScenarios(
  db: Database.Database,
): StoredProjectionScenario[] {
  const scenarios = db
    .prepare(
      `SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
       FROM projection_scenarios
       ORDER BY updated_at DESC, id DESC`,
    )
    .all() as ScenarioRow[]

  const items = db
    .prepare(
      `SELECT
         id,
         scenario_id AS scenarioId,
         change_type AS type,
         amount,
         start_month AS startMonth,
         day,
         duration_months AS durationMonths
       FROM projection_scenario_items
       ORDER BY scenario_id, id`,
    )
    .all() as ScenarioItemRow[]

  const itemsByScenario = new Map<number, ProjectionScenarioItem[]>()
  for (const item of items) {
    const current = itemsByScenario.get(item.scenarioId) ?? []
    current.push({
      id: item.id,
      type: item.type,
      amount: item.amount,
      startMonth: item.startMonth,
      day: item.day,
      durationMonths: item.durationMonths,
    })
    itemsByScenario.set(item.scenarioId, current)
  }

  return scenarios.map((scenario) => ({
    ...scenario,
    items: itemsByScenario.get(scenario.id) ?? [],
  }))
}

export function parseProjectionScenarioPayload(
  raw: unknown,
  minimumMonth: string,
): ProjectionScenarioPayload {
  const body = (raw ?? {}) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 60) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe um nome entre 1 e 60 caracteres.',
    })
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Adicione de 1 a 8 mudanças ao cenário.',
    })
  }

  const items = body.items.map((rawItem): ProjectionScenarioItemPayload => {
    const item = (rawItem ?? {}) as Record<string, unknown>
    const type = String(item.type)
    const amount = Number(item.amount)
    const startMonth = String(item.startMonth ?? '')
    const day = Number(item.day)
    const durationMonths =
      item.durationMonths === null || item.durationMonths === ''
        ? null
        : Number(item.durationMonths)

    if (!CHANGE_TYPES.includes(type as (typeof CHANGE_TYPES)[number])) {
      throw createError({ statusCode: 400, statusMessage: 'Tipo de mudança inválido.' })
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      throw createError({ statusCode: 400, statusMessage: 'Informe um valor válido.' })
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) || startMonth < minimumMonth) {
      throw createError({
        statusCode: 400,
        statusMessage: `A mudança deve começar a partir de ${minimumMonth}.`,
      })
    }
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      throw createError({ statusCode: 400, statusMessage: 'Escolha um dia entre 1 e 28.' })
    }
    if (
      durationMonths !== null &&
      (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 120)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A duração deve ter entre 1 e 120 meses.',
      })
    }
    if (type === 'installment' && durationMonths === null) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe a quantidade de parcelas.',
      })
    }

    return {
      type: type as ProjectionScenarioItemPayload['type'],
      amount: roundMoney(amount),
      startMonth,
      day,
      durationMonths,
    }
  })

  return { name, items }
}

function insertItems(
  db: Database.Database,
  scenarioId: number,
  items: ProjectionScenarioItemPayload[],
) {
  const insert = db.prepare(
    `INSERT INTO projection_scenario_items (
       scenario_id, change_type, amount, start_month, day, duration_months
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const item of items) {
    insert.run(
      scenarioId,
      item.type,
      item.amount,
      item.startMonth,
      item.day,
      item.durationMonths,
    )
  }
}

export function createProjectionScenario(
  db: Database.Database,
  payload: ProjectionScenarioPayload,
  date: string,
) {
  const create = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO projection_scenarios (name, created_at, updated_at)
         VALUES (?, ?, ?)`,
      )
      .run(payload.name, date, date)
    const id = Number(result.lastInsertRowid)
    insertItems(db, id, payload.items)
    return id
  })
  return create()
}

export function updateProjectionScenario(
  db: Database.Database,
  id: number,
  payload: ProjectionScenarioPayload,
  date: string,
) {
  const update = db.transaction(() => {
    const result = db
      .prepare(
        `UPDATE projection_scenarios
         SET name = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(payload.name, date, id)
    if (!result.changes) return false
    db.prepare('DELETE FROM projection_scenario_items WHERE scenario_id = ?').run(id)
    insertItems(db, id, payload.items)
    return true
  })
  return update()
}
