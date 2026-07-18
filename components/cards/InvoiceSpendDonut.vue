<script setup lang="ts">
import type { CardInvoiceCategorySpend } from '~/types/cardInvoice'
import { roundMoney } from '~/utils/dateMoney'

const props = withDefaults(
  defineProps<{
    items: CardInvoiceCategorySpend[]
    othersLabel?: string
    visibleLimit?: number
  }>(),
  {
    othersLabel: 'itens',
    visibleLimit: 6,
  },
)

type DonutSegment = CardInvoiceCategorySpend & {
  startAngle: number
  endAngle: number
}

const hoveredId = ref<string | null>(null)

const visibleItems = computed(() => {
  if (props.items.length <= props.visibleLimit) return props.items

  const head = props.items.slice(0, props.visibleLimit - 1)
  const rest = props.items.slice(props.visibleLimit - 1)
  const amount = roundMoney(rest.reduce((sum, item) => sum + item.amount, 0))
  const percent = rest.reduce((sum, item) => sum + item.percent, 0)

  return [
    ...head,
    {
      id: '__others__',
      name: `+${rest.length} ${props.othersLabel}`,
      color: '#9aa3af',
      amount,
      percent,
    },
  ]
})

const segments = computed<DonutSegment[]>(() => {
  const total = visibleItems.value.reduce((sum, item) => sum + item.amount, 0)
  if (total <= 0) return []

  let cursor = 0
  return visibleItems.value.map((item) => {
    const startAngle = (cursor / total) * 360
    cursor += item.amount
    return {
      ...item,
      startAngle,
      endAngle: (cursor / total) * 360,
    }
  })
})

const activeSegment = computed(
  () => segments.value.find((segment) => segment.id === hoveredId.value) ?? null,
)

const tooltipStyle = computed(() => {
  const segment = activeSegment.value
  if (!segment) return null

  const midAngle = (segment.startAngle + segment.endAngle) / 2
  const anchor = polarToCartesian(50, 50, 56, midAngle)
  const flipBelow = midAngle > 90 && midAngle < 270

  return {
    left: `${anchor.x}%`,
    top: `${anchor.y}%`,
    transform: flipBelow
      ? 'translate(-50%, 0.45rem)'
      : 'translate(-50%, calc(-100% - 0.45rem))',
  }
})

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const radians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  }
}

function describeArc(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const sweep = Math.max(0, endAngle - startAngle)
  if (sweep <= 0) return ''

  const safeEndAngle = sweep >= 359.99 ? startAngle + 359.99 : endAngle
  const safeSweep = safeEndAngle - startAngle

  const startOuter = polarToCartesian(centerX, centerY, outerRadius, startAngle)
  const endOuter = polarToCartesian(
    centerX,
    centerY,
    outerRadius,
    safeEndAngle,
  )
  const startInner = polarToCartesian(
    centerX,
    centerY,
    innerRadius,
    safeEndAngle,
  )
  const endInner = polarToCartesian(centerX, centerY, innerRadius, startAngle)
  const largeArc = safeSweep > 180 ? 1 : 0

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function formatTooltipMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function setHovered(id: string | null) {
  hoveredId.value = id
}
</script>

<template>
  <div class="invoice-spend-donut">
    <div class="invoice-spend-donut__chart">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path
          v-for="segment in segments"
          :key="segment.id"
          :d="describeArc(50, 50, 45, 27, segment.startAngle, segment.endAngle)"
          :fill="segment.color"
          class="invoice-spend-donut__slice"
          @mouseenter="setHovered(segment.id)"
          @mouseleave="setHovered(null)"
        />
      </svg>

      <div
        v-if="activeSegment && tooltipStyle"
        class="invoice-spend-donut__tooltip"
        :style="tooltipStyle"
        role="tooltip"
      >
        <p>{{ activeSegment.name }}</p>
        <div>
          <span
            aria-hidden="true"
            :style="{ background: activeSegment.color }"
          />
          {{ formatTooltipMoney(activeSegment.amount) }}
          · {{ activeSegment.percent }}%
        </div>
      </div>
    </div>

    <ul class="invoice-spend-donut__legend">
      <li v-for="item in visibleItems" :key="item.id">
        <span
          class="invoice-spend-donut__dot"
          :style="{ background: item.color }"
        />
        <strong>{{ item.name }}</strong>
        <div class="invoice-spend-donut__values">
          <span class="numeric"><UiMoney :value="item.amount" /></span>
          <span>{{ item.percent }}%</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.invoice-spend-donut {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: var(--space-5);
  align-items: center;
}

.invoice-spend-donut__chart {
  position: relative;
  z-index: 1;
  overflow: visible;
  width: 5.5rem;
  height: 5.5rem;
}

.invoice-spend-donut__chart svg {
  display: block;
  overflow: visible;
  width: 100%;
  height: 100%;
}

.invoice-spend-donut__slice {
  cursor: pointer;
}

.invoice-spend-donut__tooltip {
  position: absolute;
  z-index: 3;
  min-width: 7.5rem;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: #151b24;
  color: white;
  box-shadow: var(--shadow-md);
  pointer-events: none;
  white-space: nowrap;
}

.invoice-spend-donut__tooltip p {
  margin-bottom: var(--space-2);
  color: rgb(255 255 255 / 72%);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
}

.invoice-spend-donut__tooltip div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.invoice-spend-donut__tooltip span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 0.15rem;
  flex-shrink: 0;
}

.invoice-spend-donut__legend {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 0.55rem;
  list-style: none;
}

.invoice-spend-donut__legend li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.invoice-spend-donut__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.invoice-spend-donut__legend strong {
  min-width: 0;
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invoice-spend-donut__values {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--space-2);
  white-space: nowrap;
}

.invoice-spend-donut__values span:first-child {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.invoice-spend-donut__values span:last-child {
  min-width: 2.25rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-align: right;
}

@media (max-width: 860px) {
  .invoice-spend-donut {
    grid-template-columns: 1fr;
  }
}
</style>
