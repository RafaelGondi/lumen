<script setup lang="ts">
import { Trash2, Undo2 } from '@lucide/vue'
import type { CardInvoiceCredit } from '~/types/cardInvoice'
import { formatDateBr } from '~/utils/dateMoney'

defineProps<{ credit: CardInvoiceCredit; readonly?: boolean }>()
defineEmits<{ remove: [] }>()
</script>

<template>
  <div class="card-credit-row">
    <span class="card-credit-row__icon" aria-hidden="true"><Undo2 /></span>
    <div class="card-credit-row__main">
      <div class="card-credit-row__title">
        <strong>{{ credit.description }}</strong>
        <span>Estorno</span>
      </div>
      <small>{{ formatDateBr(credit.creditedAt) }}</small>
      <small v-if="credit.notes">{{ credit.notes }}</small>
    </div>
    <strong class="card-credit-row__amount">
      + <UiMoney :value="credit.creditAmount" />
    </strong>
    <button
      v-if="!readonly"
      type="button"
      class="card-credit-row__remove"
      :aria-label="`Remover estorno ${credit.description}`"
      title="Remover estorno"
      @click="$emit('remove')"
    >
      <Trash2 aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.card-credit-row { display: flex; padding: var(--space-4) var(--space-5); align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-positive-soft) 22%, var(--color-surface)); }
.card-credit-row__icon { display: grid; width: 2.25rem; height: 2.25rem; flex-shrink: 0; place-items: center; border-radius: var(--radius-sm); background: var(--color-positive); color: white; }
.card-credit-row__icon svg, .card-credit-row__remove svg { width: 1rem; height: 1rem; }
.card-credit-row__main { min-width: 0; flex: 1; }
.card-credit-row__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.card-credit-row__title strong { color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.card-credit-row__title span { padding: .15rem .45rem; border-radius: var(--radius-round); background: var(--color-positive-soft); color: var(--color-positive-ink); font-size: var(--text-2xs); font-weight: var(--weight-semibold); }
.card-credit-row__main small { display: block; margin-top: .15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.card-credit-row__amount { color: var(--color-positive-ink); font-size: var(--text-md); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; white-space: nowrap; }
.card-credit-row__remove { display: grid; width: 1.75rem; height: 1.75rem; padding: 0; place-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink-secondary); cursor: pointer; }
.card-credit-row__remove:hover { border-color: var(--color-negative); color: var(--color-negative); }
@media (max-width: 768px) { .card-credit-row { flex-wrap: wrap; } .card-credit-row__amount { width: 100%; padding-left: calc(2.25rem + var(--space-3)); order: 3; } .card-credit-row__remove { margin-left: auto; } }
</style>
