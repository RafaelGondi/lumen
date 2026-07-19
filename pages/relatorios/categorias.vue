<script setup lang="ts">
import { BarChart3, CreditCard, Landmark, PieChart } from '@lucide/vue'
import type {
  CategorySpendReport,
  CategorySpendRow,
  CategorySpendScope,
} from '~/types/categorySpendReport'
import type { CardInvoiceCategorySpend } from '~/types/cardInvoice'

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
const scope = ref<CategorySpendScope>('category')

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
  data: report,
  pending,
  error,
} = await useFetch<CategorySpendReport>(
  () =>
    `/api/reports/category-spend?month=${monthKey.value}&scope=${scope.value}`,
  {
    watch: [monthKey, scope],
    default: () => null,
  },
)

const drawerOpen = ref(false)
const selectedRow = ref<CategorySpendRow | null>(null)

const topRow = computed(() => report.value?.rows[0] ?? null)

const accountShare = computed(() => {
  if (!report.value?.monthTotal) return 0
  return Math.round(
    (report.value.sourceTotals.account / report.value.monthTotal) * 100,
  )
})

const cardShare = computed(() => {
  if (!report.value?.monthTotal) return 0
  return 100 - accountShare.value
})

const donutItems = computed<CardInvoiceCategorySpend[]>(() =>
  (report.value?.rows ?? []).map((row) => ({
    id: String(row.referenceId),
    name: row.label,
    color: row.color,
    amount: row.amount,
    percent: row.percent,
  })),
)

const kpiCards = computed(() => {
  if (!report.value) return []
  return [
    {
      key: 'total',
      label: 'Total do mês',
      value: report.value.monthTotal,
      support: `${report.value.rows.length} ${scope.value === 'category' ? 'categorias' : 'supercategorias'} com gasto`,
      tone: 'neutral' as const,
    },
    {
      key: 'top',
      label:
        scope.value === 'category'
          ? 'Maior categoria'
          : 'Maior supercategoria',
      value: topRow.value?.amount ?? 0,
      support: topRow.value
        ? `${topRow.value.percent}% · ${topRow.value.itemCount} lanç.`
        : 'Sem gastos',
      tone: 'neutral' as const,
    },
    {
      key: 'mix',
      label: 'Conta vs cartão',
      value: report.value.sourceTotals.card,
      support: `${cardShare.value}% cartão · ${accountShare.value}% conta`,
      tone: 'neutral' as const,
    },
  ]
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

function openRow(row: CategorySpendRow) {
  selectedRow.value = row
  drawerOpen.value = true
}

function rowPercent(row: CategorySpendRow) {
  if (!report.value?.monthTotal) return 0
  return Math.min(100, (row.amount / report.value.monthTotal) * 100)
}
</script>

<template>
  <div class="category-report">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Gastos por categoria"
      description="Composição mensal das despesas por data da transação."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="report?.fullLabel ?? monthLabel"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
        />
      </template>
    </PageHeading>

    <ReportsReportTabs />

    <div v-if="error" class="category-report__error">
      <UiEmptyState
        title="Não foi possível carregar o relatório"
        description="Tente novamente em instantes."
      />
    </div>

    <template v-else>
      <section class="category-report__kpis" aria-label="Resumo do mês">
        <template v-if="pending && !report">
          <UiCard v-for="index in 3" :key="index">
            <UiSkeleton width="6rem" height="0.8rem" />
            <UiSkeleton
              width="8rem"
              height="1.6rem"
              class="category-report__gap"
            />
            <UiSkeleton
              width="4rem"
              height="0.7rem"
              class="category-report__gap"
            />
          </UiCard>
        </template>
        <UiCard
          v-for="card in kpiCards"
          v-else
          :key="card.key"
          class="category-report__kpi"
        >
          <p class="category-report__kpi-label">{{ card.label }}</p>
          <p class="category-report__kpi-value">
            <UiMoney :value="card.value" />
          </p>
          <p class="category-report__kpi-support">{{ card.support }}</p>
        </UiCard>
      </section>

      <UiCard class="category-report__composition" padding="none">
        <header class="category-report__header">
          <div class="category-report__title">
            <span class="category-report__icon" aria-hidden="true">
              <PieChart />
            </span>
            <div>
              <h2>Composição</h2>
              <p>{{ report?.fullLabel ?? monthLabel }}</p>
            </div>
          </div>

          <div class="category-report__toolbar">
            <UiSegmentedControl v-model="scope" :options="scopeOptions" />
          </div>
        </header>

        <div v-if="pending && !report" class="category-report__body">
          <UiSkeleton height="10rem" radius="md" />
        </div>

        <UiEmptyState
          v-else-if="!report?.rows.length"
          class="category-report__body"
          title="Nenhum gasto neste mês"
          description="Não há despesas contabilizadas neste período."
        />

        <div v-else class="category-report__donut">
          <CardsInvoiceSpendDonut
            :items="donutItems"
            :others-label="
              scope === 'category' ? 'categorias' : 'supercategorias'
            "
          />
        </div>
      </UiCard>

      <UiCard class="category-report__list" padding="none">
        <header class="category-report__list-header">
          <div class="category-report__title">
            <span class="category-report__icon" aria-hidden="true">
              <BarChart3 />
            </span>
            <div>
              <h2>Detalhamento</h2>
              <p>
                Gastos contados pela data da transação, como no radar da visão
                geral.
              </p>
            </div>
          </div>
        </header>

        <ul v-if="report?.rows.length" class="category-report__rows">
          <li v-for="row in report.rows" :key="row.referenceId">
            <button type="button" @click="openRow(row)">
              <CategoriesCategoryIconChip
                :icon="row.icon"
                :color="row.color"
                size="sm"
              />

              <div class="category-report__row-copy">
                <strong>{{ row.label }}</strong>
                <div class="category-report__track">
                  <span
                    :style="{
                      width: `${rowPercent(row)}%`,
                      background: row.color,
                    }"
                  />
                </div>
              </div>

              <div class="category-report__row-meta">
                <span>
                  <Landmark aria-hidden="true" />
                  <UiMoney :value="row.sourceTotals.account" />
                </span>
                <span>
                  <CreditCard aria-hidden="true" />
                  <UiMoney :value="row.sourceTotals.card" />
                </span>
              </div>

              <div class="category-report__row-amounts">
                <strong><UiMoney :value="row.amount" /></strong>
                <span>{{ row.percent }}%</span>
              </div>
            </button>
          </li>
        </ul>
      </UiCard>
    </template>

    <DashboardSpendingGuardBreakdownDrawer
      v-if="selectedRow"
      v-model:open="drawerOpen"
      :title="`${selectedRow.label} · ${report?.fullLabel ?? monthLabel}`"
      :total="selectedRow.amount"
      :source-totals="selectedRow.sourceTotals"
      :groups="[selectedRow.breakdown]"
    />
  </div>
</template>

<style scoped>
.category-report {
  display: grid;
  gap: var(--space-4);
}

.category-report__gap {
  margin-top: var(--space-3);
}

.category-report__kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.category-report__kpi-label {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-report__kpi-value {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: clamp(1.125rem, 1.6vw, var(--text-lg));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.category-report__kpi-support {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-report__header,
.category-report__body,
.category-report__donut,
.category-report__list-header,
.category-report__rows {
  padding-right: var(--space-6);
  padding-left: var(--space-6);
}

.category-report__header,
.category-report__list-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.category-report__title {
  display: flex;
  gap: var(--space-3);
}

.category-report__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.category-report__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.category-report__icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.category-report__title h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.category-report__title p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-report__body,
.category-report__donut {
  padding-top: var(--space-5);
  padding-bottom: var(--space-5);
}

.category-report__rows {
  margin: 0;
  padding-top: 0;
  padding-bottom: 0;
  list-style: none;
}

.category-report__rows li + li {
  border-top: 1px solid var(--color-border);
}

.category-report__rows button {
  display: grid;
  width: 100%;
  align-items: center;
  gap: var(--space-3);
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  padding: var(--space-4) 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.category-report__rows button:hover {
  background: var(--color-surface-subtle);
}

.category-report__row-copy strong {
  display: block;
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-report__track {
  overflow: hidden;
  height: 0.35rem;
  margin-top: var(--space-2);
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.category-report__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.category-report__row-meta {
  display: grid;
  gap: 0.2rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.category-report__row-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.category-report__row-meta svg {
  width: 0.75rem;
  height: 0.75rem;
}

.category-report__row-amounts {
  min-width: 5.5rem;
  text-align: right;
}

.category-report__row-amounts strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.category-report__row-amounts span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

@media (max-width: 960px) {
  .category-report__kpis {
    grid-template-columns: 1fr;
  }

  .category-report__rows button {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'icon copy'
      'amounts amounts'
      'meta meta';
  }

  .category-report__row-copy {
    grid-area: copy;
  }

  .category-report__row-meta {
    grid-area: meta;
  }

  .category-report__row-amounts {
    grid-area: amounts;
    text-align: left;
  }
}
</style>
