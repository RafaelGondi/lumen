import type Database from 'better-sqlite3'
import type {
  ComparisonReport,
  ComparisonRow,
  ComparisonScope,
} from '~/types/comparison'
import type { CategorySpendRow } from '~/types/categorySpendReport'
import { roundMoney } from '~/utils/dateMoney'
import { buildCategorySpendReport } from './categorySpendReport'

function rowKey(row: Pick<CategorySpendRow, 'referenceId'>) {
  return `${typeof row.referenceId}:${String(row.referenceId)}`
}

function percentChange(base: number, compare: number) {
  if (base === 0) return null
  return Math.round((((compare - base) / base) * 100) * 10) / 10
}

export function buildComparisonReport(
  db: Database.Database,
  baseMonth: string,
  compareMonth: string,
  scope: ComparisonScope,
): ComparisonReport {
  const base = buildCategorySpendReport(db, baseMonth, scope)
  const compare = buildCategorySpendReport(db, compareMonth, scope)
  const baseRows = new Map(base.rows.map((row) => [rowKey(row), row]))
  const compareRows = new Map(compare.rows.map((row) => [rowKey(row), row]))
  const keys = new Set([...baseRows.keys(), ...compareRows.keys()])
  const rows: ComparisonRow[] = []

  for (const key of keys) {
    const baseRow = baseRows.get(key)
    const compareRow = compareRows.get(key)
    const meta = compareRow ?? baseRow
    if (!meta) continue

    const baseAmount = baseRow?.amount ?? 0
    const compareAmount = compareRow?.amount ?? 0
    rows.push({
      key,
      referenceId: meta.referenceId,
      label: meta.label,
      color: meta.color,
      icon: meta.icon,
      baseAmount,
      compareAmount,
      difference: roundMoney(compareAmount - baseAmount),
      percentChange: percentChange(baseAmount, compareAmount),
      comparable: Boolean(baseRow && compareRow),
      baseItems: baseRow?.breakdown.items ?? [],
      compareItems: compareRow?.breakdown.items ?? [],
    })
  }

  rows.sort(
    (a, b) =>
      b.difference - a.difference ||
      b.compareAmount - a.compareAmount ||
      a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }),
  )

  const difference = roundMoney(compare.monthTotal - base.monthTotal)
  return {
    baseMonth,
    baseLabel: base.fullLabel,
    compareMonth,
    compareLabel: compare.fullLabel,
    scope,
    baseTotal: base.monthTotal,
    compareTotal: compare.monthTotal,
    difference,
    percentChange: percentChange(base.monthTotal, compare.monthTotal),
    rows,
  }
}
