/**
 * Testes unitários das funções de ciclo de fatura.
 * Espelha utils/cardInvoiceCycle.ts — manter em sincronia.
 */
function addMonthsLocal(date, months) {
  const [yearRaw, monthRaw, dayRaw] = date.split('-').map(Number)
  const totalMonths = yearRaw * 12 + (monthRaw - 1) + months
  const nextYear = Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1
  const maxDay = new Date(nextYear, nextMonth, 0).getDate()
  const nextDay = Math.min(dayRaw, maxDay)
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthParts(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  return { year, month }
}

function closingDate(year, month, cutoff) {
  const lastDay = new Date(year, month, 0).getDate()
  return isoDate(year, month, Math.min(cutoff, lastDay))
}

function addDays(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year, month - 1, day + days)
  return isoDate(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    shifted.getDate(),
  )
}

function faturaDateRange(year, month, cutoff) {
  const invoiceMonth = isoDate(year, month, 1)
  const previousMonth = addMonthsLocal(invoiceMonth, -1)
  const twoMonthsBefore = addMonthsLocal(invoiceMonth, -2)
  const previous = monthParts(previousMonth.slice(0, 7))
  const before = monthParts(twoMonthsBefore.slice(0, 7))
  return {
    startDate: addDays(closingDate(before.year, before.month, cutoff), 1),
    endDate: closingDate(previous.year, previous.month, cutoff),
  }
}

function transacaoFaturaMonth(date, cutoff) {
  const [year, month, day] = date.split('-').map(Number)
  const effectiveCutoff = Math.min(cutoff, new Date(year, month, 0).getDate())
  const offset = day <= effectiveCutoff ? 1 : 2
  return addMonthsLocal(date, offset).slice(0, 7)
}

function calcFaturaMonth(occurrenceDate, cutoff) {
  return transacaoFaturaMonth(occurrenceDate, cutoff)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const range = faturaDateRange(2026, 8, 25)
assert(range.startDate === '2026-06-26', `startDate: ${range.startDate}`)
assert(range.endDate === '2026-07-25', `endDate: ${range.endDate}`)
assert(
  transacaoFaturaMonth('2026-07-09', 25) === '2026-08',
  '09/07 deveria ir para 2026-08',
)
assert(
  transacaoFaturaMonth('2026-07-26', 25) === '2026-09',
  '26/07 deveria ir para 2026-09',
)
assert(
  calcFaturaMonth('2026-07-09', 25) === '2026-08',
  'calcFaturaMonth divergiu',
)

console.log(
  JSON.stringify(
    {
      faturaDateRange: range,
      jul09: transacaoFaturaMonth('2026-07-09', 25),
      jul26: transacaoFaturaMonth('2026-07-26', 25),
    },
    null,
    2,
  ),
)
