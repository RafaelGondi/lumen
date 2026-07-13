<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info'
    dot?: boolean
  }>(),
  {
    tone: 'neutral',
    dot: false,
  },
)
</script>

<template>
  <span class="ui-badge" :class="`ui-badge--${tone}`">
    <span v-if="dot" class="ui-badge__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 1.25rem;
  color: var(--color-ink-secondary);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.ui-badge__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: var(--badge-dot, var(--color-ink-muted));
}

.ui-badge--neutral {
  --badge-dot: var(--color-ink-muted);
}

.ui-badge--positive {
  --badge-dot: var(--color-positive);
}

.ui-badge--negative {
  --badge-dot: var(--color-negative);
  color: var(--color-negative-ink);
}

.ui-badge--warning {
  --badge-dot: var(--color-warning);
}

.ui-badge--info {
  --badge-dot: var(--color-info);
}
</style>
