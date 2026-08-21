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
import { Chart } from 'vue-chartjs'
import type { EvolutionChartMode, EvolutionMonth } from '~/types/evolution'

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const props = defineProps<{
  months: EvolutionMonth[]
  mode: EvolutionChartMode
}>()

const CRITICAL_COLOR = AKOMA_PALETTE_FAMILIES.clay[2]

const wrapRef = ref<HTMLElement | null>(null)
const tokens = ref({
  line: '#5184b1',
  lineSoft: 'rgba(81, 132, 177, 0.18)',
  critical: CRITICAL_COLOR,
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
    line: read('--accent', tokens.value.line),
    lineSoft: read('--accent-soft', tokens.value.lineSoft),
    critical: CRITICAL_COLOR,
    ink: read('--color-ink', tokens.value.ink),
    muted: read('--color-ink-muted', tokens.value.muted),
    border: read('--color-border', tokens.value.border),
    surface: read('--color-surface', tokens.value.surface),
  }
})

const chartData = computed<ChartData<'bar' | 'line', number[], string>>(() => {
  if (props.mode === 'patrimony') {
    return {
      labels: props.months.map((item) => item.label),
      datasets: [
        {
          type: 'line',
          label: 'Patrimônio total',
          data: props.months.map((item) => item.patrimony),
          borderColor: tokens.value.line,
          backgroundColor: tokens.value.lineSoft,
          borderWidth: 2.25,
          fill: true,
          pointRadius: 3.5,
          pointHoverRadius: 6,
          pointBackgroundColor: tokens.value.line,
          pointBorderColor: tokens.value.surface,
          pointBorderWidth: 1.5,
          cubicInterpolationMode: 'monotone',
          tension: 0.25,
        },
      ],
    }
  }

  return {
    labels: props.months.map((item) => item.label),
    datasets: [
      {
        type: 'bar',
        label: 'Receitas',
        data: props.months.map((item) => item.income),
        backgroundColor: `color-mix(in srgb, ${tokens.value.line} 68%, transparent)`,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 28,
      },
      {
        type: 'bar',
        label: 'Despesas',
        data: props.months.map((item) => item.expenses),
        backgroundColor: `color-mix(in srgb, ${tokens.value.critical} 68%, transparent)`,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: 28,
      },
      {
        type: 'line',
        label: 'Saldo',
        data: props.months.map((item) => item.balance),
        borderColor: tokens.value.line,
        backgroundColor: tokens.value.line,
        borderWidth: 1.75,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: tokens.value.line,
        pointBorderColor: tokens.value.surface,
        pointBorderWidth: 1.5,
        tension: 0.25,
      },
    ],
  }
})

const options = computed<ChartOptions<'bar' | 'line'>>(() => ({
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
      displayColors: true,
      callbacks: {
        label: (context) =>
          `${context.dataset.label}: ${formatMoney(Number(context.raw))}`,
      },
    },
  },
  scales: {
    x: {
      stacked: false,
      grid: { display: false },
      border: { color: tokens.value.border },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxRotation: 0,
        autoSkipPadding: 16,
      },
    },
    y: {
      grid: { color: tokens.value.border },
      border: { display: false },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxTicksLimit: 7,
        callback: (value) => formatAxis(Number(value)),
      },
    },
  },
}))

function formatAxis(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mil`
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
</script>

<template>
  <div ref="wrapRef" class="evolution-chart" data-accent="sea">
    <ClientOnly>
      <Chart type="bar" :data="chartData" :options="options" />
      <template #fallback>
        <UiSkeleton height="100%" radius="md" />
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.evolution-chart {
  height: 22rem;
}

@media (max-width: 640px) {
  .evolution-chart {
    height: 18rem;
  }
}
</style>
