<script setup lang="ts">
import { BarChart3 } from '@lucide/vue'
import type {
  EvolutionChartMode,
  EvolutionMonth,
  EvolutionReport,
} from '~/types/evolution'

const mode = ref<EvolutionChartMode>('flow')
const evolutionCriticalColor = AKOMA_PALETTE_FAMILIES.clay[2]
const modeOptions = [
  { value: 'flow' as const, label: 'Fluxo' },
  { value: 'patrimony' as const, label: 'Patrimônio' },
]

const {
  data: report,
  pending,
  error,
} = await useFetch<EvolutionReport>('/api/reports/evolution', {
  default: () => null,
})

const rows = computed(() => [...(report.value?.months ?? [])].reverse())
const maxIncome = computed(() =>
  Math.max(...(report.value?.months ?? []).map((item) => item.income), 1),
)
const maxExpenses = computed(() =>
  Math.max(...(report.value?.months ?? []).map((item) => item.expenses), 1),
)

const kpis = computed(() => {
  if (!report.value) return []
  return [
    {
      key: 'income',
      label: 'Média de receitas',
      value: report.value.summary.averageIncome,
      suffix: 'por mês com receita',
      tone: 'positive' as const,
      percent: false,
    },
    {
      key: 'expenses',
      label: 'Média de despesas',
      value: report.value.summary.averageExpenses,
      suffix: 'por mês com receita',
      tone: 'negative' as const,
      percent: false,
    },
    {
      key: 'balance',
      label: 'Saldo médio',
      value: report.value.summary.averageBalance,
      suffix: 'por mês com receita',
      tone:
        report.value.summary.averageBalance >= 0
          ? ('positive' as const)
          : ('negative' as const),
      percent: false,
    },
    {
      key: 'savings',
      label: 'Taxa de poupança',
      value: report.value.summary.averageSavingsRate,
      suffix: `média de ${report.value.summary.activeMonths} meses com receita`,
      tone:
        report.value.summary.averageSavingsRate >= 0
          ? ('positive' as const)
          : ('negative' as const),
      percent: true,
    },
  ]
})

const chartTitle = computed(() =>
  mode.value === 'flow'
    ? 'Evolução dos últimos 12 meses'
    : 'Patrimônio acumulado',
)
const chartDescription = computed(() =>
  mode.value === 'flow'
    ? 'Receitas, despesas e saldo mês a mês'
    : 'Saldo consolidado ao final de cada mês',
)

function barWidth(value: number, max: number) {
  if (value <= 0) return '0%'
  return `${Math.max(2, (value / max) * 100)}%`
}

function formatPercent(value: number | null) {
  if (value === null) return '—'
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function savingsTone(row: EvolutionMonth) {
  if (row.savingsRate === null) return 'neutral'
  return row.savingsRate >= 0 ? 'positive' : 'negative'
}
</script>

<template>
  <div class="evolution-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Relatórios"
      description="Análise detalhada das suas finanças"
    />

    <ReportsReportTabs />

    <div v-if="error" class="evolution-page__error">
      <UiEmptyState
        title="Não foi possível carregar a evolução"
        description="Tente novamente em instantes."
      />
    </div>

    <template v-else>
      <section class="evolution-kpis" aria-label="Resumo da evolução">
        <UiCard v-if="pending && !report" v-for="index in 4" :key="index">
          <UiSkeleton width="7rem" height="0.75rem" />
          <UiSkeleton width="9rem" height="1.5rem" class="evolution-page__gap" />
          <UiSkeleton width="6rem" height="0.7rem" class="evolution-page__gap" />
        </UiCard>

        <UiCard
          v-for="kpi in kpis"
          v-else
          :key="kpi.key"
          class="evolution-kpi"
        >
          <p>{{ kpi.label }}</p>
          <strong :class="`evolution-kpi__value--${kpi.tone}`">
            <template v-if="kpi.percent">{{ formatPercent(kpi.value) }}</template>
            <UiMoney v-else :value="kpi.value" />
          </strong>
          <span>{{ kpi.suffix }}</span>
        </UiCard>
      </section>

      <UiCard class="evolution-chart-card" padding="none">
        <header class="evolution-chart-card__header">
          <div class="evolution-chart-card__title">
            <span aria-hidden="true"><BarChart3 /></span>
            <div>
              <h2>{{ chartTitle }}</h2>
              <p>{{ chartDescription }}</p>
            </div>
          </div>

          <div class="evolution-chart-card__toolbar">
            <UiSegmentedControl
              v-model="mode"
              :options="modeOptions"
              aria-label="Visualização da evolução"
            />
            <div
              class="evolution-legend"
              data-accent="sea"
              :style="{ '--evolution-critical': evolutionCriticalColor }"
              aria-label="Legenda do gráfico"
            >
              <template v-if="mode === 'flow'">
                <span><i class="is-income" />Receitas</span>
                <span><i class="is-expense" />Despesas</span>
                <span><i class="is-balance" />Saldo</span>
              </template>
              <span v-else><i class="is-patrimony" />Patrimônio total</span>
            </div>
          </div>
        </header>

        <div class="evolution-chart-card__body">
          <UiSkeleton v-if="pending && !report" height="22rem" radius="md" />
          <ReportsEvolutionChart
            v-else-if="report"
            :months="report.months"
            :mode="mode"
          />
        </div>
      </UiCard>

      <UiCard class="evolution-details" padding="none">
        <header class="evolution-details__header">
          <div>
            <h2>Detalhes por mês</h2>
            <p>Comparação entre entradas, saídas, resultado e patrimônio.</p>
          </div>
        </header>

        <div class="evolution-details__scroll">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th aria-label="Comparativo visual" />
                <th>Receitas</th>
                <th>Despesas</th>
                <th>Saldo</th>
                <th>Patrimônio</th>
                <th>Poupança</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.month">
                <td class="evolution-details__month" data-label="Mês">
                  <strong>{{ row.label }}</strong>
                  <span v-if="row.isCurrent">Atual</span>
                </td>
                <td class="evolution-details__bars" data-label="Comparativo">
                  <div>
                    <span
                      class="is-income"
                      :style="{ width: barWidth(row.income, maxIncome) }"
                    />
                  </div>
                  <div>
                    <span
                      class="is-expense"
                      :style="{ width: barWidth(row.expenses, maxExpenses) }"
                    />
                  </div>
                </td>
                <td class="is-positive" data-label="Receitas">
                  <UiMoney :value="row.income" />
                </td>
                <td class="is-negative" data-label="Despesas">
                  <UiMoney :value="row.expenses" />
                </td>
                <td
                  :class="row.balance >= 0 ? 'is-positive' : 'is-negative'"
                  data-label="Saldo"
                >
                  <UiMoney :value="row.balance" />
                </td>
                <td data-label="Patrimônio">
                  <UiMoney :value="row.patrimony" />
                </td>
                <td
                  :class="`is-${savingsTone(row)}`"
                  data-label="Poupança"
                >
                  {{ formatPercent(row.savingsRate) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.evolution-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.evolution-page__gap {
  margin-top: var(--space-3);
}

.evolution-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.evolution-kpi p,
.evolution-kpi span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.evolution-kpi strong {
  display: block;
  margin: var(--space-2) 0;
  color: var(--color-ink);
  font-size: clamp(1.125rem, 1.6vw, var(--text-lg));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.evolution-kpi .evolution-kpi__value--positive,
.is-positive {
  color: var(--color-positive-ink);
}

.evolution-kpi .evolution-kpi__value--negative,
.is-negative {
  color: var(--color-negative-ink);
}

.is-neutral {
  color: var(--color-ink-muted);
}

.evolution-chart-card__header,
.evolution-chart-card__title,
.evolution-chart-card__toolbar,
.evolution-legend,
.evolution-legend span {
  display: flex;
  align-items: center;
}

.evolution-chart-card__header {
  min-height: 4.75rem;
  padding: var(--space-4) var(--space-5);
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.evolution-chart-card__title {
  gap: var(--space-3);
}

.evolution-chart-card__title > span {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.evolution-chart-card__title svg {
  width: 1rem;
  height: 1rem;
}

.evolution-chart-card__title h2,
.evolution-details__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.evolution-chart-card__title p,
.evolution-details__header p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.evolution-chart-card__toolbar {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-4);
}

.evolution-legend {
  flex-wrap: wrap;
  gap: var(--space-3);
}

.evolution-legend span {
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.evolution-legend i {
  display: block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 0.2rem;
}

.evolution-legend i.is-income {
  background: color-mix(in srgb, var(--accent) 68%, transparent);
}

.evolution-legend i.is-expense {
  background: color-mix(in srgb, var(--evolution-critical) 68%, transparent);
}

.evolution-legend i.is-balance {
  width: 0.9rem;
  height: 2px;
  border-radius: var(--radius-round);
  background: var(--accent);
}

.evolution-legend i.is-patrimony {
  width: 0.9rem;
  height: 2px;
  border-radius: var(--radius-round);
  background: var(--accent);
}

.evolution-chart-card__body {
  padding: var(--space-5);
}

.evolution-details__header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.evolution-details__scroll {
  overflow-x: auto;
}

.evolution-details table {
  width: 100%;
  min-width: 56rem;
  border-collapse: collapse;
}

.evolution-details th {
  padding: var(--space-3);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-align: right;
}

.evolution-details th:first-child,
.evolution-details th:nth-child(2) {
  text-align: left;
}

.evolution-details td {
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.evolution-details__month {
  text-align: left !important;
}

.evolution-details__month strong {
  display: block;
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
  text-transform: capitalize;
}

.evolution-details__month span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.evolution-details__bars {
  width: 9rem;
}

.evolution-details__bars div {
  width: 100%;
  height: 0.25rem;
  overflow: hidden;
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.evolution-details__bars div + div {
  margin-top: var(--space-2);
}

.evolution-details__bars span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.evolution-details__bars .is-income {
  background: var(--color-positive-ink);
}

.evolution-details__bars .is-expense {
  background: var(--color-negative-ink);
}

@media (max-width: 920px) {
  .evolution-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .evolution-chart-card__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .evolution-chart-card__toolbar {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 640px) {
  .evolution-kpis {
    grid-template-columns: 1fr;
  }

  .evolution-chart-card__header,
  .evolution-chart-card__body,
  .evolution-details__header {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }

  .evolution-chart-card__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .evolution-details__scroll {
    overflow: visible;
  }

  .evolution-details table,
  .evolution-details tbody,
  .evolution-details tr,
  .evolution-details td {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .evolution-details thead {
    display: none;
  }

  .evolution-details tr {
    display: grid;
    padding: var(--space-4);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .evolution-details td {
    padding: 0;
    border: 0;
    text-align: left;
    white-space: normal;
  }

  .evolution-details td::before {
    display: block;
    margin-bottom: var(--space-1);
    color: var(--color-ink-muted);
    content: attr(data-label);
    font-size: var(--text-xs);
  }

  .evolution-details__month,
  .evolution-details__bars {
    grid-column: 1 / -1;
  }

  .evolution-details__bars {
    width: 100%;
  }
}
</style>
