<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true">
      <slot name="icon" />
    </div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  min-height: 17rem;
  padding: var(--space-8);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.empty-state__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: var(--space-4);
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
}

.empty-state__icon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

h3 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

p {
  max-width: 20rem;
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.empty-state__action {
  margin-top: var(--space-5);
}
</style>
