<script setup lang="ts">
import {
  CalendarRange,
  Gauge,
  Info,
  TrendingDown,
  TrendingUp,
} from '@lucide/vue'
import type { Category, Supercategory } from '~/types/category'
import type {
  SpendingPaceDay,
  SpendingPaceReport,
  SpendingPaceView,
} from '~/types/spendingPace'

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
const view = ref<SpendingPaceView>('cumulative')
const filterDimension = ref<'category' | 'supercategory'>('category')
const selectedCategoryIds = ref<number[]>([])
const selectedSupercategoryIds = ref<number[]>([])
const selectedDayNumber = ref<number | null>(null)
const extendPreviousMonth = ref(false)

const viewOptions = [
  { value: 'cumulative' as const, label: 'Acumulado' },
  { value: 'daily' as const, label: 'Por dia' },
]
const filterDimensionOptions = [
  { value: 'category' as const, label: 'Categoria' },
  { value: 'supercategory' as const, label: 'Supercategoria' },
]

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
const categoryQuery = computed(() =>
  selectedCategoryIds.value.length
    ? `&categories=${selectedCategoryIds.value.join(',')}`
    : '',
)
const supercategoryQuery = computed(() =>
  selectedSupercategoryIds.value.length
    ? `&supercategories=${selectedSupercategoryIds.value.join(',')}`
    : '',
)

const { data: categories } = await useFetch<Category[]>('/api/categories', {
  default: () => [],
})
const { data: supercategories } = await useFetch<Supercategory[]>(
  '/api/supercategories',
  { default: () => [] },
)
const expenseCategories = computed(() =>
  categories.value.filter((category) => category.type === 'expense'),
)
const expenseSupercategories = computed(() =>
  supercategories.value.filter((supercategory) =>
    supercategory.categories.some((category) => category.type === 'expense'),
  ),
)
const selectedDimensionIds = computed<number[]>({
  get: () =>
    filterDimension.value === 'category'
      ? selectedCategoryIds.value
      : selectedSupercategoryIds.value,
  set: (value) => {
    if (filterDimension.value === 'category') selectedCategoryIds.value = value
    else selectedSupercategoryIds.value = value
  },
})
const dimensionOptions = computed(() =>
  filterDimension.value === 'category'
    ? expenseCategories.value
    : expenseSupercategories.value,
)
const dimensionSingular = computed(() =>
  filterDimension.value === 'category' ? 'categoria' : 'supercategoria',
)
const dimensionPlural = computed(() =>
  filterDimension.value === 'category' ? 'Categorias' : 'Supercategorias',
)

watch(filterDimension, () => {
  selectedCategoryIds.value = []
  selectedSupercategoryIds.value = []
})

watch(monthKey, () => {
  extendPreviousMonth.value = false
})

const {
  data: report,
  pending,
  error,
} = await useFetch<SpendingPaceReport>(
  () =>
    `/api/reports/spending-pace?month=${monthKey.value}${categoryQuery.value}${supercategoryQuery.value}`,
  {
    watch: [monthKey, categoryQuery, supercategoryQuery],
    default: () => null,
  },
)

const differenceTone = computed(() => {
  const difference = report.value?.difference ?? 0
  if (difference === 0) return 'neutral'
  return difference < 0 ? 'positive' : 'negative'
})
const differenceSupport = computed(() => {
  const value = report.value?.percentChange
  if (value === null || value === undefined) return 'sem base comparável'
  if (value === 0) return 'mesmo ritmo do mês anterior'
  return `${Math.abs(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ${value < 0 ? 'mais lento' : 'mais rápido'}`
})
const currentPeriodLabel = computed(() =>
  report.value?.isCurrentMonth
    ? `Comprado até o dia ${report.value.cutoffDay}`
    : 'Comprado no mês',
)
const previousPeriodLabel = computed(() =>
  report.value?.isCurrentMonth
    ? `Mesmo período de ${MONTH_NAMES[Number(report.value.previousMonth.slice(5, 7)) - 1]}`
    : report.value?.previousMonthLabel ?? 'Mês anterior',
)

const selectedDay = computed<SpendingPaceDay | null>(() => {
  if (!report.value || selectedDayNumber.value === null) return null
  return report.value.days.find((day) => day.day === selectedDayNumber.value) ?? null
})
const selectedTitle = computed(() => {
  if (!selectedDay.value) return 'Selecione um dia'
  return `Dia ${selectedDay.value.day}`
})

watch(
  report,
  (value) => {
    selectedDayNumber.value = value?.cutoffDay || null
  },
  { immediate: true },
)

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  const today = new Date(now.getFullYear(), now.getMonth(), 1)
  if (date > today) return
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  selectedYear.value = now.getFullYear()
  selectedMonth.value = now.getMonth() + 1
}

function selectMonth({ year, month }: { year: number; month: number }) {
  const selected = new Date(year, month - 1, 1)
  const today = new Date(now.getFullYear(), now.getMonth(), 1)
  if (selected > today) return
  selectedYear.value = year
  selectedMonth.value = month
}

function openDay(day: number) {
  selectedDayNumber.value = day
}

function itemSupport(item: SpendingPaceDay['currentItems'][number]) {
  const source = item.cardName ?? item.accountName ?? 'Sem conta'
  if (item.recurrence === 'installment' && item.installmentCount) {
    return `${source} · ${item.installmentCount}x · valor total da compra`
  }
  return `${source} · compra avulsa`
}

function dayTotal(items: SpendingPaceDay['currentItems']) {
  return items.reduce((sum, item) => sum + item.amount, 0)
}

function shortDate(date: string | null) {
  if (!date) return 'Dia inexistente neste mês'
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
</script>

<template>
  <div class="spending-pace">
    <PageHeading
      eyebrow=""
      title="Ritmo de gastos"
      description="Compare a velocidade das compras deste mês com o mês anterior."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="report?.monthLabel ?? monthLabel"
          :year="selectedYear"
          :month="selectedMonth"
          :can-go-previous="true"
          :can-go-next="!isCurrentMonth"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
          @select="selectMonth"
        />
      </template>
    </PageHeading>

    <ReportsReportTabs />

    <UiCard class="spending-pace__notice" padding="md">
      <Info aria-hidden="true" />
      <p>
        Considera compras avulsas e parceladas na data da compra. Em compras
        parceladas, o gráfico mostra o valor integral assumido, não apenas a parcela.
      </p>
    </UiCard>

    <UiEmptyState
      v-if="error"
      title="Não foi possível comparar os gastos"
      description="Tente novamente em instantes."
    />

    <template v-else>
      <section class="spending-pace__kpis" aria-label="Resumo do ritmo de gastos">
        <template v-if="pending && !report">
          <UiCard v-for="index in 4" :key="index">
            <UiSkeleton width="8rem" height="0.8rem" />
            <UiSkeleton width="7rem" height="1.6rem" class="spending-pace__gap" />
          </UiCard>
        </template>
        <template v-else-if="report">
          <UiCard class="spending-pace__kpi">
            <span>{{ currentPeriodLabel }}</span>
            <strong><UiMoney :value="report.currentTotal" /></strong>
            <small>{{ report.cutoffDay }} de {{ report.daysInMonth }} dias</small>
          </UiCard>
          <UiCard class="spending-pace__kpi">
            <span>{{ previousPeriodLabel }}</span>
            <strong><UiMoney :value="report.previousComparableTotal" /></strong>
            <small v-if="report.isCurrentMonth">até o mesmo dia</small>
            <small v-else>mês completo</small>
          </UiCard>
          <UiCard class="spending-pace__kpi" :class="`is-${differenceTone}`">
            <span>Diferença no ritmo</span>
            <strong>
              {{ report.difference > 0 ? '+' : report.difference < 0 ? '−' : '' }}
              <UiMoney :value="Math.abs(report.difference)" />
            </strong>
            <small>{{ differenceSupport }}</small>
          </UiCard>
          <UiCard class="spending-pace__kpi">
            <span>{{ report.isCurrentMonth ? 'Projeção no ritmo atual' : 'Fechamento do mês' }}</span>
            <strong><UiMoney :value="report.projectedTotal" /></strong>
            <small>{{ report.isCurrentMonth ? 'média diária linear' : 'valor realizado' }}</small>
          </UiCard>
        </template>
      </section>

      <UiCard v-if="report" class="spending-pace__chart" padding="lg">
        <header class="spending-pace__chart-header">
          <div>
            <span class="spending-pace__eyebrow"><Gauge /> Velocidade de consumo</span>
            <h2>{{ view === 'cumulative' ? 'Compras acumuladas' : 'Compras por dia' }}</h2>
            <p>Selecione um ponto para conferir as compras daquele dia.</p>
          </div>
          <div class="spending-pace__chart-actions">
            <CategoriesCategoryMultiFilter
              v-model="selectedDimensionIds"
              v-model:scope="filterDimension"
              :options="dimensionOptions"
              :singular="dimensionSingular"
              :plural="dimensionPlural"
              :scope-options="filterDimensionOptions"
            />
            <UiSegmentedControl v-model="view" :options="viewOptions" />
            <UiButton
              v-if="report.isCurrentMonth"
              variant="secondary"
              size="sm"
              class="spending-pace__extend"
              :class="{ 'is-active': extendPreviousMonth }"
              :aria-pressed="extendPreviousMonth"
              @click="extendPreviousMonth = !extendPreviousMonth"
            >
              <template #leading><CalendarRange /></template>
              Mês anterior completo
            </UiButton>
          </div>
        </header>

        <ReportsSpendingPaceChart
          :days="report.days"
          :view="view"
          :current-label="report.monthLabel"
          :previous-label="report.previousMonthLabel"
          :cutoff-day="report.cutoffDay"
          :extend-previous="extendPreviousMonth"
          :selected-day="selectedDayNumber"
          @select="openDay"
        />

        <p
          v-if="report.isCurrentMonth && extendPreviousMonth"
          class="spending-pace__extension-note"
        >
          A linha de {{ report.previousMonthLabel }} continua até o fim daquele
          mês. A curva atual permanece limitada ao dia {{ report.cutoffDay }}.
        </p>

        <div class="spending-pace__reading" :class="`is-${differenceTone}`">
          <component
            :is="report.difference <= 0 ? TrendingDown : TrendingUp"
            aria-hidden="true"
          />
          <p v-if="report.difference < 0">
            Você assumiu <strong><UiMoney :value="Math.abs(report.difference)" /></strong>
            a menos que no período comparável de {{ report.previousMonthLabel }}.
          </p>
          <p v-else-if="report.difference > 0">
            Você assumiu <strong><UiMoney :value="report.difference" /></strong>
            a mais que no período comparável de {{ report.previousMonthLabel }}.
          </p>
          <p v-else>O ritmo está igual ao período comparável do mês anterior.</p>
        </div>

        <section v-if="selectedDay" class="spending-pace__day-detail">
          <header class="spending-pace__day-header">
            <div>
              <h2>{{ selectedTitle }}</h2>
              <p>Compras assumidas no mesmo dia de cada mês.</p>
            </div>
          </header>

          <div class="spending-pace__day-columns">
            <section
              v-for="period in [
                {
                  key: 'previous',
                  label: report.previousMonthLabel,
                  date: selectedDay.previousDate,
                  items: selectedDay.previousItems,
                },
                {
                  key: 'current',
                  label: report.monthLabel,
                  date: selectedDay.currentDate,
                  items: selectedDay.currentItems,
                },
              ]"
              :key="period.key"
              class="spending-pace__day-period"
            >
              <header>
                <div>
                  <strong>{{ period.label }}</strong>
                  <span>{{ shortDate(period.date) }}</span>
                </div>
                <div class="spending-pace__day-total">
                  <strong><UiMoney :value="dayTotal(period.items)" /></strong>
                  <span>{{ period.items.length }} {{ period.items.length === 1 ? 'compra' : 'compras' }}</span>
                </div>
              </header>

              <p v-if="!period.items.length" class="spending-pace__day-empty">
                Nenhuma compra neste dia.
              </p>
              <div v-else class="spending-pace__items">
                <article v-for="item in period.items" :key="item.id" class="spending-pace__item">
                  <CategoriesCategoryIconChip
                    :icon="item.categoryIcon ?? 'tag'"
                    :color="item.categoryColor ?? '#8297ad'"
                    size="md"
                  />
                  <div>
                    <strong>{{ item.description }}</strong>
                    <span>{{ itemSupport(item) }}</span>
                  </div>
                  <strong><UiMoney :value="item.amount" /></strong>
                </article>
              </div>
            </section>
          </div>
        </section>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.spending-pace {
  display: grid;
  gap: var(--space-4);
}

.spending-pace__notice {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.spending-pace__notice :deep(.ak-card__body) {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.spending-pace__notice :deep(.ak-card__body > svg) {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  color: var(--color-brand);
}

.spending-pace__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.spending-pace__kpi {
  min-height: 8rem;
}

.spending-pace__kpi :deep(.ak-card__body) {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.spending-pace__kpi :deep(.ak-card__body > span),
.spending-pace__kpi :deep(.ak-card__body > small) {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__kpi :deep(.ak-card__body > strong) {
  color: var(--color-ink);
  font-size: var(--text-xl);
}

.spending-pace__kpi.is-positive :deep(.ak-card__body > strong),
.spending-pace__reading.is-positive {
  color: var(--color-positive);
}

.spending-pace__kpi.is-negative :deep(.ak-card__body > strong),
.spending-pace__reading.is-negative {
  color: var(--color-negative);
}

.spending-pace__gap {
  margin-top: var(--space-3);
}

.spending-pace__chart {
  display: grid;
  gap: var(--space-5);
}

.spending-pace__chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-5);
}

.spending-pace__chart-header h2 {
  margin-top: var(--space-1);
  font-size: var(--text-lg);
}

.spending-pace__chart-header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.spending-pace__eyebrow svg {
  width: 1rem;
  height: 1rem;
}

.spending-pace__chart-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: var(--space-3);
}

.spending-pace__extend.is-active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

.spending-pace__extension-note {
  margin-top: calc(var(--space-3) * -1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__reading {
  display: flex;
  padding: var(--space-3) var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  font-size: var(--text-sm);
}

.spending-pace__reading svg {
  width: 1.1rem;
  height: 1.1rem;
  flex: 0 0 auto;
}

.spending-pace__day-detail {
  display: grid;
  padding-top: var(--space-5);
  gap: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.spending-pace__day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.spending-pace__day-header h2 {
  font-size: var(--text-md);
}

.spending-pace__day-header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__day-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.spending-pace__day-period {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.spending-pace__day-period > header {
  display: flex;
  padding: var(--space-4);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--color-surface-subtle);
}

.spending-pace__day-period > header > div {
  display: grid;
  gap: var(--space-1);
}

.spending-pace__day-period header span,
.spending-pace__day-total span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__day-total {
  text-align: right;
}

.spending-pace__day-empty {
  padding: var(--space-6) var(--space-4);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  text-align: center;
}

.spending-pace__items {
  display: grid;
  gap: 0;
}

.spending-pace__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: var(--space-3);
  align-items: center;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.spending-pace__item > div {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.spending-pace__item > div strong {
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spending-pace__item > div > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-pace__item > strong {
  font-size: var(--text-sm);
  white-space: nowrap;
}

@media (max-width: 960px) {
  .spending-pace__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .spending-pace__chart-header,
  .spending-pace__chart-actions {
    flex-direction: column;
  }

  .spending-pace__chart-actions {
    width: 100%;
  }

  .spending-pace__day-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .spending-pace__kpis {
    grid-template-columns: 1fr;
  }

  .spending-pace__notice :deep(.ak-card__body) {
    align-items: flex-start;
  }
}
</style>
