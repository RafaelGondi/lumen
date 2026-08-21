<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { ProjectionPoint, ProjectionSnapshot } from '~/types/projection'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
  Tooltip,
)

const props = defineProps<{
  points: ProjectionPoint[]
  snapshots: ProjectionSnapshot[]
  currentLabel?: string
}>()

const wrapRef = ref<HTMLElement | null>(null)
const tokens = ref({
  current: '#3c8866',
  ink: '#213129',
  muted: '#67736b',
  border: 'rgba(33,49,41,.11)',
  surface: '#ffffff',
})

const snapshotColors = ['#718cbf', '#b57a42', '#9b6da6']

onMounted(() => {
  if (!wrapRef.value) return
  const styles = getComputedStyle(wrapRef.value)
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback
  tokens.value = {
    current: read('--projection-current', tokens.value.current),
    ink: read('--color-ink', tokens.value.ink),
    muted: read('--color-ink-muted', tokens.value.muted),
    border: read('--color-border', tokens.value.border),
    surface: read('--color-surface', tokens.value.surface),
  }
})

const chartData = computed<ChartData<'line', (number | null)[], string>>(() => {
  const months = props.points.map((point) => point.month)
  const snapshotDatasets = props.snapshots.map((snapshot, index) => {
    const values = new Map(snapshot.points.map((point) => [point.month, point.balance]))
    const color = snapshotColors[index % snapshotColors.length]!
    return {
      label: snapshot.label,
      data: months.map((month) => values.get(month) ?? null),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 1.75,
      borderDash: [5, 4],
      pointRadius: 2.5,
      pointHoverRadius: 5,
      pointBackgroundColor: color,
      pointBorderWidth: 0,
      spanGaps: false,
      tension: 0.25,
    }
  })

  return {
    labels: props.points.map((point) => point.label),
    datasets: [
      {
        label: props.currentLabel ?? 'Projeção atual',
        data: props.points.map((point) => point.balance),
        borderColor: tokens.value.current,
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart
          if (!chartArea) return 'transparent'
          const gradient = ctx.createLinearGradient(
            0,
            chartArea.top,
            0,
            chartArea.bottom,
          )
          gradient.addColorStop(0, 'rgba(60, 136, 102, 0.16)')
          gradient.addColorStop(1, 'rgba(60, 136, 102, 0.01)')
          return gradient
        },
        borderWidth: 2.25,
        fill: true,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: tokens.value.current,
        pointBorderColor: tokens.value.surface,
        pointBorderWidth: 1.5,
        cubicInterpolationMode: 'monotone',
      },
      ...snapshotDatasets,
    ],
  }
})

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      align: 'start',
      labels: {
        color: tokens.value.muted,
        usePointStyle: true,
        pointStyle: 'line',
        boxWidth: 22,
        boxHeight: 6,
        padding: 18,
        font: { size: 11 },
      },
    },
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
      grid: { display: false },
      border: { color: tokens.value.border },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxRotation: 0,
        autoSkipPadding: 20,
      },
    },
    y: {
      grid: { color: tokens.value.border },
      border: { display: false },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxTicksLimit: 6,
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
  <div ref="wrapRef" class="projection-chart" data-accent="sea">
    <div class="projection-chart__plot">
      <ClientOnly>
        <Line :data="chartData" :options="options" />
        <template #fallback>
          <UiSkeleton height="100%" radius="md" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.projection-chart {
  --projection-current: var(--accent);
}

.projection-chart__plot {
  height: 23rem;
}

@media (max-width: 640px) {
  .projection-chart__plot {
    height: 18rem;
  }
}
</style>
