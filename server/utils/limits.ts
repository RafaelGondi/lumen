import type Database from 'better-sqlite3'
import type {
  GlobalLimitEntry,
  GlobalLimitReport,
  LimitRow,
  LimitScope,
  LimitsReport,
} from '~/types/limits'
import { roundMoney } from '~/utils/dateMoney'
import { occurrencesForCashMonth } from './occurrences'
import { buildSpendingCalendar } from './spendingCalendar'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const DEFAULT_SAVINGS_PERCENT = 25

function roundPercent(value: number) {
  return Math.round(value * 10) / 10
}

function invoicePaymentEntryIds(db: Database.Database) {
  const rows = db
    .prepare('SELECT entry_id AS entryId FROM card_invoice_payments')
    .all() as { entryId: number }[]
  return new Set(rows.map((row) => row.entryId))
}

function monthLabel(month: string) {
  const [year, value] = month.split('-').map(Number)
  return `${MONTH_NAMES[value! - 1]} de ${year}`
}

function loadGlobalHistory(db: Database.Database) {
  return db
    .prepare(
      `SELECT
         id,
         kind,
         value,
         effective_from AS effectiveFrom,
         created_at AS createdAt
       FROM spending_limit_global
       ORDER BY effective_from DESC, id DESC`,
    )
    .all() as GlobalLimitEntry[]
}

function resolveActiveGlobal(db: Database.Database, month: string) {
  return db
    .prepare(
      `SELECT
         id,
         kind,
         value,
         effective_from AS effectiveFrom,
         created_at AS createdAt
       FROM spending_limit_global
       WHERE effective_from <= ?
       ORDER BY effective_from DESC, id DESC
       LIMIT 1`,
    )
    .get(month) as GlobalLimitEntry | undefined
}

export function resolveGlobalSpendingSettings(
  db: Database.Database,
  month: string,
  expectedIncome: number,
) {
  const active = resolveActiveGlobal(db, month)

  if (!active) {
    const savingsTargetPercent = DEFAULT_SAVINGS_PERCENT
    const spendingLimitPercent = 100 - savingsTargetPercent
    return {
      savingsTargetPercent,
      spendingLimitPercent,
      savingsGoal: roundMoney(
        expectedIncome * (savingsTargetPercent / 100),
      ),
      spendingLimit: roundMoney(
        expectedIncome * (spendingLimitPercent / 100),
      ),
    }
  }

  if (active.kind === 'fixed') {
    const spendingLimit = roundMoney(active.value)
    const savingsGoal = roundMoney(Math.max(0, expectedIncome - spendingLimit))
    const savingsTargetPercent =
      expectedIncome > 0
        ? roundPercent((savingsGoal / expectedIncome) * 100)
        : 0
    const spendingLimitPercent =
      expectedIncome > 0
        ? roundPercent((spendingLimit / expectedIncome) * 100)
        : 0
    return {
      savingsTargetPercent,
      spendingLimitPercent,
      savingsGoal,
      spendingLimit,
    }
  }

  const savingsTargetPercent = active.value
  const spendingLimitPercent = 100 - savingsTargetPercent
  return {
    savingsTargetPercent,
    spendingLimitPercent,
    savingsGoal: roundMoney(
      expectedIncome * (savingsTargetPercent / 100),
    ),
    spendingLimit: roundMoney(
      expectedIncome * (spendingLimitPercent / 100),
    ),
  }
}

export function buildGlobalLimitReport(
  db: Database.Database,
  month: string,
): GlobalLimitReport {
  const active = resolveActiveGlobal(db, month) ?? null
  const expectedIncome = roundMoney(
    occurrencesForCashMonth(db, month)
      .filter((occurrence) => occurrence.type === 'income')
      .reduce((sum, occurrence) => sum + occurrence.amount, 0),
  )
  const settings = resolveGlobalSpendingSettings(db, month, expectedIncome)

  return {
    month,
    active,
    history: loadGlobalHistory(db),
    computedLimit:
      active?.kind === 'percentage' && expectedIncome <= 0
        ? null
        : settings.spendingLimit,
    expectedIncome,
  }
}

type ResolvedLimit = {
  id: number
  amount: number
  recurring: boolean
}

function resolveLimitMap(
  db: Database.Database,
  scope: LimitScope,
  month: string,
) {
  const specific = db
    .prepare(
      `SELECT id, reference_id AS referenceId, amount, recurring
       FROM spending_limits
       WHERE scope = ? AND month = ? AND recurring = 0`,
    )
    .all(scope, month) as {
    id: number
    referenceId: number
    amount: number
    recurring: number
  }[]

  const recurring = db
    .prepare(
      `SELECT id, reference_id AS referenceId, amount, recurring, month
       FROM spending_limits
       WHERE scope = ? AND recurring = 1 AND month <= ?
       ORDER BY reference_id ASC, month DESC`,
    )
    .all(scope, month) as {
    id: number
    referenceId: number
    amount: number
    recurring: number
    month: string
  }[]

  const map = new Map<number, ResolvedLimit>()

  for (const row of recurring) {
    if (map.has(row.referenceId)) continue
    map.set(row.referenceId, {
      id: row.id,
      amount: row.amount,
      recurring: true,
    })
  }

  for (const row of specific) {
    map.set(row.referenceId, {
      id: row.id,
      amount: row.amount,
      recurring: false,
    })
  }

  return map
}

function resolveLimitAmount(
  db: Database.Database,
  scope: LimitScope,
  referenceId: number,
  month: string,
): number | null {
  return resolveLimitMap(db, scope, month).get(referenceId)?.amount ?? null
}

function categoryIdsForSuper(db: Database.Database, supercategoryId: number) {
  if (supercategoryId === 0) {
    return (
      db
        .prepare(
          `SELECT id
           FROM categories
           WHERE type = 'expense' AND supercategory_id IS NULL`,
        )
        .all() as { id: number }[]
    ).map((row) => row.id)
  }

  return (
    db
      .prepare(
        `SELECT id
         FROM categories
         WHERE type = 'expense' AND supercategory_id = ?`,
      )
      .all(supercategoryId) as { id: number }[]
  ).map((row) => row.id)
}

function sumCategoryLimitsForSuper(
  db: Database.Database,
  month: string,
  supercategoryId: number,
  options: {
    replacingCategoryId?: number
    replacingAmount?: number
  } = {},
) {
  const categoryLimits = resolveLimitMap(db, 'category', month)
  const categoryIds = new Set(categoryIdsForSuper(db, supercategoryId))

  if (supercategoryId === 0) {
    categoryIds.add(0)
  }

  let total = 0

  for (const categoryId of categoryIds) {
    if (
      options.replacingCategoryId !== undefined &&
      categoryId === options.replacingCategoryId
    ) {
      total += options.replacingAmount ?? 0
      continue
    }

    const limit = categoryLimits.get(categoryId)
    if (limit) total += limit.amount
  }

  return roundMoney(total)
}

function supercategoryLabel(db: Database.Database, supercategoryId: number) {
  if (supercategoryId === 0) return 'Sem supercategoria'

  const row = db
    .prepare(`SELECT name FROM supercategories WHERE id = ?`)
    .get(supercategoryId) as { name: string } | undefined

  return row?.name ?? 'Supercategoria'
}

function supercategoryIdForCategory(
  db: Database.Database,
  categoryId: number,
): number | null {
  if (categoryId === 0) return 0

  const row = db
    .prepare(
      `SELECT supercategory_id AS supercategoryId
       FROM categories
       WHERE id = ? AND type = 'expense'`,
    )
    .get(categoryId) as { supercategoryId: number | null } | undefined

  return row ? (row.supercategoryId ?? 0) : null
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function assertLimitHierarchy(
  db: Database.Database,
  month: string,
  scope: LimitScope,
  referenceId: number,
  amount: number,
) {
  if (scope === 'category') {
    const supercategoryId = supercategoryIdForCategory(db, referenceId)
    if (supercategoryId === null) return

    const superLimit = resolveLimitAmount(
      db,
      'supercategory',
      supercategoryId,
      month,
    )
    if (superLimit === null) return

    const projected = sumCategoryLimitsForSuper(db, month, supercategoryId, {
      replacingCategoryId: referenceId,
      replacingAmount: amount,
    })

    if (projected > superLimit) {
      throw createError({
        statusCode: 400,
        statusMessage: `A soma dos limites das categorias (${formatMoney(projected)}) ultrapassa o limite de ${supercategoryLabel(db, supercategoryId)} (${formatMoney(superLimit)}).`,
      })
    }

    return
  }

  const categoryTotal = sumCategoryLimitsForSuper(db, month, referenceId)
  if (categoryTotal > amount) {
    throw createError({
      statusCode: 400,
      statusMessage: `O limite da supercategoria (${formatMoney(amount)}) não pode ser menor que a soma dos limites das categorias (${formatMoney(categoryTotal)}).`,
    })
  }
}

export function loadSuperByCategory(db: Database.Database) {
  const categories = db
    .prepare(
      `SELECT id, name, supercategory_id AS supercategoryId
       FROM categories
       WHERE type = 'expense'`,
    )
    .all() as { id: number; name: string; supercategoryId: number | null }[]

  const supers = db
    .prepare(`SELECT id, name FROM supercategories`)
    .all() as { id: number; name: string }[]
  const superIdByName = new Map(
    supers.map((row) => [row.name.trim().toLowerCase(), row.id]),
  )

  const map = new Map<number, number>()
  for (const category of categories) {
    if (category.supercategoryId !== null) {
      map.set(category.id, category.supercategoryId)
      continue
    }

    const matchedSuperId = superIdByName.get(category.name.trim().toLowerCase())
    map.set(category.id, matchedSuperId ?? 0)
  }

  return map
}

function spentByReference(
  db: Database.Database,
  month: string,
  scope: LimitScope,
) {
  const calendar = buildSpendingCalendar(db, month, 'all')
  const paymentEntryIds = invoicePaymentEntryIds(db)
  const items = calendar.days
    .flatMap((day) => day.items)
    .filter(
      (item) =>
        item.source !== 'account' || !paymentEntryIds.has(item.parentId),
    )

  const totals = new Map<number, number>()

  if (scope === 'category') {
    for (const item of items) {
      const key = item.categoryId ?? 0
      totals.set(key, roundMoney((totals.get(key) ?? 0) + item.amount))
    }
    return totals
  }

  const superByCategory = loadSuperByCategory(db)

  for (const item of items) {
    const categoryId = item.categoryId ?? 0
    const key =
      categoryId === 0 ? 0 : (superByCategory.get(categoryId) ?? 0)
    totals.set(key, roundMoney((totals.get(key) ?? 0) + item.amount))
  }

  return totals
}

export function buildLimitsReport(
  db: Database.Database,
  month: string,
  scope: LimitScope,
): LimitsReport {
  const limitsMap = resolveLimitMap(db, scope, month)
  const spentMap = spentByReference(db, month, scope)
  const rows: LimitRow[] = []

  if (scope === 'category') {
    const categories = db
      .prepare(
        `SELECT id, name, color, icon
         FROM categories
         WHERE type = 'expense'
         ORDER BY name COLLATE NOCASE ASC`,
      )
      .all() as { id: number; name: string; color: string; icon: string }[]

    for (const category of categories) {
      const limit = limitsMap.get(category.id) ?? null
      rows.push({
        referenceId: category.id,
        label: category.name,
        color: category.color,
        icon: category.icon,
        spent: spentMap.get(category.id) ?? 0,
        limitAmount: limit?.amount ?? null,
        limitId: limit?.id ?? null,
        recurring: limit?.recurring ?? false,
      })
    }

    if ((spentMap.get(0) ?? 0) > 0 || limitsMap.has(0)) {
      const limit = limitsMap.get(0) ?? null
      rows.push({
        referenceId: 0,
        label: 'Sem categoria',
        color: '#94a3b8',
        icon: 'tag',
        spent: spentMap.get(0) ?? 0,
        limitAmount: limit?.amount ?? null,
        limitId: limit?.id ?? null,
        recurring: limit?.recurring ?? false,
      })
    }
  } else {
    const supercategories = db
      .prepare(
        `SELECT id, name, color, icon
         FROM supercategories
         ORDER BY name COLLATE NOCASE ASC`,
      )
      .all() as { id: number; name: string; color: string; icon: string }[]

    for (const supercategory of supercategories) {
      const limit = limitsMap.get(supercategory.id) ?? null
      rows.push({
        referenceId: supercategory.id,
        label: supercategory.name,
        color: supercategory.color,
        icon: supercategory.icon,
        spent: spentMap.get(supercategory.id) ?? 0,
        limitAmount: limit?.amount ?? null,
        limitId: limit?.id ?? null,
        recurring: limit?.recurring ?? false,
      })
    }

    if ((spentMap.get(0) ?? 0) > 0 || limitsMap.has(0)) {
      const limit = limitsMap.get(0) ?? null
      rows.push({
        referenceId: 0,
        label: 'Sem supercategoria',
        color: '#94a3b8',
        icon: 'folder-tree',
        spent: spentMap.get(0) ?? 0,
        limitAmount: limit?.amount ?? null,
        limitId: limit?.id ?? null,
        recurring: limit?.recurring ?? false,
      })
    }
  }

  rows.sort((a, b) => {
    const aHas = a.limitAmount !== null ? 1 : 0
    const bHas = b.limitAmount !== null ? 1 : 0
    if (aHas !== bHas) return bHas - aHas
    return b.spent - a.spent
  })

  const limitedRows = rows.filter((row) => row.limitAmount !== null)

  return {
    month,
    fullLabel: monthLabel(month),
    scope,
    totalSpent: roundMoney(
      [...spentMap.values()].reduce((sum, value) => sum + value, 0),
    ),
    totalLimited: roundMoney(
      limitedRows.reduce((sum, row) => sum + (row.limitAmount ?? 0), 0),
    ),
    totalSpentLimited: roundMoney(
      limitedRows.reduce((sum, row) => sum + row.spent, 0),
    ),
    rows,
  }
}
