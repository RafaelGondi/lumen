<script setup lang="ts">
import type { MoneyFlowReport } from '~/types/moneyFlow'

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

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

const monthKey = computed(
  () =>
    `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)

const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)

const isCurrentMonth = computed(() => {
  const today = new Date()
  return (
    selectedYear.value === today.getFullYear() &&
    selectedMonth.value === today.getMonth() + 1
  )
})

const {
  data: report,
  pending,
  error,
} = await useFetch<MoneyFlowReport>(
  () => `/api/reports/money-flow?month=${monthKey.value}`,
  {
    watch: [monthKey],
    default: () => null,
  },
)

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  const today = new Date()
  selectedYear.value = today.getFullYear()
  selectedMonth.value = today.getMonth() + 1
}

function selectMonth({ year, month }: { year: number; month: number }) {
  selectedYear.value = year
  selectedMonth.value = month
}
</script>

<template>
  <div class="money-flow-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Relatórios"
      description="Análise detalhada das suas finanças"
    >
      <template #actions>
        <UiMonthSwitcher
          :label="report?.fullLabel ?? monthLabel"
          :year="selectedYear"
          :month="selectedMonth"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
          @select="selectMonth"
        />
      </template>
    </PageHeading>

    <ReportsReportTabs />

    <UiCard class="money-flow-page__card" padding="md">
      <UiSkeleton v-if="pending && !report" height="28rem" radius="md" />
      <UiEmptyState
        v-else-if="error"
        title="Não foi possível montar a origem e o destino"
        description="Tente novamente em instantes."
      />
      <ReportsMoneyFlowChart v-else-if="report" :report="report" />
    </UiCard>
  </div>
</template>

<style scoped>
.money-flow-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
