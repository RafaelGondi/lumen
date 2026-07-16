<script setup lang="ts">
import type { CashFlowDay } from '~/types/cashFlow'

const props = defineProps<{
  days: CashFlowDay[]
  selectedDate: string | null
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

const hoveredDate = ref<string | null>(null)

/** Proporção baixa: evita o gráfico “gigante” em telas largas. */
const width = 840
const height = 240
const padding = { top: 16, right: 12, bottom: 30, left: 48 }

const plotWidth = width - padding.left - padding.right
const plotHeight = height - padding.top - padding.bottom

const points = computed(() =>
  props.days.map((day, index) => ({
    day,
    index,
    x: xFor(index),
    y: yFor(day.balance),
  })),
)

const balances = computed(() => props.days.map((day) => day.balance))

const yDomain = computed(() => {
  const values = balances.value
  if (!values.length) return { min: 0, max: 1000 }
  const rawMin = Math.min(0, ...values)
  const rawMax = Math.max(...values, 100)
  const span = Math.max(rawMax - rawMin, 200)
  const padTop = span * 0.08
  const padBottom = rawMin < 0 ? span * 0.08 : 0
  return {
    min: rawMin - padBottom,
    max: rawMax + padTop,
  }
})

const ticks = computed(() => {
  const { min, max } = yDomain.value
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, index) => {
    return max - ((max - min) / steps) * index
  })
})

function xFor(index: number) {
  if (props.days.length <= 1) return padding.left + plotWidth / 2
  return padding.left + (index / (props.days.length - 1)) * plotWidth
}

function yFor(balance: number) {
  const { min, max } = yDomain.value
  const ratio = (balance - min) / (max - min || 1)
  return padding.top + plotHeight * (1 - ratio)
}

/** Curva monotônica em X (estilo d3.curveMonotoneX) — suave sem “loop”. */
function monotoneCurve(coords: { x: number; y: number }[]) {
  if (!coords.length) return ''
  if (coords.length === 1) return `M${coords[0]!.x} ${coords[0]!.y}`

  const xs = coords.map((point) => point.x)
  const ys = coords.map((point) => point.y)
  const n = coords.length
  const dx: number[] = []
  const dy: number[] = []
  const slopes: number[] = []

  for (let index = 0; index < n - 1; index += 1) {
    dx[index] = xs[index + 1]! - xs[index]!
    dy[index] = ys[index + 1]! - ys[index]!
    slopes[index] = dy[index]! / (dx[index]! || 1e-6)
  }

  const tangents = new Array<number>(n).fill(0)
  tangents[0] = slopes[0]!
  tangents[n - 1] = slopes[n - 2]!
  for (let index = 1; index < n - 1; index += 1) {
    if (slopes[index - 1]! * slopes[index]! <= 0) {
      tangents[index] = 0
    } else {
      tangents[index] = (slopes[index - 1]! + slopes[index]!) / 2
    }
  }

  for (let index = 0; index < n - 1; index += 1) {
    if (Math.abs(slopes[index]!) < 1e-8) {
      tangents[index] = 0
      tangents[index + 1] = 0
    } else {
      const alpha = tangents[index]! / slopes[index]!
      const beta = tangents[index + 1]! / slopes[index]!
      const s = alpha * alpha + beta * beta
      if (s > 9) {
        const factor = 3 / Math.sqrt(s)
        tangents[index] = factor * alpha * slopes[index]!
        tangents[index + 1] = factor * beta * slopes[index]!
      }
    }
  }

  let path = `M${xs[0]} ${ys[0]}`
  for (let index = 0; index < n - 1; index += 1) {
    const controlX1 = xs[index]! + dx[index]! / 3
    const controlY1 = ys[index]! + (tangents[index]! * dx[index]!) / 3
    const controlX2 = xs[index + 1]! - dx[index]! / 3
    const controlY2 = ys[index + 1]! - (tangents[index + 1]! * dx[index]!) / 3
    path += ` C${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${xs[index + 1]} ${ys[index + 1]}`
  }
  return path
}

const linePath = computed(() =>
  monotoneCurve(points.value.map((point) => ({ x: point.x, y: point.y }))),
)

const areaPath = computed(() => {
  if (!points.value.length || !linePath.value) return ''
  const first = points.value[0]!
  const last = points.value[points.value.length - 1]!
  const baseline = yFor(Math.max(0, yDomain.value.min))
  return `${linePath.value} L${last.x} ${baseline} L${first.x} ${baseline} Z`
})

const zeroLineY = computed(() => {
  if (yDomain.value.min >= 0 || yDomain.value.max <= 0) return null
  return yFor(0)
})

const todayIndex = computed(() =>
  props.days.findIndex((day) => day.isToday),
)

const tooltipDay = computed(
  () =>
    props.days.find((day) => day.date === hoveredDate.value) ?? null,
)

const tooltipIndex = computed(() =>
  props.days.findIndex((day) => day.date === hoveredDate.value),
)

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
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function xAxisLabels() {
  const labels: { day: number; index: number }[] = []
  const step = 3
  for (let index = 0; index < props.days.length; index += step) {
    labels.push({ day: props.days[index]!.day, index })
  }
  const last = props.days[props.days.length - 1]
  if (last && labels[labels.length - 1]?.day !== last.day) {
    labels.push({ day: last.day, index: props.days.length - 1 })
  }
  return labels
}

function formatSignedMoney(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatMoney(value)}`
}

function showDot(day: CashFlowDay) {
  return (
    day.isToday ||
    day.date === props.selectedDate ||
    day.date === hoveredDate.value ||
    day.movements.length > 0
  )
}
</script>

<template>
  <div class="cash-flow-chart">
    <div class="cash-flow-chart__heading">
      <div>
        <h2>Saldo dia a dia</h2>
        <p>
          Saldo nas contas bancárias (projetado) — alinhado ao previsto do
          dashboard
        </p>
      </div>
    </div>

    <div class="cash-flow-chart__plot-wrap">
      <svg
        class="cash-flow-chart__svg"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        aria-label="Gráfico de saldo diário"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stop-color="var(--cash-flow-line)"
              stop-opacity="0.24"
            />
            <stop
              offset="70%"
              stop-color="var(--cash-flow-line)"
              stop-opacity="0.06"
            />
            <stop
              offset="100%"
              stop-color="var(--cash-flow-line)"
              stop-opacity="0"
            />
          </linearGradient>
        </defs>

        <rect
          v-if="zeroLineY !== null"
          :x="padding.left"
          :y="zeroLineY"
          :width="plotWidth"
          :height="padding.top + plotHeight - zeroLineY"
          class="cash-flow-chart__negative-band"
        />

        <g aria-hidden="true">
          <line
            v-for="tick in ticks"
            :key="tick"
            :x1="padding.left"
            :x2="padding.left + plotWidth"
            :y1="yFor(tick)"
            :y2="yFor(tick)"
            class="cash-flow-chart__grid"
          />
          <text
            v-for="tick in ticks"
            :key="`label-${tick}`"
            :x="padding.left - 8"
            :y="yFor(tick) + 3"
            text-anchor="end"
            class="cash-flow-chart__axis-label"
          >
            {{ formatAxis(tick) }}
          </text>
        </g>

        <line
          v-if="zeroLineY !== null"
          :x1="padding.left"
          :x2="padding.left + plotWidth"
          :y1="zeroLineY"
          :y2="zeroLineY"
          class="cash-flow-chart__zero"
        />

        <path :d="areaPath" fill="url(#cashFlowFill)" />
        <path :d="linePath" class="cash-flow-chart__line" fill="none" />

        <line
          v-if="todayIndex >= 0"
          :x1="xFor(todayIndex)"
          :x2="xFor(todayIndex)"
          :y1="padding.top"
          :y2="padding.top + plotHeight"
          class="cash-flow-chart__today"
        />

        <g
          v-for="point in points"
          :key="point.day.date"
          class="cash-flow-chart__point-group"
          @mouseenter="hoveredDate = point.day.date"
          @mouseleave="hoveredDate = null"
          @click="emit('select', point.day.date)"
        >
          <circle :cx="point.x" :cy="point.y" r="10" fill="transparent" />
          <circle
            v-if="showDot(point.day)"
            :cx="point.x"
            :cy="point.y"
            :r="
              point.day.isToday || point.day.date === selectedDate ? 4.5 : 3
            "
            class="cash-flow-chart__dot"
            :class="{
              'cash-flow-chart__dot--active':
                point.day.date === selectedDate ||
                point.day.date === hoveredDate,
              'cash-flow-chart__dot--today': point.day.isToday,
              'cash-flow-chart__dot--critical': point.day.isCritical,
              'cash-flow-chart__dot--event':
                point.day.movements.length > 0 && !point.day.isCritical,
            }"
          />
        </g>

        <g aria-hidden="true">
          <text
            v-for="label in xAxisLabels()"
            :key="label.day"
            :x="xFor(label.index)"
            :y="height - 8"
            text-anchor="middle"
            class="cash-flow-chart__axis-label"
          >
            {{ label.day }}
          </text>
        </g>
      </svg>

      <div
        v-if="tooltipDay && tooltipIndex >= 0"
        class="cash-flow-chart__tooltip"
        :style="{
          left: `${(xFor(tooltipIndex) / width) * 100}%`,
          top: `${(yFor(tooltipDay.balance) / height) * 100}%`,
        }"
      >
        <strong>Dia {{ tooltipDay.day }}</strong>
        <p>Saldo: {{ formatMoney(tooltipDay.balance) }}</p>
        <ul
          v-if="tooltipDay.movements.length"
          class="cash-flow-chart__tooltip-list"
        >
          <li
            v-for="movement in tooltipDay.movements"
            :key="movement.id"
            :class="{
              'is-income': movement.signedAmount >= 0,
              'is-expense': movement.signedAmount < 0,
            }"
          >
            <span>{{ formatSignedMoney(movement.signedAmount) }}</span>
            {{ movement.description }}
          </li>
        </ul>
        <span v-else class="cash-flow-chart__tooltip-empty">
          Sem lançamentos
        </span>
      </div>
    </div>

    <ul class="cash-flow-chart__legend">
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--line" />
        Saldo acumulado
      </li>
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--today" />
        Hoje
      </li>
      <li>
        <span class="cash-flow-chart__swatch cash-flow-chart__swatch--negative" />
        Saldo negativo
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cash-flow-chart {
  --cash-flow-line: #1c6db8;
  --cash-flow-line-soft: color-mix(in srgb, var(--cash-flow-line) 72%, white);
}

.cash-flow-chart__heading {
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

.cash-flow-chart__plot-wrap {
  position: relative;
  width: 100%;
  height: 17rem;
}

.cash-flow-chart__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.cash-flow-chart__grid {
  stroke: var(--color-border);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0.85;
}

.cash-flow-chart__axis-label {
  fill: var(--color-ink-muted);
  font-size: 9.5px;
}

.cash-flow-chart__line {
  stroke: var(--cash-flow-line);
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.cash-flow-chart__today {
  stroke: var(--cash-flow-line-soft);
  stroke-width: 1.5;
  stroke-dasharray: 4 5;
}

.cash-flow-chart__zero {
  stroke: var(--color-negative);
  stroke-width: 1;
  stroke-dasharray: 4 4;
  opacity: 0.55;
}

.cash-flow-chart__negative-band {
  fill: var(--color-negative-soft);
  opacity: 0.45;
}

.cash-flow-chart__point-group {
  cursor: pointer;
}

.cash-flow-chart__dot {
  fill: var(--cash-flow-line);
  stroke: var(--color-surface);
  stroke-width: 1.5;
}

.cash-flow-chart__dot--event {
  fill: var(--color-positive);
}

.cash-flow-chart__dot--today,
.cash-flow-chart__dot--active {
  fill: #0f4f8c;
}

.cash-flow-chart__dot--critical {
  fill: var(--color-negative);
}

.cash-flow-chart__tooltip {
  position: absolute;
  z-index: 2;
  min-width: 10rem;
  max-width: 16rem;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transform: translate(-50%, calc(-100% - 10px));
  pointer-events: none;
}

.cash-flow-chart__tooltip strong {
  display: block;
  color: var(--color-ink);
  font-size: var(--text-xs);
}

.cash-flow-chart__tooltip p {
  margin-top: 0.1rem;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.cash-flow-chart__tooltip-empty {
  display: block;
  margin-top: 0.2rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.cash-flow-chart__tooltip-list {
  display: flex;
  margin: 0.3rem 0 0;
  padding: 0;
  flex-direction: column;
  gap: 0.15rem;
  list-style: none;
}

.cash-flow-chart__tooltip-list li {
  display: flex;
  gap: 0.35rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  line-height: 1.3;
}

.cash-flow-chart__tooltip-list li span {
  flex-shrink: 0;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.cash-flow-chart__tooltip-list li.is-income span {
  color: var(--color-positive-ink);
}

.cash-flow-chart__tooltip-list li.is-expense span {
  color: var(--color-negative-ink);
}

.cash-flow-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: var(--space-2);
  list-style: none;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.cash-flow-chart__legend li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.cash-flow-chart__swatch {
  width: 1rem;
  height: 0.25rem;
  border-radius: var(--radius-round);
}

.cash-flow-chart__swatch--line {
  background: var(--cash-flow-line);
}

.cash-flow-chart__swatch--today {
  height: 0.85rem;
  width: 0;
  border-left: 2px dashed var(--cash-flow-line-soft);
}

.cash-flow-chart__swatch--negative {
  height: 0.7rem;
  background: var(--color-negative-soft);
  border: 1px solid var(--color-negative);
}
</style>
