<script setup lang="ts">
import { Copy, Layers, Pencil, Receipt, Trash2 } from '@lucide/vue'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import { formatDateBr } from '~/utils/dateMoney'

defineProps<{
  entry: CardInvoiceDetail['entries'][number]
  /** No agrupamento por categoria, omite ícone e nome da categoria. */
  compact?: boolean
}>()

defineEmits<{
  duplicate: []
  edit: []
  remove: []
}>()
</script>

<template>
  <div class="card-entry" :class="{ 'card-entry--compact': compact }">
    <div v-if="!compact" class="card-entry__icon" aria-hidden="true">
      <CategoriesCategoryIconChip
        v-if="entry.categoryIcon && entry.categoryColor"
        :icon="entry.categoryIcon"
        :color="entry.categoryColor"
      />
      <span v-else class="card-entry__fallback">
        <Receipt />
      </span>
    </div>
    <div class="card-entry__main">
      <div class="card-entry__title">
        <p>{{ entry.description }}</p>
        <span
          v-if="
            entry.recurrence === 'installment' &&
            entry.installmentIndex &&
            entry.installmentCount
          "
          class="card-entry__installment"
          :title="`Parcela ${entry.installmentIndex} de ${entry.installmentCount}`"
        >
          <Layers aria-hidden="true" />
          {{ entry.installmentIndex }}/{{ entry.installmentCount }}
        </span>
        <span
          v-else-if="entry.recurrence === 'fixed'"
          class="card-entry__installment card-entry__installment--fixed"
          title="Despesa fixa"
        >
          <Layers aria-hidden="true" />
          Fixa
        </span>
      </div>
      <span>
        {{ formatDateBr(entry.date) }}
        <template v-if="!compact && entry.categoryName">
          · {{ entry.categoryName }}
        </template>
      </span>
      <small v-if="entry.statementName">
        {{ entry.statementName }}
      </small>
      <small v-if="entry.notes">{{ entry.notes }}</small>
    </div>
    <strong class="card-entry__amount">
      -
      <UiMoney :value="entry.amount" />
    </strong>
    <div class="card-entry__actions">
      <button
        type="button"
        aria-label="Duplicar despesa"
        title="Duplicar despesa"
        @click="$emit('duplicate')"
      >
        <Copy aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Editar despesa"
        title="Editar despesa"
        @click="$emit('edit')"
      >
        <Pencil aria-hidden="true" />
      </button>
      <button
        type="button"
        class="card-entry__delete"
        aria-label="Excluir despesa"
        title="Excluir despesa"
        @click="$emit('remove')"
      >
        <Trash2 aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.card-entry {
  display: flex;
  padding: var(--space-4) var(--space-5);
  align-items: center;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.card-entry--compact {
  padding-left: calc(var(--space-5) + 2.25rem + var(--space-3));
}

.card-entry__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.card-entry__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.card-entry__fallback svg {
  width: 1rem;
  height: 1rem;
}

.card-entry__main {
  min-width: 0;
  flex: 1;
}

.card-entry__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.5rem;
}

.card-entry__main p {
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  line-height: 1.3;
}

.card-entry__installment {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-size: 0.6875rem;
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.card-entry__installment svg {
  width: 0.75rem;
  height: 0.75rem;
  flex-shrink: 0;
}

.card-entry__installment--fixed {
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.card-entry__main > span,
.card-entry__main small {
  display: block;
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-entry__amount {
  color: var(--color-negative-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.card-entry__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.card-entry:hover .card-entry__actions,
.card-entry:focus-within .card-entry__actions {
  opacity: 1;
}

.card-entry__actions button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.card-entry__actions button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.card-entry__actions .card-entry__delete:hover {
  border-color: var(--color-negative);
  color: var(--color-negative-ink);
}

.card-entry__actions svg {
  width: 0.875rem;
  height: 0.875rem;
}
</style>
