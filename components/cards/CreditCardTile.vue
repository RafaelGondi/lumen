<script setup lang="ts">
import { CalendarDays, Pencil, Trash2 } from '@lucide/vue'
import type { Card } from '~/types/card'
import { roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
}>()

defineEmits<{
  edit: []
  remove: []
}>()

const usedPercent = computed(() => {
  if (props.card.creditLimit <= 0) return 0
  return Math.min(
    100,
    Math.round((props.card.usedAmount / props.card.creditLimit) * 100),
  )
})

const available = computed(() =>
  roundMoney(Math.max(0, props.card.creditLimit - props.card.usedAmount)),
)
</script>

<template>
  <NuxtLink :to="`/cartoes/${card.id}`" class="credit-card">
    <div
      class="credit-card__face"
      :style="{
        background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}d9 100%)`,
      }"
    >
      <div class="credit-card__face-top">
        <div>
          <p class="credit-card__bank">{{ card.bankName }}</p>
          <p class="credit-card__name">{{ card.name }}</p>
        </div>
        <AccountsBankMark
          :name="card.bankName"
          :color="card.color"
          :bank-key="card.bankKey"
        />
      </div>
      <div class="credit-card__face-bottom">
        <div>
          <p class="credit-card__meta-label">Limite</p>
          <p class="credit-card__meta-value">
            <UiMoney :value="card.creditLimit" />
          </p>
        </div>
        <div class="credit-card__due">
          <p class="credit-card__meta-label">Vencimento</p>
          <p class="credit-card__meta-value">Dia {{ card.dueDay }}</p>
        </div>
      </div>
    </div>

    <div class="credit-card__body">
      <div class="credit-card__usage-row">
        <span>Limite comprometido</span>
        <strong>
          <UiMoney :value="card.usedAmount" />
          /
          <UiMoney :value="card.creditLimit" />
        </strong>
      </div>
      <div class="credit-card__bar" aria-hidden="true">
        <span :style="{ width: `${usedPercent}%` }" />
      </div>
      <p class="credit-card__usage-label">{{ usedPercent }}% utilizado</p>
      <p class="credit-card__available">
        Disponível
        <UiMoney :value="available" />
      </p>

      <div class="credit-card__footer">
        <p>
          <CalendarDays aria-hidden="true" />
          Fechamento: dia {{ card.closingDay }}
        </p>
        <div class="credit-card__actions">
          <button
            type="button"
            aria-label="Editar cartão"
            @click.prevent.stop="$emit('edit')"
          >
            <Pencil aria-hidden="true" />
          </button>
          <button
            type="button"
            class="credit-card__delete"
            aria-label="Excluir cartão"
            @click.prevent.stop="$emit('remove')"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.credit-card {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.credit-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}

.credit-card__face {
  display: flex;
  min-height: 8.5rem;
  padding: var(--space-5);
  flex-direction: column;
  justify-content: space-between;
  color: white;
}

.credit-card__face-top,
.credit-card__face-bottom,
.credit-card__footer,
.credit-card__usage-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.credit-card__bank {
  font-size: var(--text-xs);
  opacity: 0.85;
}

.credit-card__name {
  margin-top: var(--space-1);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.credit-card__meta-label {
  font-size: 0.6875rem;
  opacity: 0.8;
}

.credit-card__meta-value {
  margin-top: 0.15rem;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.credit-card__due {
  text-align: right;
}

.credit-card__body {
  display: flex;
  padding: var(--space-4) var(--space-5) var(--space-5);
  flex-direction: column;
  gap: var(--space-2);
}

.credit-card__usage-row {
  align-items: center;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.credit-card__usage-row strong {
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.credit-card__bar {
  overflow: hidden;
  height: 0.35rem;
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.credit-card__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}

.credit-card__usage-label,
.credit-card__available {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.credit-card__available {
  display: flex;
  gap: var(--space-1);
}

.credit-card__footer {
  margin-top: var(--space-2);
  align-items: center;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.credit-card__footer p {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.credit-card__footer svg {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--color-ink-muted);
}

.credit-card__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.credit-card:hover .credit-card__actions,
.credit-card:focus-within .credit-card__actions {
  opacity: 1;
}

@media (hover: none), (max-width: 768px) {
  .credit-card__actions {
    opacity: 1;
  }
}

.credit-card__actions button {
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

.credit-card__actions button:hover {
  color: var(--color-ink);
  border-color: var(--color-border-strong);
}

.credit-card__actions .credit-card__delete:hover {
  color: var(--color-negative);
  border-color: var(--color-negative);
}

.credit-card__actions svg {
  width: 0.85rem;
  height: 0.85rem;
}
</style>
