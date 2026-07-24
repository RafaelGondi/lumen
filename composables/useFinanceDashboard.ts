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
  const canGoNext = computed(() => true)

  const isCurrentMonth = computed(
    () => selectedMonthKey.value === currentMonthKey(),
  )

  function changeMonth(direction: -1 | 1) {
    selectedMonthKey.value = shiftMonthKey(selectedMonthKey.value, direction)
  }

  function goToCurrentMonth() {
    selectedMonthKey.value = currentMonthKey()
  }

  function selectMonth({ year, month }: { year: number; month: number }) {
    selectedMonthKey.value = `${year}-${String(month).padStart(2, '0')}`
  }

  const selectedYear = computed(() =>
    Number(selectedMonthKey.value.split('-')[0]),
  )
  const selectedMonthNumber = computed(() =>
    Number(selectedMonthKey.value.split('-')[1]),
  )

  return {
    selectedMonth,
    selectedYear,
    selectedMonthNumber,
    isLoading: readonly(isLoading),
    canGoPrevious,
    canGoNext,
    isCurrentMonth,
    changeMonth,
    goToCurrentMonth,
    selectMonth,
    refresh,
  }
}
