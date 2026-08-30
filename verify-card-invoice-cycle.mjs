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
    startDate: closingDate(before.year, before.month, cutoff),
    endDate: addDays(closingDate(previous.year, previous.month, cutoff), -1),
  }
}

function transacaoFaturaMonth(date, cutoff) {
  const [year, month, day] = date.split('-').map(Number)
  const effectiveCutoff = Math.min(cutoff, new Date(year, month, 0).getDate())
  const offset = day < effectiveCutoff ? 1 : 2
  return addMonthsLocal(date, offset).slice(0, 7)
}

function calcFaturaMonth(occurrenceDate, cutoff) {
  return transacaoFaturaMonth(occurrenceDate, cutoff)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const range = faturaDateRange(2026, 8, 25)
assert(range.startDate === '2026-06-25', `startDate: ${range.startDate}`)
assert(range.endDate === '2026-07-24', `endDate: ${range.endDate}`)
assert(
  transacaoFaturaMonth('2026-07-09', 25) === '2026-08',
  '09/07 deveria ir para 2026-08',
)
assert(
  transacaoFaturaMonth('2026-07-24', 25) === '2026-08',
  '24/07 deveria ir para 2026-08',
)
assert(
  transacaoFaturaMonth('2026-07-25', 25) === '2026-09',
  '25/07 deveria ir para 2026-09',
)
assert(
  transacaoFaturaMonth('2026-08-25', 25) === '2026-10',
  '25/08 deveria ir para 2026-10',
)
assert(
  calcFaturaMonth('2026-07-09', 25) === '2026-08',
  'calcFaturaMonth divergiu',
)

const firstDayRange = faturaDateRange(2026, 8, 1)
assert(
  firstDayRange.startDate === '2026-06-01' &&
    firstDayRange.endDate === '2026-06-30',
  `Janela com corte no dia 1 incorreta: ${JSON.stringify(firstDayRange)}`,
)
assert(
  transacaoFaturaMonth('2026-07-01', 1) === '2026-09',
  '01/07 com corte no dia 1 deveria ir para 2026-09',
)

const longCutoffRange = faturaDateRange(2026, 4, 31)
assert(
  longCutoffRange.startDate === '2026-02-28' &&
    longCutoffRange.endDate === '2026-03-30',
  `Janela com corte 31 em fevereiro incorreta: ${JSON.stringify(longCutoffRange)}`,
)

console.log(
  JSON.stringify(
    {
      faturaDateRange: range,
      jul09: transacaoFaturaMonth('2026-07-09', 25),
      jul24: transacaoFaturaMonth('2026-07-24', 25),
      jul25: transacaoFaturaMonth('2026-07-25', 25),
      aug25: transacaoFaturaMonth('2026-08-25', 25),
    },
    null,
    2,
  ),
)
