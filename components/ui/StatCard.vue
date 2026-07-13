<script setup lang="ts">
import type { FinancialStat } from '~/types/finance'

defineProps<{
  stat: FinancialStat
}>()

const { formatCurrency } = useCurrency()
</script>

<template>
  <UiCard class="stat-card" :class="`stat-card--${stat.tone}`" padding="md">
    <div class="stat-card__header">
      <p>{{ stat.label }}</p>
      <span class="stat-card__icon" aria-hidden="true">
        <slot name="icon" />
      </span>
    </div>

    <p class="stat-card__value">
      <UiMoney :value="stat.value" />
    </p>
    <p class="stat-card__support">{{ stat.supportingText }}</p>

    <dl class="stat-card__breakdown">
      <div v-for="item in stat.breakdown" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd
          class="numeric"
          :class="item.tone ? `stat-card__detail--${item.tone}` : undefined"
        >
          {{ formatCurrency(item.value) }}
        </dd>
      </div>
    </dl>
  </UiCard>
</template>

<style scoped>
.stat-card {
  position: relative;
  min-height: 15.5rem;
  overflow: hidden;
}

.stat-card--positive {
  --stat-value-color: var(--color-positive-ink);
}

.stat-card--negative {
  --stat-value-color: var(--color-negative-ink);
}

.stat-card--featured {
  border-color: var(--color-nav);
  background: linear-gradient(180deg, #1a2740 0%, var(--color-nav) 62%);
  color: var(--color-white);
}

.stat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.stat-card__header p {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.stat-card__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.stat-card__icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.stat-card__value {
  margin-top: var(--space-5);
  color: var(--stat-value-color, var(--color-ink));
  font-size: clamp(1.5rem, 2.1vw, var(--text-2xl));
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
}

.stat-card__support {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.stat-card__breakdown {
  display: grid;
  padding-top: var(--space-4);
  margin: var(--space-5) 0 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.stat-card__breakdown div + div {
  padding-left: var(--space-3);
  border-left: 1px solid var(--color-border);
}

.stat-card__breakdown dt {
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-card__breakdown dd {
  margin: var(--space-2) 0 0;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.stat-card__detail--positive {
  color: var(--color-positive) !important;
}

.stat-card__detail--negative {
  color: var(--color-negative) !important;
}

.stat-card--featured .stat-card__header p,
.stat-card--featured .stat-card__support,
.stat-card--featured .stat-card__breakdown dt {
  color: #a4b2c8;
}

.stat-card--featured .stat-card__icon {
  background: rgb(255 255 255 / 8%);
  color: #b8cbe4;
}

.stat-card--featured .stat-card__value,
.stat-card--featured .stat-card__breakdown dd {
  color: var(--color-white);
}

.stat-card--featured .stat-card__breakdown,
.stat-card--featured .stat-card__breakdown div + div {
  border-color: rgb(255 255 255 / 12%);
}

.stat-card--featured .stat-card__detail--positive {
  color: #7fd6ac !important;
}
</style>
