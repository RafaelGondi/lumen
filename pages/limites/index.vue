<script setup lang="ts">
import { BarChart3, Plus, Repeat2 } from '@lucide/vue'
import type { GlobalLimitReport, LimitRow, LimitScope, LimitsReport } from '~/types/limits'

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
const scope = ref<LimitScope>('category')

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

const scopeOptions = [
  { value: 'category' as const, label: 'Categoria' },
  { value: 'supercategory' as const, label: 'Supercategoria' },
]

const {
  data: globalReport,
  pending: globalPending,
  refresh: refreshGlobal,
} = await useFetch<GlobalLimitReport>(
  () => `/api/limits/global?month=${monthKey.value}`,
  {
    watch: [monthKey],
    default: () => null,
  },
)

const {
  data: report,
  pending,
  error,
  refresh: refreshLimits,
} = await useFetch<LimitsReport>(
  () => `/api/limits?month=${monthKey.value}&scope=${scope.value}`,
  {
    watch: [monthKey, scope],
    default: () => null,
  },
)

const drawerOpen = ref(false)
const editingRow = ref<LimitRow | null>(null)

const totalPercent = computed(() => {
  if (!report.value?.totalLimited) return 0
  return Math.min(
    100,
    (report.value.totalSpentLimited / report.value.totalLimited) * 100,
  )
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

function openDrawer(row: LimitRow) {
  editingRow.value = row
  drawerOpen.value = true
}

async function refreshAll() {
  await Promise.all([refreshGlobal(), refreshLimits()])
}

function rowPercent(row: LimitRow) {
  if (!row.limitAmount) return 0
  return Math.min(100, (row.spent / row.limitAmount) * 100)
}
</script>

<template>
  <div class="limits-page">
    <PageHeading
      eyebrow="Financeiro / Limites"
      title="Limites de gasto"
      description="Defina o teto mensal global e limites por categoria ou supercategoria."
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

    <LimitsGlobalLimitCard
      :month="monthKey"
      :report="globalReport"
      :pending="globalPending"
      @saved="refreshAll"
    />

    <UiCard class="limits-list" padding="none">
      <header class="limits-list__header">
        <div class="limits-list__title">
          <span class="limits-list__icon" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <h2>Limites do mês</h2>
            <p>{{ report?.fullLabel ?? monthLabel }}</p>
          </div>
        </div>

        <div class="limits-list__toolbar">
          <UiSegmentedControl v-model="scope" :options="scopeOptions" />
          <div v-if="report" class="limits-list__summary">
            <p>Gasto / Limite</p>
            <strong>
              <UiMoney :value="report.totalSpentLimited" />
              <span>/ <UiMoney :value="report.totalLimited" /></span>
            </strong>
          </div>
        </div>
      </header>

      <div v-if="error" class="limits-list__body">
        <UiEmptyState
          title="Não foi possível carregar os limites"
          description="Tente novamente em instantes."
        />
      </div>

      <div v-else-if="pending && !report" class="limits-list__body">
        <UiSkeleton height="16rem" radius="md" />
      </div>

      <template v-else-if="report">
        <div v-if="report.totalLimited > 0" class="limits-list__total-bar">
          <div class="limits-list__total-copy">
            <span>Total limitado</span>
            <strong :class="{ 'is-danger': report.totalSpentLimited > report.totalLimited }">
              {{ totalPercent.toFixed(0) }}%
            </strong>
          </div>
          <div
            class="limits-list__track"
            :class="{ 'is-danger': report.totalSpentLimited > report.totalLimited }"
          >
            <span :style="{ width: `${totalPercent}%` }" />
          </div>
        </div>

        <p class="limits-list__hint">
          Gastos contados pela data da transação, como no radar da visão geral.
        </p>

        <UiEmptyState
          v-if="!report.rows.length"
          title="Nenhuma categoria de despesa"
          description="Cadastre categorias de despesa para definir limites."
        />

        <ul v-else class="limits-list__rows">
          <li v-for="row in report.rows" :key="`${scope}-${row.referenceId}`">
            <CategoriesCategoryIconChip
              :icon="row.icon"
              :color="row.color"
              size="sm"
            />

            <div class="limits-list__copy">
              <strong>{{ row.label }}</strong>
              <span v-if="row.recurring" class="limits-list__badge">
                <Repeat2 aria-hidden="true" />
                Todo mês
              </span>
            </div>

            <div
              v-if="row.limitAmount !== null"
              class="limits-list__progress"
              :class="{ 'is-danger': row.spent > row.limitAmount }"
            >
              <span :style="{ width: `${rowPercent(row)}%` }" />
            </div>

            <div class="limits-list__amounts">
              <template v-if="row.limitAmount !== null">
                <strong :class="{ 'is-danger': row.spent > row.limitAmount }">
                  <UiMoney :value="row.spent" />
                </strong>
                <span>de <UiMoney :value="row.limitAmount" /></span>
              </template>
              <template v-else>
                <strong><UiMoney :value="row.spent" /></strong>
              </template>
            </div>

            <button
              type="button"
              class="limits-list__action"
              :aria-label="
                row.limitAmount
                  ? `Editar limite de ${row.label}`
                  : `Definir limite de ${row.label}`
              "
              @click="openDrawer(row)"
            >
              <Plus v-if="!row.limitAmount" aria-hidden="true" />
              <span v-else>Editar</span>
            </button>
          </li>
        </ul>
      </template>
    </UiCard>

    <LimitsLimitFormDrawer
      v-if="editingRow"
      v-model:open="drawerOpen"
      :row="editingRow"
      :scope="scope"
      :month="monthKey"
      @saved="refreshLimits"
    />
  </div>
</template>

<style scoped>
.limits-page {
  display: grid;
  gap: var(--space-6);
}

.limits-list__header,
.limits-list__body,
.limits-list__total-bar,
.limits-list__hint,
.limits-list__rows {
  padding-right: var(--space-6);
  padding-left: var(--space-6);
}

.limits-list__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.limits-list__title,
.limits-list__toolbar {
  display: flex;
  gap: var(--space-3);
}

.limits-list__toolbar {
  flex-wrap: wrap;
  align-items: end;
}

.limits-list__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.limits-list__icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.limits-list__title h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.limits-list__title p,
.limits-list__summary p,
.limits-list__hint {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-list__summary strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.limits-list__summary strong span {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.limits-list__total-bar {
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.limits-list__total-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-list__total-copy strong.is-danger {
  color: var(--color-negative-ink);
}

.limits-list__track {
  overflow: hidden;
  height: 0.5rem;
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.limits-list__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand);
}

.limits-list__track.is-danger span {
  background: var(--color-negative);
}

.limits-list__hint {
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

.limits-list__rows {
  margin: 0;
  padding-top: 0;
  padding-bottom: 0;
  list-style: none;
}

.limits-list__rows li {
  display: grid;
  align-items: center;
  gap: var(--space-3);
  grid-template-columns: auto minmax(0, 1fr) minmax(5rem, 7rem) auto auto;
  padding: var(--space-4) 0;
  border-top: 1px solid var(--color-border);
}

.limits-list__copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.limits-list__copy strong {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limits-list__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-round);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
}

.limits-list__badge svg {
  width: 0.75rem;
  height: 0.75rem;
}

.limits-list__progress {
  overflow: hidden;
  height: 0.35rem;
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.limits-list__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand);
}

.limits-list__progress.is-danger span {
  background: var(--color-negative);
}

.limits-list__amounts {
  text-align: right;
}

.limits-list__amounts strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.limits-list__amounts strong.is-danger {
  color: var(--color-negative-ink);
}

.limits-list__amounts span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-list__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.limits-list__action:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

@media (max-width: 760px) {
  .limits-list__rows li {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'icon copy action'
      'progress progress progress'
      'amounts amounts amounts';
  }

  .limits-list__copy {
    grid-area: copy;
  }

  .limits-list__progress {
    grid-area: progress;
  }

  .limits-list__amounts {
    grid-area: amounts;
    text-align: left;
  }

  .limits-list__action {
    grid-area: action;
  }
}
</style>
