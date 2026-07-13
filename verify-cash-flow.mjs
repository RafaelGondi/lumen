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

const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const pastMonth = today.getMonth() === 0
  ? `${today.getFullYear() - 1}-12`
  : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`
const futureMonth = today.getMonth() === 11
  ? `${today.getFullYear() + 1}-01`
  : `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}`

const current = await api(`/api/reports/cash-flow?month=${currentMonth}`)
const past = await api(`/api/reports/cash-flow?month=${pastMonth}`)
const future = await api(`/api/reports/cash-flow?month=${futureMonth}`)
const accounts = await api('/api/accounts')
const accountsTotal = accounts.reduce((sum, account) => sum + account.balance, 0)

assert(current.monthKind === 'current', 'mês corrente')
assert(current.todayBalance !== null, 'Saldo hoje no mês corrente')
assert(
  Math.abs(current.todayBalance - accountsTotal) < 0.01,
  `Saldo hoje divergiu: ${current.todayBalance} vs ${accountsTotal}`,
)
assert(past.monthKind === 'past', 'mês passado')
assert(past.todayBalance === null, 'mês passado não deve ter Saldo hoje')
assert(future.monthKind === 'future', 'mês futuro')
assert(future.todayBalance === null, 'mês futuro não deve ter Saldo hoje')
assert(current.days.length >= 28, 'série diária incompleta')
assert(
  current.days.every((day) => typeof day.balance === 'number'),
  'saldo diário inválido',
)
assert(current.criticalThreshold === 500, 'limiar crítico')

const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const todayPoint = current.days.find((day) => day.date === todayIso)
assert(todayPoint?.isToday, 'marcador hoje')
assert(
  Math.abs(todayPoint.balance - current.todayBalance) < 0.01,
  'ponto de hoje != Saldo hoje',
)

console.log(
  JSON.stringify(
    {
      currentMonth,
      opening: current.openingBalance,
      today: current.todayBalance,
      worst: current.worstBalance,
      closing: current.closingBalance,
      delta: current.closingDelta,
      criticalDays: current.days.filter((day) => day.isCritical).length,
      pastTodayNull: past.todayBalance === null,
      futureTodayNull: future.todayBalance === null,
      accountsTotal,
    },
    null,
    2,
  ),
)
