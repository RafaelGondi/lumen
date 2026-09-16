<script setup lang="ts">
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Chart as VueChart } from 'vue-chartjs'
import type { DebtEvolutionPoint, DebtMonthlyImpact } from '~/types/debtEvolution'

ChartJS.register(
  CategoryScale,
  BarController,
  BarElement,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const props = defineProps<{
  points: DebtEvolutionPoint[]
  monthlyImpacts: DebtMonthlyImpact[]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const showMonthlyImpact = ref(false)
const tokens = ref({
  actual: '#315b78',
  projected: '#8b6d47',
  actualSoft: 'rgba(49, 91, 120, 0.14)',
  ink: '#213129',
  muted: '#67736b',
  border: 'rgba(33, 49, 41, 0.11)',
  surface: '#ffffff',
})

onMounted(() => {
  if (!wrapRef.value) return
  const styles = getComputedStyle(wrapRef.value)
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback
  tokens.value = {
    actual: read('--debt-actual', tokens.value.actual),
    projected: read('--debt-projected', tokens.value.projected),
    actualSoft: read('--debt-actual-soft', tokens.value.actualSoft),
    ink: read('--color-ink', tokens.value.ink),
    muted: read('--color-ink-muted', tokens.value.muted),
    border: read('--color-border', tokens.value.border),
    surface: read('--color-surface', tokens.value.surface),
  }
})

const currentMonth = computed(() =>
  props.points.find((point) => point.label === 'Hoje')?.month ?? null,
)
const todayBalance = computed(() =>
  props.points.find((point) => point.label === 'Hoje')?.balance ?? null,
)
const impactByMonth = computed(() => new Map(
  props.monthlyImpacts.map((impact) => [impact.month, impact]),
))
const timeline = computed(() => [
  ...props.points
    .filter((point) => point.kind === 'actual')
    .sort((a, b) => a.month.localeCompare(b.month)),
  ...props.points
    .filter((point) => point.kind === 'projected')
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((point) => ({
      ...point,
      label: point.month === currentMonth.value
        ? `Fim de ${point.label}`
        : point.label,
    })),
])

const chartData = computed<ChartData<'line' | 'bar'>>(() => ({
  labels: timeline.value.map((item) => item.label),
  datasets: [
    ...(showMonthlyImpact.value ? [{
      type: 'bar' as const,
      label: 'Impacto mensal',
      data: timeline.value.map((item) =>
        item.kind === 'projected'
          ? impactByMonth.value.get(item.month)?.total ?? 0
          : null,
      ),
      backgroundColor: 'rgba(161, 119, 64, 0.18)',
      borderColor: tokens.value.projected,
      borderWidth: 1,
      borderRadius: 4,
      maxBarThickness: 34,
      yAxisID: 'impact',
      order: 3,
    }] : []),
    {
      type: 'line' as const,
      label: 'Saldo registrado',
      data: timeline.value.map((item) => item.kind === 'actual' ? item.balance : null),
      borderColor: tokens.value.actual,
      backgroundColor: tokens.value.actualSoft,
      borderWidth: 2.25,
      fill: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: tokens.value.actual,
      pointBorderColor: tokens.value.surface,
      pointBorderWidth: 1.5,
      spanGaps: true,
      cubicInterpolationMode: 'monotone',
      yAxisID: 'balance',
      order: 1,
    },
    {
      type: 'line' as const,
      label: 'Projeção',
      data: timeline.value.map((item) => {
        if (item.kind === 'projected') return item.balance
        if (item.label === 'Hoje') return item.balance
        return null
      }),
      borderColor: tokens.value.projected,
      backgroundColor: 'transparent',
      borderWidth: 2.25,
      borderDash: [7, 5],
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: tokens.value.projected,
      pointBorderColor: tokens.value.surface,
      pointBorderWidth: 1.5,
      spanGaps: true,
      cubicInterpolationMode: 'monotone',
      yAxisID: 'balance',
      order: 1,
    },
  ],
}))

const options = computed<ChartOptions<'line' | 'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: tokens.value.ink,
      titleColor: tokens.value.surface,
      bodyColor: tokens.value.surface,
      padding: 12,
      filter: (item) => {
        if (item.raw === null) return false
        const point = timeline.value[item.dataIndex]
        return !(item.dataset.label === 'Projeção' && point?.kind === 'actual')
      },
      callbacks: {
        label: (context) => {
          const point = timeline.value[context.dataIndex]
          if (context.dataset.label === 'Impacto mensal') {
            return `Impacto no mês: ${formatMoney(Number(context.raw))}`
          }
          if (point?.kind === 'actual') {
            return `${point.label === 'Hoje' ? 'Saldo hoje' : 'Saldo registrado'}: ${formatMoney(Number(context.raw))}`
          }
          return `Saldo projetado: ${formatMoney(Number(context.raw))}`
        },
        afterBody: (items) => {
          const point = timeline.value[items[0]?.dataIndex ?? -1]
          if (!point) return []
          const lines: string[] = []
          if (items.some((item) => item.dataset.label === 'Impacto mensal')) {
            const impact = impactByMonth.value.get(point.month)
            if (impact?.items.length) {
              lines.push('', 'Composição do mês:')
              lines.push(...impact.items.map((item) =>
                `• ${item.name}: ${formatMoney(item.amount)}`,
              ))
            }
          }
          if (
            point.kind === 'projected' &&
            point.month === currentMonth.value &&
            todayBalance.value !== null
          ) {
            const reduction = Math.max(0, todayBalance.value - point.balance)
            lines.push(`Redução prevista: ${formatMoney(reduction)}`)
          }
          return lines
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: tokens.value.border },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxRotation: 0,
        autoSkip: false,
        callback: (_value, index) => {
          const label = timeline.value[index]?.label ?? ''
          if (label === 'Hoje' || label.startsWith('Fim de ')) return label
          return index % 2 === 0 ? label : ''
        },
      },
    },
    balance: {
      beginAtZero: true,
      grid: { color: tokens.value.border },
      border: { display: false },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxTicksLimit: 6,
        callback: (value) => formatAxis(Number(value)),
      },
    },
    impact: {
      display: showMonthlyImpact.value,
      position: 'right',
      beginAtZero: true,
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: tokens.value.projected,
        font: { size: 11 },
        maxTicksLimit: 5,
        callback: (value) => formatAxis(Number(value)),
      },
    },
  },
}))

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
</script>

<template>
  <div ref="wrapRef" class="debt-chart">
    <div class="debt-chart__toolbar">
      <label>
        <input v-model="showMonthlyImpact" type="checkbox" />
        <span>
          <strong>Mostrar impacto mensal</strong>
          <small>Parcelas e faturas que incidem em cada mês.</small>
        </span>
      </label>
    </div>
    <div class="debt-chart__plot">
      <ClientOnly>
        <VueChart type="line" :data="chartData" :options="options" />
        <template #fallback>
          <UiSkeleton height="100%" radius="md" />
        </template>
      </ClientOnly>
    </div>
    <ul class="debt-chart__legend" aria-label="Legenda do gráfico">
      <li><i class="is-actual" />Saldo registrado (histórico e hoje)</li>
      <li><i class="is-projected" />Projeção pelos compromissos conhecidos</li>
      <li v-if="showMonthlyImpact"><i class="is-impact" />Impacto mensal</li>
    </ul>
  </div>
</template>

<style scoped>
.debt-chart {
  --debt-actual: #315b78;
  --debt-projected: #a17740;
  --debt-actual-soft: rgb(49 91 120 / 12%);
}

.debt-chart__plot {
  height: 20rem;
}

.debt-chart__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.debt-chart__toolbar label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.debt-chart__toolbar input {
  accent-color: var(--debt-projected);
}

.debt-chart__toolbar span {
  display: flex;
  flex-direction: column;
}

.debt-chart__toolbar strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.debt-chart__toolbar small {
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
}

.debt-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: 0;
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  list-style: none;
}

.debt-chart__legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.debt-chart__legend i {
  display: block;
  width: 0.9rem;
  border-top: 2px solid var(--debt-actual);
}

.debt-chart__legend i.is-projected {
  border-top-color: var(--debt-projected);
  border-top-style: dashed;
}

.debt-chart__legend i.is-impact {
  width: 0.75rem;
  height: 0.65rem;
  border: 1px solid var(--debt-projected);
  border-radius: 2px;
  background: rgb(161 119 64 / 18%);
}

@media (max-width: 640px) {
  .debt-chart__plot { height: 16rem; }
}
</style>
