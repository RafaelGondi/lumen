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

const gradient = computed(() => {
  if (!props.items.length) return 'conic-gradient(var(--color-border) 0 100%)'

  let cursor = 0
  const stops: string[] = []
  for (const item of props.items) {
    const next = cursor + item.percent
    stops.push(`${item.color} ${cursor}% ${next}%`)
    cursor = next
  }
  if (cursor < 100) {
    stops.push(`var(--color-border) ${cursor}% 100%`)
  }
  return `conic-gradient(${stops.join(', ')})`
})

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
</script>

<template>
  <div class="invoice-spend-donut">
    <div
      class="invoice-spend-donut__chart"
      :style="{ background: gradient }"
      aria-hidden="true"
    >
      <span />
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
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
}

.invoice-spend-donut__chart span {
  position: absolute;
  inset: 1.1rem;
  border-radius: 50%;
  background: var(--color-surface);
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
