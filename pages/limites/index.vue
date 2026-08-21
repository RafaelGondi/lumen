<script setup lang="ts">
import { BarChart3, CircleDollarSign, PiggyBank, WalletCards } from '@lucide/vue'
import type {
  GlobalLimitReport,
  LimitBreakdownReport,
  LimitRow,
  LimitScope,
  LimitsReport,
} from '~/types/limits'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)
const monthKey = computed(
  () => `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)
const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)
const isCurrentMonth = computed(() => {
  const today = new Date()
  return selectedYear.value === today.getFullYear() && selectedMonth.value === today.getMonth() + 1
})

const {
  data: globalReport,
  pending: globalPending,
  refresh: refreshGlobal,
} = await useFetch<GlobalLimitReport>(
  () => `/api/limits/global?month=${monthKey.value}`,
  { watch: [monthKey], default: () => null },
)

const {
  data: categoryReport,
  pending: categoryPending,
  error: categoryError,
  refresh: refreshCategories,
} = await useFetch<LimitsReport>(
  () => `/api/limits?month=${monthKey.value}&scope=category`,
  { watch: [monthKey], default: () => null },
)

const {
  data: supercategoryReport,
  pending: supercategoryPending,
  error: supercategoryError,
  refresh: refreshSupercategories,
} = await useFetch<LimitsReport>(
  () => `/api/limits?month=${monthKey.value}&scope=supercategory`,
  { watch: [monthKey], default: () => null },
)

const drawerOpen = ref(false)
const editingRow = ref<LimitRow | null>(null)
const editingScope = ref<LimitScope>('category')
const breakdownOpen = ref(false)
const breakdownPending = ref(false)
const selectedBreakdown = ref<LimitBreakdownReport | null>(null)

const loading = computed(
  () =>
    (categoryPending.value && !categoryReport.value) ||
    (supercategoryPending.value && !supercategoryReport.value),
)
const hasError = computed(() => Boolean(categoryError.value || supercategoryError.value))
const spendingLimit = computed(() => globalReport.value?.computedLimit ?? null)
const savingsGoal = computed(() => {
  if (!globalReport.value || spendingLimit.value === null) return null
  return Math.max(0, globalReport.value.expectedIncome - spendingLimit.value)
})
const totalSpent = computed(() => categoryReport.value?.totalSpent ?? 0)
const plannedBudget = computed(() => {
  if (!categoryReport.value || !supercategoryReport.value) return 0
  const categories = categoryReport.value.rows
  return supercategoryReport.value.rows.reduce((sum, group) => {
    if (group.limitAmount !== null) return sum + group.limitAmount
    return sum + categories
      .filter((row) => row.parentReferenceId === group.referenceId)
      .reduce((subtotal, row) => subtotal + (row.limitAmount ?? 0), 0)
  }, 0)
})
const remainingToSpend = computed(() =>
  spendingLimit.value === null ? null : spendingLimit.value - totalSpent.value,
)
const unallocatedBudget = computed(() =>
  spendingLimit.value === null ? null : spendingLimit.value - plannedBudget.value,
)
const spendingPercent = computed(() => {
  if (!spendingLimit.value || spendingLimit.value <= 0) return 0
  return Math.min(100, (totalSpent.value / spendingLimit.value) * 100)
})
const summaryTone = computed(() => {
  if (remainingToSpend.value === null) return 'neutral'
  if (remainingToSpend.value < 0) return 'danger'
  if (spendingPercent.value >= 80) return 'warning'
  return 'positive'
})

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
function openDrawer(scope: LimitScope, row: LimitRow) {
  editingScope.value = scope
  editingRow.value = row
  drawerOpen.value = true
}
async function openBreakdown(scope: LimitScope, row: LimitRow) {
  if (row.spent <= 0) return
  breakdownPending.value = true
  breakdownOpen.value = true
  selectedBreakdown.value = null
  try {
    selectedBreakdown.value = await $fetch<LimitBreakdownReport>('/api/limits/breakdown', {
      query: { month: monthKey.value, scope, referenceId: row.referenceId },
    })
  } finally {
    breakdownPending.value = false
  }
}
async function refreshAll() {
  await Promise.all([refreshGlobal(), refreshCategories(), refreshSupercategories()])
}
</script>

<template>
  <div class="limits-page">
    <PageHeading
      eyebrow="Financeiro / Orçamento"
      title="Orçamento mensal"
      description="Planeje seus gastos, acompanhe o utilizado e veja quanto ainda está disponível."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="monthLabel"
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

    <div class="limits-layout">
      <UiCard class="limits-budget" padding="none">
        <header class="limits-budget__header">
          <div class="limits-budget__title">
            <span aria-hidden="true"><BarChart3 /></span>
            <div>
              <h2>Planejamento de despesas</h2>
              <p>{{ categoryReport?.fullLabel ?? monthLabel }}</p>
            </div>
          </div>
          <p class="limits-budget__hint">
            Compras contam na data da transação, inclusive no cartão.
          </p>
        </header>

        <div v-if="hasError" class="limits-budget__state">
          <UiEmptyState
            title="Não foi possível carregar o orçamento"
            description="Tente novamente em instantes."
          />
        </div>
        <div v-else-if="loading" class="limits-budget__state">
          <UiSkeleton height="28rem" radius="md" />
        </div>
        <LimitsBudgetTable
          v-else-if="categoryReport && supercategoryReport"
          :categories="categoryReport.rows"
          :supercategories="supercategoryReport.rows"
          @edit="openDrawer"
          @breakdown="openBreakdown"
        />
      </UiCard>

      <aside class="limits-sidebar">
        <UiCard class="budget-summary" padding="none">
          <header class="budget-summary__header">
            <div>
              <p>Resumo de {{ monthLabel }}</p>
              <h2>Restante para gastar</h2>
            </div>
            <span aria-hidden="true"><WalletCards /></span>
          </header>

          <div v-if="globalPending && !globalReport" class="budget-summary__body">
            <UiSkeleton height="13rem" radius="md" />
          </div>
          <div v-else class="budget-summary__body">
            <strong class="budget-summary__primary numeric" :class="`is-${summaryTone}`">
              <UiMoney v-if="remainingToSpend !== null" :value="remainingToSpend" />
              <span v-else>—</span>
            </strong>

            <div class="budget-summary__progress" :class="`is-${summaryTone}`">
              <span :style="{ width: `${spendingPercent}%` }" />
            </div>
            <p class="budget-summary__progress-copy">
              <span><UiMoney :value="totalSpent" /> utilizados</span>
              <span>{{ spendingPercent.toFixed(0) }}%</span>
            </p>

            <dl class="budget-summary__metrics">
              <div>
                <dt><CircleDollarSign /> Receita prevista</dt>
                <dd><UiMoney :value="globalReport?.expectedIncome ?? 0" /></dd>
              </div>
              <div>
                <dt><PiggyBank /> Meta de economia</dt>
                <dd>
                  <UiMoney v-if="savingsGoal !== null" :value="savingsGoal" />
                  <span v-else>—</span>
                </dd>
              </div>
              <div>
                <dt>Teto de gastos</dt>
                <dd>
                  <UiMoney v-if="spendingLimit !== null" :value="spendingLimit" />
                  <span v-else>—</span>
                </dd>
              </div>
              <div>
                <dt>Planejado</dt>
                <dd><UiMoney :value="plannedBudget" /></dd>
              </div>
              <div class="budget-summary__unallocated">
                <dt>Livre para distribuir</dt>
                <dd :class="{ 'is-danger': unallocatedBudget !== null && unallocatedBudget < 0 }">
                  <UiMoney v-if="unallocatedBudget !== null" :value="unallocatedBudget" />
                  <span v-else>—</span>
                </dd>
              </div>
            </dl>
          </div>
        </UiCard>

        <LimitsGlobalLimitCard
          :month="monthKey"
          :report="globalReport"
          :pending="globalPending"
          @saved="refreshAll"
        />
      </aside>
    </div>

    <LimitsLimitFormDrawer
      v-if="editingRow"
      v-model:open="drawerOpen"
      :row="editingRow"
      :scope="editingScope"
      :month="monthKey"
      @saved="refreshAll"
    />
    <DashboardLimitBreakdownDrawer
      v-if="selectedBreakdown"
      v-model:open="breakdownOpen"
      :report="selectedBreakdown"
      :pending="breakdownPending"
    />
  </div>
</template>

<style scoped>
.limits-page { display: grid; gap: var(--space-6); }
.limits-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 21rem);
  align-items: start;
  gap: var(--space-5);
}
.limits-budget { min-width: 0; }
.limits-budget__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}
.limits-budget__title { display: flex; align-items: center; gap: var(--space-3); }
.limits-budget__title > span,
.budget-summary__header > span {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}
.limits-budget__title svg,
.budget-summary__header svg { width: 1.05rem; height: 1.05rem; }
.limits-budget__title h2,
.budget-summary__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}
.limits-budget__title p,
.limits-budget__hint,
.budget-summary__header p { color: var(--color-ink-muted); font-size: var(--text-xs); }
.limits-budget__title p { margin-top: 0.15rem; }
.limits-budget__hint { max-width: 18rem; text-align: right; }
.limits-budget__state { padding: var(--space-5); }
.limits-sidebar {
  position: sticky;
  top: calc(var(--header-height) + var(--space-4));
  display: grid;
  gap: var(--space-4);
}
.budget-summary__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}
.budget-summary__header h2 { margin-top: var(--space-1); }
.budget-summary__body { padding: var(--space-5); }
.budget-summary__primary {
  display: block;
  font-size: var(--text-metric);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.025em;
}
.budget-summary__primary.is-positive { color: var(--color-positive-ink); }
.budget-summary__primary.is-warning { color: var(--color-warning); }
.budget-summary__primary.is-danger { color: var(--color-negative-ink); }
.budget-summary__primary.is-neutral { color: var(--color-ink-muted); }
.budget-summary__progress {
  height: 0.45rem;
  overflow: hidden;
  margin-top: var(--space-4);
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}
.budget-summary__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}
.budget-summary__progress.is-warning span { background: var(--color-warning); }
.budget-summary__progress.is-danger span { background: var(--color-negative); }
.budget-summary__progress-copy {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}
.budget-summary__metrics { display: grid; margin-top: var(--space-5); }
.budget-summary__metrics > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}
.budget-summary__metrics dt {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}
.budget-summary__metrics dt svg { width: 0.9rem; height: 0.9rem; }
.budget-summary__metrics dd {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.budget-summary__unallocated dd { color: var(--color-positive-ink); }
.budget-summary__unallocated dd.is-danger { color: var(--color-negative-ink); }

@media (max-width: 1100px) {
  .limits-layout { grid-template-columns: 1fr; }
  .limits-sidebar {
    position: static;
    grid-row: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .limits-page { gap: var(--space-4); }
  .limits-sidebar { grid-template-columns: 1fr; }
  .limits-budget__header {
    align-items: flex-start;
    flex-direction: column;
    padding: var(--space-4);
  }
  .limits-budget__hint { text-align: left; }
}
</style>
