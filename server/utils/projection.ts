import type Database from 'better-sqlite3'
import type {
  ProjectionPoint,
  ProjectionReport,
  ProjectionScenarioItem,
  ProjectionSnapshot,
  ProjectionSnapshotKind,
} from '~/types/projection'
import { addMonthsLocal, roundMoney, splitAmount } from '~/utils/dateMoney'
import {
  getProjectedBalancesAtDates,
  getSaldoBancarioTotal,
} from './cashFlow'
import { listStoredProjectionScenarios } from './projectionScenarios'

const SNAPSHOT_HORIZON = 18
const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

type SnapshotRow = {
  id: number
  label: string
  kind: ProjectionSnapshotKind
  snapshotMonth: string
  horizonMonths: number
  pointsJson: string
  createdAt: string
}

function pointLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return `${MONTH_LABELS[monthNumber! - 1]}/${String(year).slice(-2)}`
}

function snapshotLabel(kind: ProjectionSnapshotKind, month: string) {
  const prefix = kind === 'auto' ? 'Auto' : 'Snapshot'
  const label = pointLabel(month)
  return `${prefix} — ${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

export function buildProjectionPoints(
  db: Database.Database,
  startMonth: string,
  horizonMonths = SNAPSHOT_HORIZON,
  scenarioItems: ProjectionScenarioItem[] = [],
): ProjectionPoint[] {
  const months: string[] = []
  const datesByMonth = new Map<string, string[]>()
  const allDates: string[] = []
  let cursor = `${startMonth}-01`

  for (let index = 0; index < horizonMonths; index += 1) {
    const month = cursor.slice(0, 7)
    const [year, monthNumber] = month.split('-').map(Number)
    const lastDay = new Date(year!, monthNumber!, 0).getDate()
    const dates = Array.from({ length: lastDay }, (_, dayIndex) =>
      `${month}-${String(dayIndex + 1).padStart(2, '0')}`,
    )
    months.push(month)
    datesByMonth.set(month, dates)
    allDates.push(...dates)
    cursor = addMonthsLocal(cursor, 1)
  }

  const balances = getProjectedBalancesAtDates(db, allDates)
  const scenarioEvents = buildScenarioEvents(
    scenarioItems,
    todayLocal(),
    allDates.at(-1)!,
  )
  let scenarioAdjustment = 0
  return months.map((month) => {
    const dates = datesByMonth.get(month) ?? []
    const dailyBalances = dates.map((date) => {
      scenarioAdjustment = roundMoney(
        scenarioAdjustment + (scenarioEvents.get(date) ?? 0),
      )
      return roundMoney((balances.get(date) ?? 0) + scenarioAdjustment)
    })
    const closingBalance = dailyBalances.at(-1) ?? 0

    return {
      month,
      label: pointLabel(month),
      balance: roundMoney(closingBalance),
      bestBalance: roundMoney(Math.max(...dailyBalances)),
      worstBalance: roundMoney(Math.min(...dailyBalances)),
    }
  })
}

function buildScenarioEvents(
  items: ProjectionScenarioItem[],
  today: string,
  lastDate: string,
) {
  const events = new Map<string, number>()
  for (const item of items) {
    const maximumOccurrences = item.durationMonths ?? 240
    const amounts =
      item.type === 'installment'
        ? splitAmount(item.amount, maximumOccurrences)
        : Array.from({ length: maximumOccurrences }, () => item.amount)
    const direction =
      item.type === 'expense' || item.type === 'installment' ? -1 : 1
    let occurrenceDate = `${item.startMonth}-${String(item.day).padStart(2, '0')}`

    for (const amount of amounts) {
      if (occurrenceDate > lastDate) break
      if (occurrenceDate > today) {
        events.set(
          occurrenceDate,
          roundMoney((events.get(occurrenceDate) ?? 0) + direction * amount),
        )
      }
      occurrenceDate = addMonthsLocal(occurrenceDate, 1)
    }
  }
  return events
}

function parseSnapshot(row: SnapshotRow): ProjectionSnapshot | null {
  try {
    const points = JSON.parse(row.pointsJson) as ProjectionPoint[]
    if (!Array.isArray(points)) return null
    const hasMonthlyExtremes = points.every(
      (point) =>
        Number.isFinite(point.bestBalance) &&
        Number.isFinite(point.worstBalance),
    )
    return { ...row, points, hasMonthlyExtremes }
  } catch {
    return null
  }
}

export function listProjectionSnapshots(
  db: Database.Database,
): ProjectionSnapshot[] {
  const rows = db
    .prepare(
      `SELECT
         id,
         label,
         kind,
         snapshot_month AS snapshotMonth,
         horizon_months AS horizonMonths,
         points_json AS pointsJson,
         created_at AS createdAt
       FROM projection_snapshots
       ORDER BY snapshot_month DESC, created_at DESC, id DESC`,
    )
    .all() as SnapshotRow[]

  return rows
    .map(parseSnapshot)
    .filter((item): item is ProjectionSnapshot => item !== null)
}

export function createProjectionSnapshot(
  db: Database.Database,
  kind: ProjectionSnapshotKind,
  date = todayLocal(),
): ProjectionSnapshot {
  const month = date.slice(0, 7)
  const points = buildProjectionPoints(db, month, SNAPSHOT_HORIZON)
  const label = snapshotLabel(kind, month)
  const result = db
    .prepare(
      `INSERT INTO projection_snapshots (
         label, kind, snapshot_month, horizon_months, points_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(label, kind, month, SNAPSHOT_HORIZON, JSON.stringify(points), date)

  return {
    id: Number(result.lastInsertRowid),
    label,
    kind,
    snapshotMonth: month,
    horizonMonths: SNAPSHOT_HORIZON,
    points,
    createdAt: date,
    hasMonthlyExtremes: true,
  }
}

/**
 * A aplicação pode não receber tráfego exatamente no dia 1. Por isso o
 * snapshot mensal é criado de forma idempotente na primeira leitura do mês.
 * O índice parcial no banco garante que nem chamadas simultâneas dupliquem o
 * registro automático.
 */
export function ensureMonthlyProjectionSnapshot(db: Database.Database) {
  const month = todayLocal().slice(0, 7)
  const existing = db
    .prepare(
      `SELECT id
       FROM projection_snapshots
       WHERE kind = 'auto' AND snapshot_month = ?`,
    )
    .get(month)
  if (existing) return

  try {
    createProjectionSnapshot(db, 'auto')
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
  }
}

export function buildProjectionReport(
  db: Database.Database,
  horizonMonths: number,
): ProjectionReport {
  ensureMonthlyProjectionSnapshot(db)
  const today = todayLocal()
  const startMonth = today.slice(0, 7)
  const scenarios = listStoredProjectionScenarios(db).map((scenario) => ({
    ...scenario,
    points: buildProjectionPoints(db, startMonth, horizonMonths, scenario.items),
  }))
  return {
    generatedAt: today,
    horizonMonths,
    currentBalance: getSaldoBancarioTotal(db, today),
    points: buildProjectionPoints(db, startMonth, horizonMonths),
    snapshots: listProjectionSnapshots(db),
    scenarios,
  }
}
