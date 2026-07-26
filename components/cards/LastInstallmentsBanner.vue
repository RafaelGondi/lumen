<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { CardInvoiceEntry } from '~/types/cardInvoice'

const props = defineProps<{
  items: CardInvoiceEntry[]
}>()

const total = computed(() =>
  props.items.reduce((sum, e) => sum + e.amount, 0),
)

const expanded = ref(true)

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <div class="last-installments">
    <button
      type="button"
      class="last-installments__header"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span class="last-installments__icon" aria-hidden="true">🏁</span>
      <span class="last-installments__title">
        {{ items.length }}
        {{ items.length === 1 ? 'compra parcelada termina' : 'compras parceladas terminam' }}
        neste mês
      </span>
      <strong class="last-installments__total">{{ formatMoney(total) }}</strong>
      <ChevronDown
        class="last-installments__chevron"
        :class="{ 'last-installments__chevron--open': expanded }"
        aria-hidden="true"
      />
    </button>

    <div v-show="expanded" class="last-installments__body">
      <div
        v-for="entry in items"
        :key="entry.id"
        class="last-installments__row"
      >
        <span class="last-installments__desc">{{ entry.description }}</span>
        <span class="last-installments__meta">
          Parcela {{ entry.installmentIndex }} de {{ entry.installmentCount }} · última
        </span>
        <strong class="last-installments__amount">{{ formatMoney(entry.amount) }}</strong>
      </div>
    </div>
  </div>
</template>

<style scoped>
.last-installments {
  border: 1px solid color-mix(in srgb, var(--color-warning, #e6a548) 35%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-warning, #e6a548) 8%, var(--color-surface));
  overflow: hidden;
}

.last-installments__header {
  display: flex;
  width: 100%;
  padding: var(--space-4) var(--space-5);
  align-items: center;
  gap: var(--space-3);
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.last-installments__icon {
  font-size: 1rem;
  flex-shrink: 0;
  line-height: 1;
}

.last-installments__title {
  flex: 1;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.last-installments__total {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.last-installments__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-ink-muted);
  transition: transform var(--transition-fast);
}

.last-installments__chevron--open {
  transform: rotate(180deg);
}

.last-installments__body {
  border-top: 1px solid color-mix(in srgb, var(--color-warning, #e6a548) 25%, transparent);
}

.last-installments__row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 0.1rem var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid color-mix(in srgb, var(--color-warning, #e6a548) 15%, transparent);
}

.last-installments__row:last-child {
  border-bottom: 0;
}

.last-installments__desc {
  grid-column: 1;
  grid-row: 1;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.last-installments__meta {
  grid-column: 1;
  grid-row: 2;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.last-installments__amount {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
