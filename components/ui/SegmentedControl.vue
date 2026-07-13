<script setup lang="ts" generic="T extends string">
defineProps<{
  options: { value: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="ui-segmented" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ui-segmented__option"
      :class="{ 'ui-segmented__option--active': model === option.value }"
      :aria-pressed="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-segmented {
  display: inline-flex;
  padding: 0.1875rem;
  gap: 0.125rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.ui-segmented__option {
  min-height: 1.875rem;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: calc(var(--radius-md) - 0.1875rem);
  background: transparent;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.ui-segmented__option:hover {
  color: var(--color-ink);
}

.ui-segmented__option--active {
  background: var(--color-surface);
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
  box-shadow: var(--shadow-xs);
}
</style>
