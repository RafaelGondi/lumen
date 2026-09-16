<script setup lang="ts">
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'vue-chartjs'
import type { SpendingPaceDay, SpendingPaceView } from '~/types/spendingPace'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarController,
  BarElement,
  Legend,
  Tooltip,
)

const props = defineProps<{
  days: SpendingPaceDay[]
  view: SpendingPaceView
  currentLabel: string
  previousLabel: string
  cutoffDay: number
  extendPrevious: boolean
  selectedDay: number | null
}>()

const emit = defineEmits<{
  select: [day: number]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const colors = ref({
  current: '#3f8f77',
  previous: '#527dab',
  grid: 'rgba(33,49,41,.1)',
  muted: '#67736b',
  surface: '#ffffff',
})

const chartDays = computed(() =>
  props.cutoffDay > 0 && !props.extendPrevious
    ? props.days.filter((day) => day.day <= props.cutoffDay)
    : props.days,
)

onMounted(() => {
  if (!wrapRef.value) return
  const style = getComputedStyle(wrapRef.value)
  const read = (token: string, fallback: string) =>
    style.getPropertyValue(token).trim() || fallback
  colors.value = {
    current: read('--color-positive', colors.value.current),
    previous: read('--color-brand', colors.value.previous),
    grid: read('--color-border', colors.value.grid),
    muted: read('--color-ink-muted', colors.value.muted),
    surface: read('--color-surface', colors.value.surface),
  }
})

const lineData = computed<ChartData<'line'>>(() => ({
  labels: chartDays.value.map((day) => String(day.day)),
  datasets: [
    {
      label: props.previousLabel,
      data: chartDays.value.map((day) => day.previousCumulative),
      borderColor: colors.value.previous,
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 5],
      cubicInterpolationMode: 'monotone',
      pointRadius: chartDays.value.map((day) =>
        day.day === props.selectedDay ? 6 : day.previousDaily ? 2 : 0,
      ),
      pointHoverRadius: 5,
      pointBackgroundColor: colors.value.previous,
      pointBorderColor: colors.value.surface,
      pointBorderWidth: 1,
    },
    {
      label: props.currentLabel,
      data: chartDays.value.map((day) => day.currentCumulative),
      borderColor: colors.value.current,
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      cubicInterpolationMode: 'monotone',
      pointRadius: chartDays.value.map((day) => {
        if (day.day === props.selectedDay) return 6
        return day.day === props.cutoffDay ? 4 : day.currentDaily ? 2.5 : 0
      }),
      pointHoverRadius: 6,
      pointBackgroundColor: colors.value.current,
      pointBorderColor: colors.value.surface,
      pointBorderWidth: 1.5,
      spanGaps: false,
    },
  ],
}))

const barData = computed<ChartData<'bar'>>(() => ({
  labels: chartDays.value.map((day) => String(day.day)),
  datasets: [
    {
      label: props.previousLabel,
      data: chartDays.value.map((day) => day.previousDaily),
      backgroundColor: colors.value.previous,
      borderColor: colors.value.previous,
      borderWidth: chartDays.value.map((day) =>
        day.day === props.selectedDay ? 3 : 0,
      ),
      borderRadius: 4,
      maxBarThickness: 18,
    },
    {
      label: props.currentLabel,
      data: chartDays.value.map((day) => day.currentDaily),
      backgroundColor: colors.value.current,
      borderColor: colors.value.current,
      borderWidth: chartDays.value.map((day) =>
        day.day === props.selectedDay ? 3 : 0,
      ),
      borderRadius: 4,
      maxBarThickness: 18,
    },
  ],
}))

function money(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function axisMoney(value: number) {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

type TooltipValueItem = {
  datasetIndex: number
  parsed: { y: number | null }
}

function tooltipDifference(items: TooltipValueItem[]) {
  const previous = items.find((item) => item.datasetIndex === 0)?.parsed.y
  const current = items.find((item) => item.datasetIndex === 1)?.parsed.y
  if (previous === null || previous === undefined || current === null || current === undefined) {
    return undefined
  }

  const difference = current - previous
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : ''
  return ` Diferença: ${sign}${money(Math.abs(difference))}`
}

function baseOptions(type: 'line' | 'bar') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    onClick: (_event: unknown, elements: { index: number; datasetIndex: number }[]) => {
      const element = elements[0]
      if (!element) return
      emit('select', chartDays.value[element.index]!.day)
    },
    onHover: (event: { native?: Event | null }, elements: unknown[]) => {
      const target = event.native?.target as HTMLElement | undefined
      if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        align: 'start' as const,
        labels: { usePointStyle: true, boxWidth: 8, color: colors.value.muted },
      },
      tooltip: {
        callbacks: {
          title: (items: { label: string }[]) => `Dia ${items[0]?.label ?? ''}`,
          label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            ` ${context.dataset.label}: ${money(context.parsed.y ?? 0)}`,
          footer: (items: TooltipValueItem[]) => tooltipDifference(items),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: colors.value.grid },
        ticks: { color: colors.value.muted, maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: colors.value.grid },
        border: { display: false },
        ticks: {
          color: colors.value.muted,
          maxTicksLimit: 5,
          callback: (value: string | number) => axisMoney(Number(value)),
        },
      },
    },
  }
}

const lineOptions = computed<ChartOptions<'line'>>(
  () => baseOptions('line') as ChartOptions<'line'>,
)
const barOptions = computed<ChartOptions<'bar'>>(
  () => baseOptions('bar') as ChartOptions<'bar'>,
)
</script>

<template>
  <div ref="wrapRef" class="spending-pace-chart">
    <Line
      v-if="view === 'cumulative'"
      :data="lineData"
      :options="lineOptions"
    />
    <Bar v-else :data="barData" :options="barOptions" />
  </div>
</template>

<style scoped>
.spending-pace-chart {
  height: 25rem;
  min-height: 20rem;
}

@media (max-width: 720px) {
  .spending-pace-chart {
    height: 20rem;
  }
}
</style>
