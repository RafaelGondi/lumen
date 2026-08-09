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
  return Math.round((props.card.usedAmount / props.card.creditLimit) * 100)
})

const barPercent = computed(() => Math.min(100, Math.max(0, usedPercent.value)))

const overLimit = computed(
  () => props.card.usedAmount > props.card.creditLimit,
)

const level = computed(() => {
  if (overLimit.value) return 'over'
  if (usedPercent.value >= 80) return 'warn'
  return 'ok'
})

const headline = computed(() => roundMoney(props.card.usedAmount))

const secondaryAmount = computed(() =>
  overLimit.value
    ? roundMoney(props.card.usedAmount - props.card.creditLimit)
    : roundMoney(props.card.creditLimit - props.card.usedAmount),
)

const cardSurface = computed(() => legibleSurface(props.card.color))

const cardStyle = computed(() => ({
  '--credit-card-accent': cardSurface.value,
  '--credit-card-accent-ink': inkOn(cardSurface.value),
}))
</script>

<template>
  <NuxtLink
    :to="'/cartoes/' + card.id"
    class="credit-card"
    :class="'credit-card--' + level"
    :style="cardStyle"
  >
    <header class="credit-card__hero">
      <div class="credit-card__hero-top">
        <div class="credit-card__hero-main">
          <AccountsBankMark
            :name="card.bankName"
            :color="card.color"
            :bank-key="card.bankKey"
            size="lg"
          />

          <div class="credit-card__identity">
            <p class="credit-card__bank">{{ card.bankName }}</p>
            <p class="credit-card__name">{{ card.name }}</p>
          </div>
        </div>

        <div class="credit-card__hero-side">
          <p v-if="card.lastFour" class="credit-card__digits">
            <span aria-hidden="true">••••</span>
            {{ card.lastFour }}
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

      <div class="credit-card__dates">
        <CalendarDays aria-hidden="true" />
        <span>Fecha dia <strong>{{ card.closingDay }}</strong></span>
        <span class="credit-card__separator" aria-hidden="true" />
        <span>Vence dia <strong>{{ card.dueDay }}</strong></span>
      </div>
    </header>

    <div class="credit-card__body">
      <div class="credit-card__metric">
        <div>
          <p class="credit-card__metric-label">
            Limite utilizado
          </p>
          <p class="credit-card__metric-value">
            <UiMoney :value="headline" />
          </p>
        </div>

        <span class="credit-card__status">
          {{ usedPercent }}% utilizado
        </span>
      </div>

      <div
        class="credit-card__progress"
        role="progressbar"
        aria-label="Percentual do limite utilizado"
        aria-valuemin="0"
        :aria-valuemax="Math.max(100, usedPercent)"
        :aria-valuenow="usedPercent"
      >
        <span :style="{ width: barPercent + '%' }" />
      </div>

      <div class="credit-card__usage">
        <p>
          <span>{{ overLimit ? 'Excesso' : 'Disponível' }}</span>
          <strong><UiMoney :value="secondaryAmount" /></strong>
        </p>
        <span class="credit-card__usage-separator" aria-hidden="true" />
        <p>
          <span>Limite</span>
          <strong><UiMoney :value="card.creditLimit" /></strong>
        </p>
      </div>
    </div>

  </NuxtLink>
</template>

<style scoped>
.credit-card {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 10.75rem;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  background: var(--color-surface);
  color: var(--color-ink);
  --credit-card-positive: color-mix(in srgb, var(--color-positive), white 30%);
  --credit-card-positive-soft: color-mix(in srgb, var(--color-positive-soft), white 28%);
  --credit-card-positive-ink: color-mix(in srgb, var(--color-positive-ink), white 16%);
  --credit-card-negative: color-mix(in srgb, var(--color-negative), white 24%);
  --credit-card-negative-soft: color-mix(in srgb, var(--color-negative-soft), white 20%);
  --credit-card-negative-ink: color-mix(in srgb, var(--color-negative-ink), white 12%);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.credit-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: 0 0.75rem 1.5rem color-mix(in srgb, var(--color-ink), transparent 94%);
}

.credit-card:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.credit-card__hero {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 5.35rem;
  padding: var(--space-3) var(--space-5);
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-3);
  background: linear-gradient(
    135deg,
    var(--credit-card-accent) 0%,
    color-mix(in srgb, var(--credit-card-accent), black 16%) 100%
  );
  color: var(--credit-card-accent-ink);
}

.credit-card__hero-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.credit-card__hero::after {
  position: absolute;
  right: -18%;
  bottom: -52%;
  width: 54%;
  height: 96%;
  border: 1px solid color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 82%
  );
  border-radius: 999px;
  content: "";
  opacity: 0.32;
  transform: rotate(-14deg);
}

.credit-card__hero-main,
.credit-card__hero-side {
  position: relative;
  z-index: 1;
}

.credit-card__hero-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-3);
}

.credit-card__hero-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
}

.credit-card__hero :deep(.bank-mark) {
  flex-shrink: 0;
  box-shadow: 0 0 0 1px color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 82%
  );
}

.credit-card__identity {
  min-width: 0;
  flex: 1;
}

.credit-card__name {
  overflow: hidden;
  margin-top: 0.1rem;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit-card__bank {
  overflow: hidden;
  color: color-mix(in srgb, var(--credit-card-accent-ink), transparent 22%);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit-card__digits {
  display: inline-flex;
  padding: 0.35rem 0.55rem;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 78%
  );
  border-radius: var(--radius-sm);
  background: color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 90%
  );
  color: var(--credit-card-accent-ink);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.credit-card__digits span {
  letter-spacing: 0.08em;
}

.credit-card__body {
  display: flex;
  padding: var(--space-4) var(--space-5);
  flex: 1;
  flex-direction: column;
}

.credit-card__metric {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.credit-card__metric-label {
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
}

.credit-card__metric-value {
  margin-top: 0.2rem;
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  letter-spacing: 0;
}

.credit-card__status {
  display: inline-flex;
  padding: 0.35rem 0.55rem;
  align-items: center;
  border-radius: var(--radius-sm);
  background: var(--credit-card-positive-soft);
  color: var(--credit-card-positive-ink);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.credit-card--warn .credit-card__status {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.credit-card--over .credit-card__status {
  background: var(--credit-card-negative-soft);
  color: var(--credit-card-negative-ink);
}

.credit-card--over .credit-card__metric-label,
.credit-card--over .credit-card__metric-value {
  color: var(--credit-card-negative-ink);
}

.credit-card__progress {
  overflow: hidden;
  height: 0.45rem;
  margin-top: var(--space-4);
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.credit-card__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--credit-card-positive);
}

.credit-card--warn .credit-card__progress span {
  background: var(--color-warning);
}

.credit-card--over .credit-card__progress span {
  background: var(--credit-card-negative);
}

.credit-card__usage {
  display: flex;
  margin-top: var(--space-3);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.credit-card__usage p {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--space-1);
}

.credit-card__usage span {
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
}

.credit-card__usage strong {
  overflow: hidden;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.credit-card__usage-separator {
  width: 0.2rem;
  height: 0.2rem;
  flex: 0 0 auto;
  border-radius: var(--radius-round);
  background: var(--color-border-strong);
}
.credit-card__dates {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
  color: color-mix(in srgb, var(--credit-card-accent-ink), transparent 22%);
  font-size: var(--text-2xs);
  white-space: nowrap;
}

.credit-card__dates svg {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
  color: currentColor;
}

.credit-card__dates strong {
  color: var(--credit-card-accent-ink);
  font-weight: var(--weight-semibold);
}

.credit-card__separator {
  width: 0.2rem;
  height: 0.2rem;
  flex: 0 0 auto;
  border-radius: var(--radius-round);
  background: color-mix(in srgb, var(--credit-card-accent-ink), transparent 68%);
}
.credit-card__actions {
  display: flex;
  gap: var(--space-1);
  padding: 0.2rem;
  border: 1px solid color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 80%
  );
  border-radius: var(--radius-sm);
  background: color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 90%
  );
  opacity: 0;
  transform: translateY(-0.2rem);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.credit-card:hover .credit-card__actions,
.credit-card:focus-within .credit-card__actions {
  opacity: 1;
  transform: translateY(0);
}

.credit-card__actions button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--credit-card-accent-ink);
  cursor: pointer;
}

.credit-card__actions button:hover {
  background: color-mix(
    in srgb,
    var(--credit-card-accent-ink),
    transparent 84%
  );
  color: var(--credit-card-accent-ink);
}

.credit-card__actions .credit-card__delete:hover {
  background: var(--credit-card-negative-soft);
  color: var(--credit-card-negative-ink);
}

.credit-card__actions svg {
  width: 0.85rem;
  height: 0.85rem;
}

@media (hover: none), (max-width: 768px) {
  .credit-card__actions {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 400px) {
  .credit-card__hero,
  .credit-card__body {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }

  .credit-card__hero {
    min-height: 7rem;
  }

  .credit-card__metric {
    flex-direction: column;
  }

  .credit-card__dates {
    flex-wrap: wrap;
    white-space: normal;
  }

  .credit-card__usage {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
</style>
