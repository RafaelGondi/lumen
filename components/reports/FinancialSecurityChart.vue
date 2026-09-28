<script setup lang="ts">
import {
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
import { Line } from 'vue-chartjs'
import type { FinancialSecurityPoint } from '~/types/financialSecurity'

ChartJS.register(CategoryScale, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip)

const props = defineProps<{
  points: FinancialSecurityPoint[]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const colors = ref({
  brand: '#315b78',
  brandSoft: 'rgba(49, 91, 120, 0.12)',
  positive: '#2f7d5c',
  warning: '#a17740',
  ink: '#213129',
  muted: '#67736b',
  border: 'rgba(33, 49, 41, 0.11)',
  surface: '#ffffff',
})

onMounted(() => {
  if (!wrapRef.value) return
  const style = getComputedStyle(wrapRef.value)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  colors.value = {
    brand: read('--color-brand', colors.value.brand),
    brandSoft: read('--color-brand-soft', colors.value.brandSoft),
    positive: read('--color-positive', colors.value.positive),
    warning: read('--color-warning', colors.value.warning),
    ink: read('--color-ink', colors.value.ink),
    muted: read('--color-ink-muted', colors.value.muted),
    border: read('--color-border', colors.value.border),
    surface: read('--color-surface', colors.value.surface),
  }
})

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.points.map(point => point.label),
  datasets: [
    {
      label: 'Cobertura realizada',
      data: props.points.map(point => point.kind === 'projected' ? null : point.coverageMonths),
      borderColor: colors.value.brand,
      backgroundColor: colors.value.brandSoft,
      borderWidth: 2.25,
      fill: false,
      pointRadius: props.points.map(point => point.kind === 'current' ? 5 : point.kind === 'historical' ? 2 : 0),
      pointHoverRadius: 6,
      pointBackgroundColor: colors.value.brand,
      pointBorderColor: colors.value.surface,
      pointBorderWidth: 1.5,
      cubicInterpolationMode: 'monotone',
    },
    {
      label: 'Cobertura projetada',
      data: props.points.map(point => point.kind === 'historical' ? null : point.coverageMonths),
      borderColor: colors.value.positive,
      backgroundColor: colors.value.brandSoft,
      borderWidth: 2.25,
      borderDash: [6, 4],
      fill: true,
      pointRadius: props.points.map(point => point.kind === 'current' ? 5 : point.kind === 'projected' ? 2 : 0),
      pointHoverRadius: 6,
      pointBackgroundColor: colors.value.positive,
      pointBorderColor: colors.value.surface,
      pointBorderWidth: 1.5,
      cubicInterpolationMode: 'monotone',
    },
    {
      label: 'Meta de 6 meses',
      data: props.points.map(() => 6),
      borderColor: colors.value.warning,
      borderWidth: 1.25,
      borderDash: [5, 5],
      fill: false,
      pointRadius: 0,
    },
    {
      label: 'Meta de 12 meses',
      data: props.points.map(() => 12),
      borderColor: colors.value.muted,
      borderWidth: 1.25,
      borderDash: [7, 5],
      fill: false,
      pointRadius: 0,
    },
  ],
}))

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      position: 'bottom',
      align: 'start',
      labels: { color: colors.value.muted, boxWidth: 10, boxHeight: 10, padding: 18, font: { size: 11 } },
    },
    tooltip: {
      backgroundColor: colors.value.ink,
      titleColor: colors.value.surface,
      bodyColor: colors.value.surface,
      padding: 12,
      filter: context => !context.dataset.label?.startsWith('Meta de '),
      callbacks: {
        label: context => `${context.dataset.label}: ${formatCoverage(Number(context.raw))}`,
        afterBody: items => {
          const point = props.points[items[0]?.dataIndex ?? -1]
          return point
            ? ['', `Patrimônio: ${formatMoney(point.balance)}`, `Custo mensal: ${formatMoney(point.monthlyCost)}`]
            : []
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: colors.value.border },
      ticks: {
        color: colors.value.muted,
        font: { size: 11 },
        maxRotation: 0,
        callback: (_value, index) => {
          const point = props.points[index]
          return index === 0 || index === props.points.length - 1 || index % 3 === 0 || point?.kind === 'current'
            ? point?.label ?? ''
            : ''
        },
      },
    },
    y: {
      beginAtZero: true,
      suggestedMax: 12,
      grid: { color: colors.value.border },
      border: { display: false },
      title: { display: true, text: 'Meses de custo de vida cobertos', color: colors.value.muted, font: { size: 11 } },
      ticks: {
        color: colors.value.muted,
        font: { size: 11 },
        precision: 0,
        callback: value => `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} meses`,
      },
    },
  },
}))

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatCoverage(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${value === 1 ? 'mês' : 'meses'}`
}

</script>

<template>
  <div ref="wrapRef" class="financial-security-chart">
    <Line :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.financial-security-chart { height: 23rem; padding: var(--space-4) var(--space-5) var(--space-2); }
@media (max-width: 720px) { .financial-security-chart { height: 20rem; padding-inline: var(--space-2); } }
</style>
