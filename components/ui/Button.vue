<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
  },
)
</script>

<template>
  <button
    :type="type"
    class="ui-button"
    :class="[`ui-button--${variant}`, `ui-button--${size}`]"
    :disabled="disabled"
  >
    <span v-if="$slots.leading" class="ui-button__icon" aria-hidden="true">
      <slot name="leading" />
    </span>
    <slot />
    <span v-if="$slots.trailing" class="ui-button__icon" aria-hidden="true">
      <slot name="trailing" />
    </span>
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.ui-button:active:not(:disabled) {
  transform: translateY(1px);
}

.ui-button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.ui-button--md {
  min-height: 2.5rem;
  padding: 0 var(--space-4);
}

.ui-button--sm {
  min-height: 2rem;
  padding: 0 var(--space-3);
}

.ui-button--primary {
  background: var(--color-brand);
  color: var(--color-white);
}

.ui-button--primary:hover:not(:disabled) {
  background: var(--color-brand-hover);
}

.ui-button--secondary {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-xs);
}

.ui-button--secondary:hover:not(:disabled) {
  border-color: var(--color-brand);
  color: var(--color-brand);
}

.ui-button--ghost {
  background: transparent;
  color: var(--color-ink-secondary);
}

.ui-button--ghost:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.ui-button__icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  pointer-events: none;
}

.ui-button__icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
