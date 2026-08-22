<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Chart,
  type ChartOptions,
  type Plugin,
  type ScriptableLineSegmentContext,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { CardInvoiceProjectionMonth } from '~/types/cardInvoice'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = withDefaults(
  defineProps<{
    items: CardInvoiceProjectionMonth[]
    total: number
    /** Mês da fatura atualmente aberta (YYYY-MM). */
    activeMonth?: string | null
    title?: string
    subtitle?: string
  }>(),
  {
    activeMonth: null,
    title: 'Projeção de faturas',
    subtitle: 'Clique num mês para abrir a fatura.',
  },
)

const emit = defineEmits<{
  select: [month: string]
}>()

/**
 * Piso por mês para telas estreitas — abaixo disso os rótulos se sobrepõem.
 */
const MIN_MONTH_WIDTH = 44

const wrapRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

/**
 * Chart.js desenha em canvas e não resolve `var()`, então os tokens do Akoma
 * são lidos uma vez na montagem — mesmo padrão do CashFlowChart.
 */
const tokens = ref({
  line: '#5184b1',
  ink: '#213129',
  muted: '#67736b',
  border: 'rgba(33,49,41,.11)',
  surface: '#ffffff',
})

const firstProjectedIndex = computed(() => {
  const index = props.items.findIndex((item) => !item.past)
  return index < 0 ? 0 : index
})

const hasPast = computed(() => props.items.some((item) => item.past))

const projectedCount = computed(
  () => props.items.length - firstProjectedIndex.value,
)

const viewportWidth = ref(0)

/**
 * O mês é dimensionado para que a janela projetada preencha exatamente a
 * largura visível. Assim o histórico vira precisamente o transbordo à
 * esquerda, e a vista inicial fica idêntica à de antes — projeção ocupando
 * todo o gráfico, sem histórico à mostra.
 */
const monthWidth = computed(() => {
  if (!viewportWidth.value || !projectedCount.value) return MIN_MONTH_WIDTH
  return Math.max(MIN_MONTH_WIDTH, viewportWidth.value / projectedCount.value)
})

/**
 * Abre com o mês de referência encostado na borda esquerda: o padrão continua
 * sendo a projeção, e o histórico fica atrás, alcançável rolando.
 */
function anchorToCurrentMonth() {
  const el = scrollRef.value
  if (!el) return
  el.scrollLeft = firstProjectedIndex.value * monthWidth.value
}

let observer: ResizeObserver | null = null

onMounted(() => {
  const el = wrapRef.value
  if (el) {
    const cs = getComputedStyle(el)
    const read = (name: string, fallback: string) =>
      cs.getPropertyValue(name).trim() || fallback
    tokens.value = {
      line: read('--projection-line', tokens.value.line),
      ink: read('--color-ink', tokens.value.ink),
      muted: read('--color-ink-muted', tokens.value.muted),
      border: read('--color-border', tokens.value.border),
      surface: read('--color-surface', tokens.value.surface),
    }
  }
  const scroller = scrollRef.value
  if (scroller) {
    viewportWidth.value = scroller.clientWidth
    /** Reancorar no resize: a largura do mês depende da viewport. */
    observer = new ResizeObserver(() => {
      viewportWidth.value = scroller.clientWidth
      nextTick(anchorToCurrentMonth)
    })
    observer.observe(scroller)
  }
  nextTick(anchorToCurrentMonth)
})

onBeforeUnmount(() => observer?.disconnect())

watch(() => props.items.length, () => nextTick(anchorToCurrentMonth))

const plotWidth = computed(() =>
  Math.max(props.items.length * monthWidth.value, 320),
)

const activeIndex = computed(() =>
  props.items.findIndex((item) => item.month === props.activeMonth),
)

/** Escala a partir do zero: fatura não é negativa, e cortar a base exageraria a variação. */
const yMax = computed(() => {
  const max = Math.max(0, ...props.items.map((item) => item.amount))
  if (max <= 0) return 300
  const padded = max * 1.15
  const exp = Math.floor(Math.log10(padded))
  const base = 10 ** exp
  const fraction = padded / base
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * base
})

function mutedLine(alpha: number) {
  return `color-mix(in srgb, ${tokens.value.line} ${alpha}%, transparent)`
}

const pointRadius = computed(() =>
  props.items.map((item, index) => {
    if (index === activeIndex.value) return 6
    if (item.amount <= 0) return 0
    return item.past ? 2.5 : 3.5
  }),
)

const pointColor = computed(() =>
  props.items.map((item) =>
    item.past
      ? mutedLine(35)
      : item.residual
        ? mutedLine(45)
        : tokens.value.line,
  ),
)

const chartData = computed(() => ({
  labels: props.items.map((item) => item.shortLabel),
  datasets: [
    {
      label: 'Fatura',
      data: props.items.map((item) => item.amount),
      borderColor: tokens.value.line,
      borderWidth: 2,
      /**
       * Histórico em traço fino e esmaecido: separa visualmente o que já
       * aconteceu do que é estimativa, sem precisar de uma segunda série.
       */
      segment: {
        borderColor: (ctx: ScriptableLineSegmentContext) =>
          props.items[ctx.p1DataIndex]?.past
            ? mutedLine(38)
            : tokens.value.line,
        borderDash: (ctx: ScriptableLineSegmentContext) =>
          props.items[ctx.p1DataIndex]?.past ? [4, 3] : undefined,
      },
      backgroundColor: (ctx: { chart: Chart }) => {
        const { ctx: c, chartArea } = ctx.chart
        if (!chartArea) return 'transparent'
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        g.addColorStop(0, `color-mix(in srgb, ${tokens.value.line} 16%, transparent)`)
        g.addColorStop(1, `color-mix(in srgb, ${tokens.value.line} 1%, transparent)`)
        return g
      },
      fill: true,
      cubicInterpolationMode: 'monotone' as const,
      pointRadius: pointRadius.value,
      pointHoverRadius: 6,
      pointBackgroundColor: pointColor.value,
      pointBorderColor: tokens.value.surface,
      pointBorderWidth: 1.5,
    },
  ],
}))

/**
 * O eixo Y não pode viver dentro do canvas: o canvas rola na horizontal, e a
 * escala sairia da vista junto com os meses antigos — a curva ficaria sem
 * referência de valor. Então ele é HTML fixo à esquerda, e este plugin publica
 * a posição real de cada tick em pixels para os rótulos casarem com a grade,
 * sem depender de adivinhar paddings.
 */
const axisTicks = ref<{ label: string; top: number }[]>([])

const axisSync: Plugin<'line'> = {
  id: 'axisSync',
  afterLayout(chart) {
    const scale = chart.scales.y
    axisTicks.value = scale.ticks.map((tick) => ({
      label: formatAxis(Number(tick.value)),
      top: scale.getPixelForValue(Number(tick.value)),
    }))
  },
}

/** Divisor entre histórico e projeção — a referência que explica o traço esmaecido. */
const nowDivider: Plugin<'line'> = {
  id: 'nowDivider',
  beforeDatasetsDraw(chart) {
    if (!hasPast.value) return
    const index = firstProjectedIndex.value
    if (index <= 0) return
    const { ctx, chartArea, scales } = chart
    const x = scales.x.getPixelForValue(index - 0.5)
    ctx.save()
    ctx.strokeStyle = tokens.value.line
    ctx.globalAlpha = 0.4
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

/* ---------- tooltip em HTML ---------- */

const tooltip = ref<{
  item: CardInvoiceProjectionMonth
  x: number
  y: number
  width: number
} | null>(null)

const tooltipStyle = computed(() => {
  const t = tooltip.value
  if (!t) return undefined
  const razao = t.width ? t.x / t.width : 0.5
  const alinhamento = razao > 0.7 ? 'calc(-100% + 1rem)' : razao < 0.3 ? '-1rem' : '-50%'
  const abaixo = t.y < 120
  return {
    left: `${t.x}px`,
    top: `${t.y}px`,
    transform: `translate(${alinhamento}, ${abaixo ? '0.75rem' : 'calc(-100% - 0.75rem)'})`,
  }
})

function externalTooltip(context: { chart: Chart; tooltip: any }) {
  const model = context.tooltip
  if (!model.opacity) {
    tooltip.value = null
    return
  }
  const index = model.dataPoints?.[0]?.dataIndex
  const item = index == null ? null : props.items[index]
  if (!item) {
    tooltip.value = null
    return
  }
  tooltip.value = { item, x: model.caretX, y: model.caretY, width: context.chart.width }
}

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  onClick: (_e, elements) => {
    const item = props.items[elements[0]?.index ?? -1]
    if (item) emit('select', item.month)
  },
  onHover: (event, elements) => {
    const target = event.native?.target as HTMLElement | undefined
    if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
  },
  plugins: {
    legend: { display: false },
    tooltip: { enabled: false, external: externalTooltip as never },
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
      },
    },
    y: {
      min: 0,
      max: yMax.value,
      grid: { color: tokens.value.border },
      border: { display: false },
      ticks: {
        /** Rótulos vivem no eixo HTML fixo; aqui só a grade. */
        display: false,
        maxTicksLimit: 5,
      },
    },
  },
}))

function formatAxis(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: abs >= 10000 ? 0 : 1,
    })}k`
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonthKey(month: string) {
  const [year, value] = month.split('-')
  return `${value}/${year}`
}
</script>

<template>
  <!--
    Mesma escolha do CashFlowChart: série de dados em `sea`, não no accent do
    app. O accent fica reservado para chrome, e com ele a linha voltaria a ter
    a cor da nav e dos botões.
  -->
  <div ref="wrapRef" class="projection-curve" data-accent="sea">
    <div class="projection-curve__heading">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <strong>
        Total:
        <UiMoney :value="total" />
      </strong>
    </div>

    <div class="projection-curve__body">
      <div class="projection-curve__axis" aria-hidden="true">
        <span
          v-for="tick in axisTicks"
          :key="tick.label + tick.top"
          :style="{ top: `${tick.top}px` }"
        >
          {{ tick.label }}
        </span>
      </div>

      <div ref="scrollRef" class="projection-curve__scroll">
        <div
          class="projection-curve__plot"
          :style="{ width: `${plotWidth}px` }"
        >
          <ClientOnly>
            <Line
              :data="chartData"
              :options="chartOptions"
              :plugins="[nowDivider, axisSync]"
            />
            <template #fallback>
              <UiSkeleton height="100%" radius="md" />
            </template>
          </ClientOnly>

          <div
            v-if="tooltip"
            class="projection-curve__tooltip"
            :style="tooltipStyle"
          >
            <p>
              {{ formatMonthKey(tooltip.item.month) }}
              <span v-if="tooltip.item.past">· fechada</span>
            </p>
            <div>
              {{ formatMoney(tooltip.item.amount) }}
              <em v-if="tooltip.item.residual">residual</em>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="hasPast" class="projection-curve__hint">
      Role para a esquerda para ver as faturas já fechadas.
    </p>
  </div>
</template>

<style scoped>
.projection-curve {
  --projection-line: var(--accent);
}

.projection-curve__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.projection-curve__heading h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.projection-curve__heading p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-curve__heading strong {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.projection-curve__body {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: 3.75rem minmax(0, 1fr);
  gap: var(--space-2);
}

/*
 * Fica fora do container que rola, senão a escala sairia da vista junto com
 * os meses antigos. Os rótulos são posicionados pelo pixel real de cada tick,
 * publicado pelo plugin axisSync.
 */
.projection-curve__axis {
  position: relative;
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
}

.projection-curve__axis span {
  position: absolute;
  right: 0;
  transform: translateY(-50%);
  white-space: nowrap;
}

.projection-curve__scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.projection-curve__plot {
  position: relative;
  height: 15rem;
}

.projection-curve__tooltip {
  position: absolute;
  z-index: 3;
  min-width: 7.5rem;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--toast-bg);
  color: var(--toast-fg);
  box-shadow: var(--shadow-md);
  pointer-events: none;
  white-space: nowrap;
}

.projection-curve__tooltip p {
  margin-bottom: var(--space-2);
  color: rgb(255 255 255 / 72%);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
}

.projection-curve__tooltip div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.projection-curve__tooltip em {
  color: rgb(255 255 255 / 65%);
  font-size: var(--text-2xs);
  font-style: normal;
  font-weight: var(--weight-medium);
}

.projection-curve__hint {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
}

@media (max-width: 720px) {
  .projection-curve__plot {
    height: 13rem;
  }
}
</style>
