import type Database from 'better-sqlite3'
import type { SpendingPaceDay, SpendingPaceReport } from '~/types/spendingPace'
import { roundMoney } from '~/utils/dateMoney'
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

function monthParts(month: string) {
  const [year, value] = month.split('-').map(Number)
  const probe = new Date(year!, value! - 1, 1)
  if (
    !/^\d{4}-\d{2}$/.test(month) ||
    probe.getFullYear() !== year ||
    probe.getMonth() !== value! - 1
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Mês inválido.' })
  }
  return { year: year!, month: value! }
}

function previousMonth(month: string) {
  const { year, month: value } = monthParts(month)
  const date = new Date(year, value - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string) {
  const { year, month: value } = monthParts(month)
  return `${MONTH_NAMES[value - 1]} de ${year}`
}

function todayMonth() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export function buildSpendingPaceReport(
  db: Database.Database,
  month: string,
  categoryIds: number[] = [],
  supercategoryIds: number[] = [],
): SpendingPaceReport {
  monthParts(month)
  const priorMonth = previousMonth(month)
  const current = buildSpendingCalendar(
    db,
    month,
    'purchased',
    categoryIds,
    supercategoryIds,
  )
  const previous = buildSpendingCalendar(
    db,
    priorMonth,
    'purchased',
    categoryIds,
    supercategoryIds,
  )

  const now = new Date()
  const currentMonth = todayMonth()
  const isCurrentMonth = month === currentMonth
  const isFutureMonth = month > currentMonth
  const cutoffDay = isFutureMonth
    ? 0
    : isCurrentMonth
      ? Math.min(now.getDate(), current.days.length)
      : current.days.length
  const comparableDay = Math.min(cutoffDay, previous.days.length)
  // Mantemos o mês anterior completo no payload. A interface decide se exibe
  // apenas o período comparável ou a continuação da curva, sem alterar os KPIs.
  const previousVisibleDay = previous.days.length
  const maxDays = Math.max(current.days.length, previous.days.length)

  let currentRunning = 0
  let previousRunning = 0
  const days: SpendingPaceDay[] = []
  for (let index = 0; index < maxDays; index += 1) {
    const currentDay = current.days[index] ?? null
    const previousDay = previous.days[index] ?? null
    if (currentDay) currentRunning = roundMoney(currentRunning + currentDay.total)
    if (previousDay) previousRunning = roundMoney(previousRunning + previousDay.total)

    days.push({
      day: index + 1,
      currentDate: currentDay?.date ?? null,
      previousDate: previousDay?.date ?? null,
      currentDaily:
        currentDay && index + 1 <= cutoffDay ? currentDay.total : null,
      previousDaily:
        previousDay && index + 1 <= previousVisibleDay
          ? previousDay.total
          : null,
      currentCumulative:
        currentDay && index + 1 <= cutoffDay ? currentRunning : null,
      previousCumulative:
        previousDay && index + 1 <= previousVisibleDay
          ? previousRunning
          : null,
      currentItems:
        currentDay && index + 1 <= cutoffDay ? currentDay.items : [],
      previousItems:
        previousDay && index + 1 <= previousVisibleDay
          ? previousDay.items
          : [],
    })
  }

  const currentTotal = roundMoney(
    current.days
      .slice(0, cutoffDay)
      .reduce((sum, day) => sum + day.total, 0),
  )
  const previousComparableTotal = roundMoney(
    previous.days
      .slice(0, comparableDay)
      .reduce((sum, day) => sum + day.total, 0),
  )
  const difference = roundMoney(currentTotal - previousComparableTotal)
  const percentChange = previousComparableTotal
    ? Math.round((difference / previousComparableTotal) * 1000) / 10
    : null
  const projectedTotal =
    isCurrentMonth && cutoffDay > 0
      ? roundMoney((currentTotal / cutoffDay) * current.days.length)
      : currentTotal

  return {
    month,
    monthLabel: monthLabel(month),
    previousMonth: priorMonth,
    previousMonthLabel: monthLabel(priorMonth),
    isCurrentMonth,
    cutoffDay,
    daysInMonth: current.days.length,
    previousDaysInMonth: previous.days.length,
    currentTotal,
    previousComparableTotal,
    previousFullTotal: previous.monthTotal,
    difference,
    percentChange,
    projectedTotal,
    days,
  }
}
