<script setup lang="ts">
import {
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Info,
  Landmark,
  PieChart,
} from '@lucide/vue'
import type { CardInvoiceCategorySpend } from '~/types/cardInvoice'
import type { CategorySpendRow } from '~/types/categorySpendReport'
import type {
  MonthlyResultReport,
  MonthlyResultScope,
} from '~/types/monthlyResult'

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
const scope = ref<MonthlyResultScope>('category')
const drawerOpen = ref(false)
const selectedRow = ref<CategorySpendRow | null>(null)

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
  { value: 'recurrence' as const, label: 'Tipo' },
]

const {
  data: report,
  pending,
  error,
} = await useFetch<MonthlyResultReport>(
  () =>
    `/api/reports/monthly-result?month=${monthKey.value}&scope=${scope.value}`,
  {
    watch: [monthKey, scope],
    default: () => null,
  },
)

const resultTone = computed(() =>
  (report.value?.result ?? 0) >= 0 ? 'positive' : 'negative',
)
const marginLabel = computed(() => {
  if (report.value?.margin === null || report.value?.margin === undefined) {
    return '—'
  }
  return `${report.value.margin.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
})
const statementMax = computed(() =>
  Math.max(
    report.value?.incomeTotal ?? 0,
    report.value?.expenseTotal ?? 0,
    Math.abs(report.value?.result ?? 0),
    1,
  ),
)
const accountShare = computed(() => {
  if (!report.value?.expenseTotal) return 0
  return Math.round(
    (report.value.expenses.sourceTotals.account / report.value.expenseTotal) *
      100,
  )
})
const cardShare = computed(() =>
  report.value?.expenseTotal ? 100 - accountShare.value : 0,
)
const donutItems = computed<CardInvoiceCategorySpend[]>(() =>
  (report.value?.expenses.rows ?? []).map((row) => ({
    id: String(row.referenceId),
    name: row.label,
    color: row.color,
    amount: row.amount,
    percent: row.percent,
  })),
)
const donutOthersLabel = computed(() => {
  if (scope.value === 'supercategory') return 'supercategorias'
  if (scope.value === 'recurrence') return 'tipos'
  return 'categorias'
})
const topExpense = computed(() => report.value?.expenses.rows[0] ?? null)

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

function statementWidth(value: number) {
  if (value === 0) return '0%'
  return `${Math.max(3, (Math.abs(value) / statementMax.value) * 100)}%`
}

function variationTone(value: number, expense = false) {
  if (value === 0) return 'neutral'
  const favorable = expense ? value < 0 : value > 0
  return favorable ? 'positive' : 'negative'
}

function variationLabel(value: number) {
  if (value === 0) return 'igual ao mês anterior'
  return value > 0 ? 'acima do mês anterior' : 'abaixo do mês anterior'
}

function openRow(row: CategorySpendRow) {
  selectedRow.value = row
  drawerOpen.value = true
}
</script>

<template>
  <div class="monthly-result">
    <PageHeading
      eyebrow=""
      title="Resultado mensal"
      description="Receitas e despesas reconhecidas no mês em que foram geradas."
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

    <UiCard class="monthly-result__notice" padding="md">
      <div class="monthly-result__notice-content">
        <Info aria-hidden="true" />
        <p>
          <strong>Competência gerencial.</strong> Compras no cartão entram pela
          data da compra; o pagamento da fatura não é contado novamente. Parcelas
          são reconhecidas no mês em que cada parcela foi programada.
        </p>
      </div>
    </UiCard>

    <UiEmptyState
      v-if="error"
      title="Não foi possível montar o resultado mensal"
      description="Tente novamente em instantes."
    />

    <template v-else>
      <section class="monthly-result__kpis" aria-label="Resumo do resultado">
        <template v-if="pending && !report">
          <UiCard v-for="index in 4" :key="index">
            <UiSkeleton width="6rem" height="0.8rem" />
            <UiSkeleton width="8rem" height="1.6rem" class="monthly-result__gap" />
            <UiSkeleton width="7rem" height="0.7rem" class="monthly-result__gap" />
          </UiCard>
        </template>

        <template v-else-if="report">
          <UiCard class="monthly-result__kpi">
            <span class="monthly-result__kpi-label">Receitas</span>
            <strong class="monthly-result__kpi-value is-positive"><UiMoney :value="report.incomeTotal" /></strong>
            <small class="monthly-result__kpi-support" :class="`is-${variationTone(report.comparison.incomeChange)}`">
              <UiMoney :value="Math.abs(report.comparison.incomeChange)" />
              {{ variationLabel(report.comparison.incomeChange) }}
            </small>
          </UiCard>

          <UiCard class="monthly-result__kpi">
            <span class="monthly-result__kpi-label">Despesas incorridas</span>
            <strong class="monthly-result__kpi-value is-negative"><UiMoney :value="report.expenseTotal" /></strong>
            <small class="monthly-result__kpi-support" :class="`is-${variationTone(report.comparison.expenseChange, true)}`">
              <UiMoney :value="Math.abs(report.comparison.expenseChange)" />
              {{ variationLabel(report.comparison.expenseChange) }}
            </small>
          </UiCard>

          <UiCard class="monthly-result__kpi">
            <span class="monthly-result__kpi-label">{{ report.result >= 0 ? 'Superávit' : 'Déficit' }}</span>
            <strong class="monthly-result__kpi-value" :class="`is-${resultTone}`"><UiMoney :value="report.result" /></strong>
            <small class="monthly-result__kpi-support" :class="`is-${variationTone(report.comparison.resultChange)}`">
              <UiMoney :value="Math.abs(report.comparison.resultChange)" />
              {{ variationLabel(report.comparison.resultChange) }}
            </small>
          </UiCard>

          <UiCard class="monthly-result__kpi">
            <span class="monthly-result__kpi-label">Margem do mês</span>
            <strong class="monthly-result__kpi-value" :class="`is-${resultTone}`">{{ marginLabel }}</strong>
            <small class="monthly-result__kpi-support">resultado sobre as receitas</small>
          </UiCard>
        </template>
      </section>

      <div class="monthly-result__primary-grid">
        <UiCard class="monthly-result__statement" padding="none">
          <header class="monthly-result__card-header">
            <span class="monthly-result__header-icon" aria-hidden="true">
              <BarChart3 />
            </span>
            <div>
              <h2>Demonstração do resultado</h2>
              <p>{{ report?.fullLabel ?? monthLabel }}</p>
            </div>
          </header>

          <div v-if="pending && !report" class="monthly-result__card-body">
            <UiSkeleton height="13rem" radius="md" />
          </div>

          <div v-else-if="report" class="monthly-result__statement-body">
            <div class="monthly-result__statement-row is-income">
              <div>
                <span>(+) Receitas do período</span>
                <strong><UiMoney :value="report.incomeTotal" /></strong>
              </div>
              <i><span :style="{ width: statementWidth(report.incomeTotal) }" /></i>
            </div>
            <div class="monthly-result__statement-row is-expense">
              <div>
                <span>(−) Despesas incorridas</span>
                <strong><UiMoney :value="report.expenseTotal" /></strong>
              </div>
              <i><span :style="{ width: statementWidth(report.expenseTotal) }" /></i>
            </div>
            <div class="monthly-result__statement-total" :class="`is-${resultTone}`">
              <div>
                <span>(=) Resultado do mês</span>
                <small>
                  {{ report.result >= 0 ? 'A renda cobriu o consumo do período' : 'O consumo superou a renda do período' }}
                </small>
              </div>
              <strong><UiMoney :value="report.result" /></strong>
            </div>
          </div>
        </UiCard>

        <UiCard class="monthly-result__income" padding="none">
          <header class="monthly-result__card-header">
            <span class="monthly-result__header-icon" aria-hidden="true">
              <CircleDollarSign />
            </span>
            <div>
              <h2>Origem das receitas</h2>
              <p>Reconhecidas no período</p>
            </div>
          </header>

          <div v-if="pending && !report" class="monthly-result__card-body">
            <UiSkeleton height="13rem" radius="md" />
          </div>
          <UiEmptyState
            v-else-if="!report?.incomeRows.length"
            title="Nenhuma receita"
            description="Não há receitas reconhecidas neste período."
          />
          <ul v-else class="monthly-result__income-list">
            <li v-for="row in report.incomeRows" :key="row.key">
              <CategoriesCategoryIconChip :icon="row.icon" :color="row.color" size="sm" />
              <div>
                <strong>{{ row.label }}</strong>
                <span>{{ row.itemCount }} lanç. · {{ row.percent }}%</span>
              </div>
              <strong><UiMoney :value="row.amount" /></strong>
            </li>
          </ul>
        </UiCard>
      </div>

      <section class="monthly-result__structure" aria-label="Estrutura das despesas">
        <UiCard
          v-for="row in report?.recurrence.rows ?? []"
          :key="String(row.referenceId)"
          class="monthly-result__structure-card"
        >
          <div class="monthly-result__structure-heading">
            <CategoriesCategoryIconChip :icon="row.icon" :color="row.color" size="sm" />
            <span class="monthly-result__structure-copy">
              <strong>{{ row.label }}</strong>
              <small>{{ row.itemCount }} lançamentos</small>
            </span>
          </div>
          <strong class="monthly-result__structure-value"><UiMoney :value="row.amount" /></strong>
          <i class="monthly-result__structure-track"><span :style="{ width: `${row.percent}%`, background: row.color }" /></i>
          <small class="monthly-result__structure-support">{{ row.percent }}% das despesas</small>
        </UiCard>
      </section>

      <UiCard class="monthly-result__composition" padding="none">
        <header class="monthly-result__composition-header">
          <div class="monthly-result__card-header">
            <span class="monthly-result__header-icon" aria-hidden="true"><PieChart /></span>
            <div>
              <h2>Composição das despesas</h2>
              <p>
                {{ topExpense ? `${topExpense.label} é o maior grupo, com ${topExpense.percent}%` : 'Sem despesas no período' }}
              </p>
            </div>
          </div>
          <UiSegmentedControl v-model="scope" :options="scopeOptions" />
        </header>

        <div v-if="pending && !report" class="monthly-result__card-body">
          <UiSkeleton height="12rem" radius="md" />
        </div>
        <UiEmptyState
          v-else-if="!report?.expenses.rows.length"
          title="Nenhuma despesa neste mês"
          description="Não há despesas reconhecidas neste período."
        />
        <div v-else class="monthly-result__donut">
          <CardsInvoiceSpendDonut :items="donutItems" :others-label="donutOthersLabel" />
        </div>
      </UiCard>

      <UiCard class="monthly-result__details" padding="none">
        <header class="monthly-result__details-header">
          <div>
            <h2>Detalhamento das despesas</h2>
            <p>
              {{ cardShare }}% no cartão · {{ accountShare }}% diretamente nas contas
            </p>
          </div>
          <div class="monthly-result__source-legend" aria-label="Origem das despesas">
            <span><Landmark aria-hidden="true" />Conta</span>
            <span><CreditCard aria-hidden="true" />Cartão</span>
          </div>
        </header>

        <ul v-if="report?.expenses.rows.length" class="monthly-result__rows">
          <li v-for="row in report.expenses.rows" :key="`${report.scope}-${row.referenceId}`">
            <button type="button" @click="openRow(row)">
              <CategoriesCategoryIconChip :icon="row.icon" :color="row.color" size="sm" />
              <div class="monthly-result__row-copy">
                <strong>{{ row.label }}</strong>
                <span>{{ row.itemCount }} lanç. · {{ row.percent }}%</span>
              </div>
              <div class="monthly-result__row-sources">
                <span><Landmark aria-hidden="true" /><UiMoney :value="row.sourceTotals.account" /></span>
                <span><CreditCard aria-hidden="true" /><UiMoney :value="row.sourceTotals.card" /></span>
              </div>
              <strong><UiMoney :value="row.amount" /></strong>
              <ChevronRight aria-hidden="true" />
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
.monthly-result {
  display: grid;
  gap: var(--space-4);
}

.monthly-result__gap {
  margin-top: var(--space-3);
}

.monthly-result__notice-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.monthly-result__notice-content svg {
  width: 1rem;
  height: 1rem;
  margin-top: 0.1rem;
  flex: 0 0 auto;
  color: var(--color-brand);
}

.monthly-result__notice-content strong {
  color: var(--color-ink);
}

.monthly-result__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.monthly-result__kpi-label,
.monthly-result__kpi-support {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__kpi-value {
  display: block;
  margin: var(--space-2) 0;
  font-size: clamp(1.1rem, 1.8vw, var(--text-xl));
  letter-spacing: -0.025em;
}

.monthly-result__kpi-support {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.is-positive {
  color: var(--color-positive-ink) !important;
}

.is-negative {
  color: var(--color-negative-ink) !important;
}

.is-neutral {
  color: var(--color-ink-muted) !important;
}

.monthly-result__primary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.65fr);
  gap: var(--space-4);
}

.monthly-result__card-header,
.monthly-result__composition-header,
.monthly-result__details-header,
.monthly-result__source-legend,
.monthly-result__source-legend span {
  display: flex;
  align-items: center;
}

.monthly-result__card-header {
  min-height: 4.6rem;
  padding: var(--space-4) var(--space-5);
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.monthly-result__card-header h2,
.monthly-result__details-header h2 {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.monthly-result__card-header p,
.monthly-result__details-header p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__header-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
}

.monthly-result__header-icon svg {
  width: 1rem;
  height: 1rem;
}

.monthly-result__card-body,
.monthly-result__donut {
  padding: var(--space-5);
}

.monthly-result__statement-body {
  padding: var(--space-5);
}

.monthly-result__statement-row {
  padding: var(--space-3) 0;
}

.monthly-result__statement-row > div,
.monthly-result__statement-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.monthly-result__statement-row span,
.monthly-result__statement-total span {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}

.monthly-result__statement-row strong,
.monthly-result__statement-total strong {
  color: var(--color-ink);
  font-size: var(--text-md);
}

.monthly-result__statement-row > i,
.monthly-result__structure-track {
  display: block;
  height: 0.25rem;
  margin-top: var(--space-2);
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-subtle);
}

.monthly-result__statement-row > i span,
.monthly-result__structure-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.monthly-result__statement-row.is-income > i span {
  background: var(--color-positive);
}

.monthly-result__statement-row.is-expense > i span {
  background: var(--color-negative);
}

.monthly-result__statement-total {
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-strong);
}

.monthly-result__statement-total > div {
  display: grid;
  gap: 0.2rem;
}

.monthly-result__statement-total small {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__income-list {
  padding: var(--space-2) var(--space-5) var(--space-4);
  list-style: none;
}

.monthly-result__income-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.monthly-result__income-list li:last-child {
  border-bottom: 0;
}

.monthly-result__income-list li > div {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.monthly-result__income-list strong {
  font-size: var(--text-sm);
}

.monthly-result__income-list li > div > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__structure {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, 18rem), 1fr)
  );
  gap: var(--space-4);
}

.monthly-result__structure-heading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.monthly-result__structure-copy {
  display: grid;
  gap: 0.1rem;
}

.monthly-result__structure-copy strong,
.monthly-result__structure-value {
  font-size: var(--text-sm);
}

.monthly-result__structure-value {
  display: block;
  margin-top: var(--space-4);
}

.monthly-result__structure-copy small,
.monthly-result__structure-support {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__structure-support {
  display: block;
  margin-top: var(--space-2);
}

.monthly-result__composition-header,
.monthly-result__details-header {
  min-height: 4.75rem;
  justify-content: space-between;
  gap: var(--space-4);
  padding-right: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.monthly-result__composition-header .monthly-result__card-header {
  border-bottom: 0;
}

.monthly-result__details-header {
  padding: var(--space-4) var(--space-5);
}

.monthly-result__source-legend {
  gap: var(--space-4);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__source-legend span {
  gap: var(--space-1);
}

.monthly-result__source-legend svg,
.monthly-result__row-sources svg {
  width: 0.9rem;
  height: 0.9rem;
}

.monthly-result__rows {
  list-style: none;
}

.monthly-result__rows li + li {
  border-top: 1px solid var(--color-border);
}

.monthly-result__rows button {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(10rem, 1fr) minmax(15rem, auto) auto auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}

.monthly-result__rows button:hover {
  background: var(--color-surface-subtle);
}

.monthly-result__rows button > svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.monthly-result__row-copy {
  display: grid;
  gap: 0.15rem;
}

.monthly-result__row-copy strong,
.monthly-result__rows button > strong {
  font-size: var(--text-sm);
}

.monthly-result__row-copy span,
.monthly-result__row-sources {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.monthly-result__row-sources {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
}

.monthly-result__row-sources span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

@media (max-width: 960px) {
  .monthly-result__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .monthly-result__primary-grid {
    grid-template-columns: 1fr;
  }

  .monthly-result__rows button {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .monthly-result__row-sources {
    display: none;
  }
}

@media (max-width: 640px) {
  .monthly-result__kpis,
  .monthly-result__structure {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .monthly-result__notice {
    margin-top: calc(var(--space-2) * -1);
  }

  .monthly-result__composition-header,
  .monthly-result__details-header {
    align-items: stretch;
    flex-direction: column;
    padding: var(--space-4);
  }

  .monthly-result__composition-header .monthly-result__card-header {
    min-height: 0;
    padding: 0;
  }

  .monthly-result__source-legend {
    display: none;
  }

  .monthly-result__rows button {
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }

  .monthly-result__rows button > svg {
    display: none;
  }

  .monthly-result__statement-row > div,
  .monthly-result__statement-total {
    align-items: flex-start;
  }
}
</style>
