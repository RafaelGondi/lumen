import type { DashboardMonth } from '~/types/finance'

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonthKey(monthKey: string, delta: number) {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number)
  const date = new Date(yearRaw!, monthRaw! - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function useFinanceDashboard() {
  const selectedMonthKey = ref(currentMonthKey())

  const {
    data: selectedMonth,
    pending: isLoading,
    refresh,
  } = useFetch<DashboardMonth>(() => `/api/dashboard?month=${selectedMonthKey.value}`, {
    watch: [selectedMonthKey],
    default: () => null,
  })

  const canGoPrevious = computed(() => true)
  const canGoNext = computed(() => {
    const max = shiftMonthKey(currentMonthKey(), 12)
    return selectedMonthKey.value < max
  })

  const isCurrentMonth = computed(
    () => selectedMonthKey.value === currentMonthKey(),
  )

  function changeMonth(direction: -1 | 1) {
    const next = shiftMonthKey(selectedMonthKey.value, direction)
    if (direction === 1 && next > shiftMonthKey(currentMonthKey(), 12)) return
    selectedMonthKey.value = next
  }

  function goToCurrentMonth() {
    selectedMonthKey.value = currentMonthKey()
  }

  return {
    selectedMonth,
    isLoading: readonly(isLoading),
    canGoPrevious,
    canGoNext,
    isCurrentMonth,
    changeMonth,
    goToCurrentMonth,
    refresh,
  }
}
