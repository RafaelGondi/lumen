<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { AssetProjectionPoint } from '~/types/asset'

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

const props = defineProps<{ points: AssetProjectionPoint[] }>()
const root = ref<HTMLElement | null>(null)
const colors = ref({ line: '#2f7d5c', fill: 'rgba(47, 125, 92, 0.12)', ink: '#213129', muted: '#67736b', border: '#dce2de', surface: '#fff' })

onMounted(() => {
  if (!root.value) return
  const style = getComputedStyle(root.value)
  const read = (token: string, fallback: string) => style.getPropertyValue(token).trim() || fallback
  colors.value = {
    line: read('--color-positive-ink', colors.value.line),
    fill: `color-mix(in srgb, ${read('--color-positive', colors.value.line)} 14%, transparent)`,
    ink: read('--color-ink', colors.value.ink),
    muted: read('--color-ink-muted', colors.value.muted),
    border: read('--color-border', colors.value.border),
    surface: read('--color-surface', colors.value.surface),
  }
})

const data = computed<ChartData<'line'>>(() => ({
  labels: props.points.map((point) => point.label),
  datasets: [{
    label: 'Patrimônio estimado',
    data: props.points.map((point) => point.balance),
    borderColor: colors.value.line,
    backgroundColor: colors.value.fill,
    fill: true,
    borderWidth: 2.25,
    pointRadius: props.points.map((_, index) => index === 0 || index === props.points.length - 1 ? 4 : 2),
    pointHoverRadius: 6,
    pointBackgroundColor: colors.value.line,
    pointBorderColor: colors.value.surface,
    pointBorderWidth: 1.5,
    cubicInterpolationMode: 'monotone',
  }],
}))

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: colors.value.ink,
      titleColor: colors.value.surface,
      bodyColor: colors.value.surface,
      padding: 12,
      callbacks: {
        label: (context) => `Saldo estimado: ${formatMoney(Number(context.raw))}`,
        afterBody: (items) => {
          const point = props.points[items[0]?.dataIndex ?? -1]
          if (!point || point.label === 'Hoje') return []
          return [
            `Aportes acumulados: ${formatMoney(point.contributed)}`,
            `Rendimento estimado: ${formatMoney(point.earnings)}`,
          ]
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: colors.value.border },
      ticks: { color: colors.value.muted, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
    },
    y: {
      beginAtZero: false,
      grid: { color: colors.value.border },
      border: { display: false },
      ticks: { color: colors.value.muted, font: { size: 11 }, maxTicksLimit: 6, callback: (value) => formatAxis(Number(value)) },
    },
  },
}))

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatAxis(value: number) {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
</script>

<template>
  <div ref="root" class="asset-chart">
    <ClientOnly>
      <Line :data="data" :options="options" />
      <template #fallback><UiSkeleton height="100%" radius="md" /></template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.asset-chart { height: 20rem; }
@media (max-width: 640px) { .asset-chart { height: 16rem; } }
</style>
