<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'

defineProps<{
  label: string
  canGoPrevious: boolean
  canGoNext: boolean
  isCurrent?: boolean
}>()

defineEmits<{
  previous: []
  next: []
  current: []
}>()
</script>

<template>
  <div class="month-switcher" aria-label="Navegação por mês">
    <button
      type="button"
      aria-label="Mês anterior"
      :disabled="!canGoPrevious"
      @click="$emit('previous')"
    >
      <ChevronLeft aria-hidden="true" />
    </button>
    <div class="month-switcher__label" aria-live="polite">
      <CalendarDays aria-hidden="true" />
      <span>{{ label }}</span>
    </div>
    <button
      type="button"
      aria-label="Próximo mês"
      :disabled="!canGoNext"
      @click="$emit('next')"
    >
      <ChevronRight aria-hidden="true" />
    </button>
    <button
      type="button"
      class="month-switcher__today"
      aria-label="Voltar ao mês atual"
      title="Voltar ao mês atual"
      :disabled="isCurrent"
      @click="$emit('current')"
    >
      Hoje
    </button>
  </div>
</template>

<style scoped>
.month-switcher {
  display: inline-grid;
  grid-template-columns: 2.5rem minmax(9rem, auto) 2.5rem auto;
  min-height: 2.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

button {
  display: grid;
  padding: 0;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

button:nth-child(1) {
  border-right: 1px solid var(--color-border);
}

button:nth-child(3) {
  border-left: 1px solid var(--color-border);
}

button:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-brand);
}

button:disabled {
  color: var(--color-ink-muted);
  cursor: not-allowed;
  opacity: 0.4;
}

button svg,
.month-switcher__label svg {
  width: 1rem;
  height: 1rem;
}

.month-switcher__label {
  display: flex;
  padding: 0 var(--space-4);
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.month-switcher__label svg {
  color: var(--color-ink-muted);
}

.month-switcher__today {
  padding: 0 var(--space-3);
  border-left: 1px solid var(--color-border);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.01em;
}
</style>
