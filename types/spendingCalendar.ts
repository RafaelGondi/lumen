import type { EntryRecurrence } from '~/types/entry'
import type { BankKey } from '~/types/account'

export type SpendingRecurrenceFilter =
  | 'all'
  | 'single'
  | 'installment'
  | 'fixed'

export type SpendingSource = 'account' | 'card'

export interface SpendingCalendarItem {
  id: string
  source: SpendingSource
  parentId: number
  occurrenceMonth: string
  description: string
  amount: number
  date: string
  recurrence: EntryRecurrence
  installmentIndex: number | null
  installmentCount: number | null
  categoryId: number | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
  accountId: number | null
  accountName: string | null
  cardId: number | null
  cardName: string | null
  cardColor: string | null
  bankKey: BankKey | null
  bankName: string | null
}

export interface SpendingCalendarDay {
  date: string
  day: number
  total: number
  count: number
  isToday: boolean
  intensity: number
  dominantColor: string | null
  items: SpendingCalendarItem[]
}

export interface SpendingCalendarStats {
  currentStreak: number
  longestStreak: number
  peakDay: number | null
  peakTotal: number
  daysWithSpend: number
  daysInMonth: number
}

export interface SpendingCalendarReport {
  month: string
  fullLabel: string
  filter: SpendingRecurrenceFilter
  monthTotal: number
  days: SpendingCalendarDay[]
  stats: SpendingCalendarStats
}
