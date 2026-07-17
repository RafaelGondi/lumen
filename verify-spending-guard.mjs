import Database from 'better-sqlite3'

const base = 'http://127.0.0.1:3003'

async function api(path) {
  const response = await fetch(base + path)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${JSON.stringify(data)}`)
  }
  return data
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const guard = await api('/api/spending-guard')
const calendar = await api(`/api/calendar?month=${guard.month}`)
const dashboard = await api(`/api/dashboard?month=${guard.month}`)

const db = new Database('.data/lumen.sqlite3', { readonly: true })
const paymentRows = db
  .prepare('SELECT entry_id AS entryId FROM card_invoice_payments')
  .all()
const paymentIds = new Set(paymentRows.map((row) => row.entryId))

const items = calendar.days
  .flatMap((day) => day.items)
  .filter(
    (item) =>
      item.source !== 'account' || !paymentIds.has(item.parentId),
  )
const spent = items.filter((item) => item.date <= guard.asOf)
const future = items.filter((item) => item.date > guard.asOf)
const spentTotal = round(spent.reduce((sum, item) => sum + item.amount, 0))
const futureTotal = round(future.reduce((sum, item) => sum + item.amount, 0))
const accountTotal = round(
  spent
    .filter((item) => item.source === 'account')
    .reduce((sum, item) => sum + item.amount, 0),
)
const cardTotal = round(
  spent
    .filter((item) => item.source === 'card')
    .reduce((sum, item) => sum + item.amount, 0),
)

assert(guard.savingsTargetPercent === 25, 'meta deve ser 25%')
assert(guard.spendingLimitPercent === 75, 'limite deve ser 75%')
assert(
  guard.expectedIncome === dashboard.stats.revenues.value,
  'receita do radar divergiu do dashboard',
)
assert(
  guard.spendingLimit === round(guard.expectedIncome * 0.75),
  'limite mensal inválido',
)
assert(guard.spentToDate === spentTotal, 'gasto até hoje inválido')
assert(guard.futureCommitted === futureTotal, 'compromissos futuros inválidos')
assert(
  guard.committedTotal === round(spentTotal + futureTotal),
  'total comprometido inválido',
)
assert(
  guard.sourceTotals.account === accountTotal,
  'total de contas inválido',
)
assert(guard.sourceTotals.card === cardTotal, 'total de cartões inválido')
assert(
  !spent.some(
    (item) =>
      item.source === 'account' && paymentIds.has(item.parentId),
  ),
  'pagamento de fatura contado como gasto novamente',
)

console.log(
  JSON.stringify(
    {
      month: guard.month,
      income: guard.expectedIncome,
      limit: guard.spendingLimit,
      spent: guard.spentToDate,
      future: guard.futureCommitted,
      committedPercent: guard.committedPercent,
      status: guard.status,
      account: guard.sourceTotals.account,
      card: guard.sourceTotals.card,
      excludedInvoicePayments: paymentIds.size,
    },
    null,
    2,
  ),
)
