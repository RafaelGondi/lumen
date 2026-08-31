<script setup lang="ts">
import { Eye, EyeOff } from '@lucide/vue'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Chart,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type ScriptableLineSegmentContext,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { CashFlowDay, CashFlowSnapshot } from '~/types/cashFlow'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{
  days: CashFlowDay[]
  snapshot: CashFlowSnapshot | null
  selectedDate: string | null
  criticalThreshold?: number
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

const CRITICAL_FALLBACK = 500
const SNAPSHOT_VISIBILITY_KEY = 'lumen:cash-flow:snapshot-visible:v2'
const threshold = computed(() => props.criticalThreshold ?? CRITICAL_FALLBACK)
const showSnapshot = ref(false)
const visibleSnapshot = computed(() =>
  showSnapshot.value ? props.snapshot : null,
)

/**
 * Cores saem dos tokens do Akoma, mas o Chart.js desenha em canvas e só
 * aceita string — não resolve `var()`. Então lemos os valores computados uma
 * vez, quando o componente monta no cliente.
 */
/**
 * O trecho crítico usa `clay`, não `--danger`.
 *
 * Só a paleta ativa vira token CSS vivo, então clay vem da tabela que o app
 * já mantém das outras paletas — a mesma que o seletor de categoria usa, e
 * que `scripts/remap-akoma-0.9.mjs` regenera quando o Akoma sobe de versão.
 */
const CRITICAL_COLOR = AKOMA_PALETTE_FAMILIES.clay[2]

const wrapRef = ref<HTMLElement | null>(null)
const tokens = ref({
  line: '#5184b1',
  snapshot: '#7c8780',
  critical: CRITICAL_COLOR,
  ink: '#213129',
  muted: '#67736b',
  border: 'rgba(33,49,41,.11)',
  surface: '#ffffff',
})

onMounted(() => {
  const savedVisibility = sessionStorage.getItem(SNAPSHOT_VISIBILITY_KEY)
  if (savedVisibility !== null) showSnapshot.value = savedVisibility === 'true'

  const el = wrapRef.value
  if (!el) return
  const cs = getComputedStyle(el)
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  tokens.value = {
    line: read('--cash-flow-line', tokens.value.line),
    snapshot: read('--color-ink-muted', tokens.value.snapshot),
    critical: CRITICAL_COLOR,
    ink: read('--color-ink', tokens.value.ink),
    muted: read('--color-ink-muted', tokens.value.muted),
    border: read('--color-border', tokens.value.border),
    surface: read('--color-surface', tokens.value.surface),
  }
})

watch(showSnapshot, (visible) => {
  if (import.meta.client) {
    sessionStorage.setItem(SNAPSHOT_VISIBILITY_KEY, String(visible))
  }
})

const todayIndex = computed(() => props.days.findIndex((d) => d.isToday))
const selectedIndex = computed(() => props.days.findIndex((d) => d.date === props.selectedDate))
const snapshotBalances = computed(
  () => new Map(visibleSnapshot.value?.points.map((point) => [point.date, point.balance]) ?? []),
)

/** Escala com folga só onde importa: embaixo apenas quando há saldo negativo. */
const yBounds = computed(() => {
  const values = [
    ...props.days.map((d) => d.balance),
    ...(visibleSnapshot.value?.points.map((point) => point.balance) ?? []),
  ]
  if (!values.length) return { min: 0, max: 1000 }
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(...values, 100)
  const span = Math.max(rawMax - rawMin, 200)
  return {
    min: rawMin - (rawMin < 0 ? span * 0.08 : 0),
    max: rawMax + span * 0.08,
  }
})

const pointRadius = computed(() =>
  props.days.map((d, i) => {
    if (i === selectedIndex.value) return 6
    if (d.isToday) return 5
    if (d.isCritical) return 4
    return d.movements.length ? 3 : 0
  }),
)

const pointColor = computed(() =>
  props.days.map((d, i) =>
    d.isCritical ? tokens.value.critical : tokens.value.line,
  ),
)

const chartData = computed<ChartData<'line'>>(() => {
  const datasets: ChartData<'line'>['datasets'] = [
    {
      label: 'Saldo',
      data: props.days.map((d) => d.balance),
      borderColor: tokens.value.line,
      borderWidth: 2,
      /**
       * Substitui o clipPath do SVG anterior: o Chart.js decide a cor de cada
       * segmento, então a linha vira vermelha exatamente onde o saldo cruza o
       * limiar, sem recorte manual.
       */
      segment: {
        borderColor: (ctx: ScriptableLineSegmentContext) => {
          const menor = Math.min(ctx.p0.parsed.y ?? Infinity, ctx.p1.parsed.y ?? Infinity)
          return menor <= threshold.value ? tokens.value.critical : tokens.value.line
        },
      },
      backgroundColor: (ctx: { chart: Chart }) => {
        const { ctx: c, chartArea } = ctx.chart
        if (!chartArea) return 'transparent'
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        g.addColorStop(0, `color-mix(in srgb, ${tokens.value.line} 18%, transparent)`)
        g.addColorStop(1, `color-mix(in srgb, ${tokens.value.line} 1%, transparent)`)
        return g
      },
      fill: true,
      /** Mesma curva do SVG anterior: suaviza sem ultrapassar os pontos. */
      cubicInterpolationMode: 'monotone' as const,
      pointRadius: pointRadius.value,
      pointHoverRadius: 6,
      pointBackgroundColor: pointColor.value,
      pointBorderColor: tokens.value.surface,
      pointBorderWidth: 1.5,
    },
  ]

  if (visibleSnapshot.value) {
    datasets.push({
      label: 'Previsto no início do mês',
      data: props.days.map(
        (day) => snapshotBalances.value.get(day.date) ?? null,
      ),
      borderColor: tokens.value.snapshot,
      borderWidth: 2,
      borderDash: [6, 5],
      backgroundColor: 'transparent',
      fill: false,
      cubicInterpolationMode: 'monotone' as const,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: tokens.value.snapshot,
      spanGaps: true,
    })
  }

  return {
    labels: props.days.map((d) => String(d.day)),
    datasets,
  }
})

/** Linha tracejada do dia de hoje, desenhada por baixo dos pontos. */
const todayLine: Plugin<'line'> = {
  id: 'todayLine',
  beforeDatasetsDraw(chart) {
    const idx = todayIndex.value
    if (idx < 0) return
    const { ctx, chartArea, scales } = chart
    const x = scales.x.getPixelForValue(idx)
    ctx.save()
    ctx.strokeStyle = tokens.value.line
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

/** Zero e limiar crítico: as duas referências que explicam a cor da linha. */
const referenceLines: Plugin<'line'> = {
  id: 'referenceLines',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart
    const draw = (value: number, color: string, alpha: number, dash: number[]) => {
      const y = scales.y.getPixelForValue(value)
      if (y < chartArea.top || y > chartArea.bottom) return
      ctx.save()
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.moveTo(chartArea.left, y)
      ctx.lineTo(chartArea.right, y)
      ctx.stroke()
      ctx.restore()
    }
    draw(threshold.value, tokens.value.critical, 0.28, [3, 3])
    draw(0, tokens.value.critical, 0.5, [6, 3])
  },
}

/* ---------- tooltip em HTML ---------- */

const tooltip = ref<{ day: CashFlowDay; x: number; y: number; width: number } | null>(null)

/**
 * O card do Akoma tem `overflow: hidden`, então o tooltip não pode vazar para
 * fora da área do gráfico — perto das bordas ele seria cortado. Em vez de
 * centralizar sempre, a âncora acompanha a posição: à esquerda no início do
 * gráfico, à direita no fim. E cai para baixo do ponto quando não há espaço
 * acima.
 */
const tooltipStyle = computed(() => {
  const t = tooltip.value
  if (!t) return undefined
  const razao = t.width ? t.x / t.width : 0.5
  const alinhamento = razao > 0.7 ? 'calc(-100% + 1rem)' : razao < 0.3 ? '-1rem' : '-50%'
  const abaixo = t.y < 130
  return {
    left: `${t.x}px`,
    top: `${t.y}px`,
    transform: `translate(${alinhamento}, ${abaixo ? '0.75rem' : 'calc(-100% - 0.75rem)'})`,
  }
})

/**
 * Tooltip externo em vez do nativo: o nativo desenha no canvas e não daria a
 * lista de lançamentos com valores coloridos que a versão anterior tinha.
 * O handler só publica posição e índice; o resto é markup normal.
 */
function externalTooltip(context: { chart: Chart; tooltip: any }) {
  const model = context.tooltip
  if (!model.opacity) {
    tooltip.value = null
    return
  }
  const index = model.dataPoints?.[0]?.dataIndex
  const day = index == null ? null : props.days[index]
  if (!day) {
    tooltip.value = null
    return
  }
  tooltip.value = { day, x: model.caretX, y: model.caretY, width: context.chart.width }
}

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  /**
   * O ganho principal sobre o SVG anterior: passar o mouse em qualquer ponto
   * da área trava no dia mais próximo, em vez de exigir acertar o ponto.
   */
  interaction: { mode: 'index', intersect: false },
  onClick: (_e, elements) => {
    const day = props.days[elements[0]?.index ?? -1]
    if (day) emit('select', day.date)
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
        autoSkipPadding: 16,
      },
    },
    y: {
      min: yBounds.value.min,
      max: yBounds.value.max,
      grid: { color: tokens.value.border },
      border: { display: false },
      ticks: {
        color: tokens.value.muted,
        font: { size: 11 },
        maxTicksLimit: 5,
        callback: (value) => formatAxis(Number(value)),
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

function formatSignedMoney(value: number) {
  return `${value >= 0 ? '+' : ''}${formatMoney(value)}`
}

function snapshotBalance(day: CashFlowDay) {
  return snapshotBalances.value.get(day.date) ?? null
}

function formatSnapshotDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

const snapshotLegend = computed(() => {
  if (!visibleSnapshot.value) return ''
  return visibleSnapshot.value.kind === 'scheduled'
    ? 'Previsto no início do mês'
    : `Referência capturada em ${formatSnapshotDate(visibleSnapshot.value.createdAt)}`
})
</script>

<template>
  <!--
    A série de dados usa ocean, não o accent do app. O guia do Akoma reserva
    o accent para chrome (page label, nav ativa), e uma linha de gráfico não
    é chrome. Precisa ser uma paleta diferente da ativa: com a mesma, a linha
    volta a ter a cor dos botões e da nav. Escopar o data-accent aqui dá a cor
    e sem arrastar o resto da interface junto.
  -->
  <div
    ref="wrapRef"
    class="cash-flow-chart"
    data-accent="sea"
    :style="{ '--cash-flow-critical': CRITICAL_COLOR }"
  >
    <div class="cash-flow-chart__heading">
      <div>
        <h2>Saldo dia a dia</h2>
        <p>
          Saldo nas contas bancárias (projetado) — alinhado ao previsto do
          dashboard
        </p>
      </div>
      <button
        v-if="snapshot"
        type="button"
        class="cash-flow-chart__snapshot-toggle"
        :class="{ 'is-active': showSnapshot }"
        :aria-pressed="showSnapshot"
        @click="showSnapshot = !showSnapshot"
      >
        <EyeOff v-if="showSnapshot" aria-hidden="true" />
        <Eye v-else aria-hidden="true" />
        {{ showSnapshot ? 'Ocultar referência' : 'Mostrar referência' }}
      </button>
    </div>

    <div class="cash-flow-chart__plot-wrap">
      <!--
        Chart.js desenha em canvas, que não existe no servidor. ClientOnly
        evita o descompasso de hidratação em vez de contorná-lo.
      -->
      <ClientOnly>
        <Line :data="chartData" :options="chartOptions" :plugins="[todayLine, referenceLines]" />
        <template #fallback>
          <UiSkeleton height="100%" radius="md" />
        </template>
      </ClientOnly>

      <div
        v-if="tooltip"
        class="cash-flow-chart__tooltip"
        :style="tooltipStyle"
      >
        <strong>
          Dia {{ tooltip.day.day }}
          <span v-if="tooltip.day.isToday">· hoje</span>
        </strong>
        <p>Saldo: {{ formatMoney(tooltip.day.balance) }}</p>
        <template v-if="snapshotBalance(tooltip.day) !== null">
          <p>
            Previsto no início:
            {{ formatMoney(snapshotBalance(tooltip.day)!) }}
          </p>
          <p>
            Diferença:
            {{
              formatSignedMoney(
                tooltip.day.balance - snapshotBalance(tooltip.day)!,
              )
            }}
          </p>
        </template>
        <ul v-if="tooltip.day.movements.length" class="cash-flow-chart__tooltip-list">
          <li
            v-for="movement in tooltip.day.movements.slice(0, 4)"
            :key="movement.id"
            :class="movement.signedAmount >= 0 ? 'is-income' : 'is-expense'"
          >
            <span>{{ formatSignedMoney(movement.signedAmount) }}</span>
            {{ movement.description }}
          </li>
          <li v-if="tooltip.day.movements.length > 4" class="is-more">
            +{{ tooltip.day.movements.length - 4 }} lançamento(s)
          </li>
        </ul>
        <span v-else class="cash-flow-chart__tooltip-empty">Sem lançamentos</span>
      </div>
    </div>

    <ul class="cash-flow-chart__legend">
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--line" />
        Saldo acumulado
      </li>
      <li v-if="visibleSnapshot">
        <span
          class="cash-flow-chart__swatch cash-flow-chart__swatch--snapshot"
        />
        {{ snapshotLegend }}
      </li>
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--today" />
        Hoje
      </li>
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--critical" />
        Abaixo de {{ formatMoney(threshold) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
/**
 * `--accent` direto, não `--color-brand`: o alias é declarado no :root e
 * congela lá o valor computado, então não acompanharia o data-accent
 * escopado neste elemento.
 */
.cash-flow-chart {
  --cash-flow-line: var(--accent);
}

.cash-flow-chart__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.cash-flow-chart__heading h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.cash-flow-chart__heading p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.cash-flow-chart__snapshot-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
  min-height: 2rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  font: inherit;
  font-size: var(--text-xs);
  cursor: pointer;
}

.cash-flow-chart__snapshot-toggle:hover,
.cash-flow-chart__snapshot-toggle.is-active {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.cash-flow-chart__snapshot-toggle svg {
  width: 0.9rem;
  height: 0.9rem;
}

.cash-flow-chart__plot-wrap {
  position: relative;
  height: 19rem;
}

.cash-flow-chart__tooltip {
  position: absolute;
  z-index: 3;
  min-width: 11rem;
  max-width: 16rem;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--toast-bg);
  color: var(--toast-fg);
  box-shadow: var(--shadow-md);
  pointer-events: none;
}

.cash-flow-chart__tooltip strong {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.cash-flow-chart__tooltip strong span {
  opacity: 0.7;
  font-weight: var(--weight-regular);
}

.cash-flow-chart__tooltip p {
  margin-top: 0.15rem;
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}

.cash-flow-chart__tooltip-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: var(--space-2) 0 0;
  margin: var(--space-2) 0 0;
  border-top: 1px solid rgb(255 255 255 / 15%);
  list-style: none;
}

.cash-flow-chart__tooltip-list li {
  overflow: hidden;
  font-size: var(--text-2xs);
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.cash-flow-chart__tooltip-list span {
  margin-right: 0.35rem;
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-semibold);
}

.cash-flow-chart__tooltip-list .is-income span {
  color: #8fd3ac;
}

.cash-flow-chart__tooltip-list .is-expense span {
  color: #eda79c;
}

.cash-flow-chart__tooltip-list .is-more {
  opacity: 0.6;
}

.cash-flow-chart__tooltip-empty {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--text-2xs);
  opacity: 0.65;
}

.cash-flow-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: 0;
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  list-style: none;
}

.cash-flow-chart__legend li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cash-flow-chart__swatch {
  width: 0.75rem;
  height: 0.2rem;
  border-radius: 999px;
  background: var(--cash-flow-line);
}

.cash-flow-chart__swatch--today {
  height: 0.75rem;
  width: 0;
  border-left: 2px dashed var(--cash-flow-line);
  background: none;
  border-radius: 0;
}

.cash-flow-chart__swatch--snapshot {
  height: 0;
  border-top: 2px dashed var(--color-ink-muted);
  background: none;
  border-radius: 0;
}

.cash-flow-chart__swatch--critical {
  background: var(--cash-flow-critical);
}

@media (max-width: 640px) {
  .cash-flow-chart__heading {
    flex-direction: column;
    gap: var(--space-3);
  }

  .cash-flow-chart__plot-wrap {
    height: 15rem;
  }
}
</style>
