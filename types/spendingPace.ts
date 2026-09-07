import type { SpendingCalendarItem } from '~/types/spendingCalendar'

export type SpendingPaceView = 'cumulative' | 'daily'

export interface SpendingPaceDay {
  day: number
  currentDate: string | null
  previousDate: string | null
  currentDaily: number | null
  previousDaily: number | null
  currentCumulative: number | null
  previousCumulative: number | null
  currentItems: SpendingCalendarItem[]
  previousItems: SpendingCalendarItem[]
}

export interface SpendingPaceReport {
  month: string
  monthLabel: string
  previousMonth: string
  previousMonthLabel: string
  isCurrentMonth: boolean
  cutoffDay: number
  daysInMonth: number
  previousDaysInMonth: number
  currentTotal: number
  previousComparableTotal: number
  previousFullTotal: number
  difference: number
  percentChange: number | null
  projectedTotal: number
  days: SpendingPaceDay[]
}
