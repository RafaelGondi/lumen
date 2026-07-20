<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const props = defineProps<{
  label: string
  year: number
  month: number
  canGoPrevious: boolean
  canGoNext: boolean
  isCurrent?: boolean
  /** YYYY-MM — meses posteriores ficam desabilitados no seletor. */
  maxMonthKey?: string
}>()

const emit = defineEmits<{
  previous: []
  next: []
  current: []
  select: [{ year: number; month: number }]
}>()

const rootRef = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const pickerYear = ref(props.year)

const today = computed(() => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
})

watch(
  () => props.year,
  (value) => {
    if (!pickerOpen.value) pickerYear.value = value
  },
)

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function isMonthDisabled(year: number, month: number) {
  if (!props.maxMonthKey) return false
  return monthKey(year, month) > props.maxMonthKey
}

function openPicker() {
  pickerYear.value = props.year
  pickerOpen.value = true
}

function closePicker() {
  pickerOpen.value = false
}

function togglePicker() {
  if (pickerOpen.value) closePicker()
  else openPicker()
}

function shiftPickerYear(delta: number) {
  pickerYear.value += delta
}

function chooseMonth(month: number) {
  if (isMonthDisabled(pickerYear.value, month)) return
  emit('select', { year: pickerYear.value, month })
  closePicker()
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!pickerOpen.value) return
  const target = event.target as Node | null
  if (target && rootRef.value?.contains(target)) return
  closePicker()
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (pickerOpen.value && event.key === 'Escape') {
    event.preventDefault()
    closePicker()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>

<template>
  <div ref="rootRef" class="month-switcher-wrap">
    <div class="month-switcher" aria-label="Navegação por mês">
      <button
        type="button"
        class="month-switcher__nav month-switcher__nav--prev"
        aria-label="Mês anterior"
        :disabled="!canGoPrevious"
        @click="$emit('previous')"
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <button
        type="button"
        class="month-switcher__label"
        :class="{ 'is-open': pickerOpen }"
        aria-live="polite"
        aria-haspopup="dialog"
        :aria-expanded="pickerOpen"
        aria-label="Escolher mês e ano"
        @click="togglePicker"
      >
        <CalendarDays aria-hidden="true" />
        <span>{{ label }}</span>
      </button>

      <button
        type="button"
        class="month-switcher__nav month-switcher__nav--next"
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

    <div
      v-if="pickerOpen"
      class="month-switcher__picker"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar mês"
    >
      <div class="month-switcher__picker-year">
        <button
          type="button"
          aria-label="Ano anterior"
          @click="shiftPickerYear(-1)"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <strong>{{ pickerYear }}</strong>
        <button
          type="button"
          aria-label="Próximo ano"
          @click="shiftPickerYear(1)"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div class="month-switcher__picker-grid">
        <button
          v-for="(name, index) in MONTH_NAMES"
          :key="name"
          type="button"
          class="month-switcher__picker-month"
          :class="{
            'is-selected':
              pickerYear === year &&
              index + 1 === month,
            'is-today':
              pickerYear === today.year &&
              index + 1 === today.month,
          }"
          :disabled="isMonthDisabled(pickerYear, index + 1)"
          @click="chooseMonth(index + 1)"
        >
          {{ name }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-switcher-wrap {
  position: relative;
  display: inline-flex;
}

.month-switcher {
  display: inline-grid;
  grid-template-columns: 2.5rem minmax(9rem, auto) 2.5rem minmax(3.25rem, auto);
  align-items: stretch;
  min-height: 2.5rem;
  overflow: hidden;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.month-switcher__nav {
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

.month-switcher__nav--prev {
  border-right: 1px solid var(--color-border);
}

.month-switcher__nav--next {
  border-left: 1px solid var(--color-border);
}

.month-switcher__nav:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-brand);
}

.month-switcher__nav:disabled {
  color: var(--color-ink-muted);
  cursor: not-allowed;
  opacity: 0.4;
}

.month-switcher__nav svg,
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
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.month-switcher__label:hover,
.month-switcher__label.is-open {
  background: var(--color-surface-subtle);
  color: var(--color-brand);
}

.month-switcher__label svg {
  color: var(--color-ink-muted);
}

.month-switcher__today {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 3.25rem;
  padding: 0 var(--space-3);
  border: 0;
  border-left: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.month-switcher__today:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-brand);
}

.month-switcher__today:disabled {
  color: var(--color-ink-muted);
  cursor: not-allowed;
  opacity: 0.4;
}

.month-switcher__picker {
  position: absolute;
  z-index: 30;
  top: calc(100% + var(--space-2));
  right: 0;
  width: min(16rem, calc(100vw - 2rem));
  padding: var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.month-switcher__picker-year {
  display: grid;
  align-items: center;
  grid-template-columns: 2rem 1fr 2rem;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.month-switcher__picker-year strong {
  text-align: center;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.month-switcher__picker-year button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.month-switcher__picker-year button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-brand);
}

.month-switcher__picker-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.month-switcher__picker-month {
  padding: 0.45rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.month-switcher__picker-month:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-surface-subtle);
}

.month-switcher__picker-month.is-today:not(.is-selected) {
  border-color: var(--color-brand-soft);
  color: var(--color-brand);
}

.month-switcher__picker-month.is-selected {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-weight: var(--weight-semibold);
}

.month-switcher__picker-month:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .month-switcher {
    width: 100%;
    grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem minmax(3rem, auto);
  }

  .month-switcher-wrap {
    width: 100%;
  }

  .month-switcher__label {
    padding: 0 var(--space-2);
    min-width: 0;
  }

  .month-switcher__label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .month-switcher__label svg {
    display: none;
  }

  .month-switcher__today {
    padding: 0 var(--space-2);
  }

  .month-switcher__picker {
    left: 0;
    right: 0;
    width: auto;
  }
}
</style>
