<script setup lang="ts">
import { ChevronDown, ReceiptText, X } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    label?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    label: 'Nome na fatura',
    placeholder: 'Ex: AMZN*MKTP BR...',
    disabled: false,
  },
)

const model = defineModel<string>({ required: true })

const open = ref(false)
const suggestions = ref<string[]>([])
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const fieldId = useId()

const filtered = computed(() => {
  const term = model.value.trim().toLowerCase()
  const items = suggestions.value
  if (!term) return items.slice(0, 12)
  return items
    .filter((name) => name.toLowerCase().includes(term))
    .slice(0, 12)
})

const exactMatch = computed(() => {
  const term = model.value.trim().toLowerCase()
  if (!term) return false
  return suggestions.value.some((name) => name.toLowerCase() === term)
})

const showMenu = computed(
  () => open.value && !props.disabled && filtered.value.length > 0,
)

async function loadSuggestions() {
  try {
    suggestions.value = await $fetch<string[]>('/api/statement-names')
  } catch {
    suggestions.value = []
  }
}

function openDropdown() {
  if (props.disabled) return
  open.value = true
  void loadSuggestions()
  nextTick(() => inputRef.value?.focus())
}

function closeDropdown() {
  open.value = false
}

function selectName(name: string) {
  model.value = name
  closeDropdown()
}

function clearName() {
  model.value = ''
  openDropdown()
}

function onDocumentPointerDown(event: PointerEvent) {
  const root = rootRef.value
  if (!root || !open.value) return
  if (event.target instanceof Node && !root.contains(event.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <div ref="rootRef" class="statement-field">
    <label v-if="label" :for="fieldId" class="statement-field__label">
      {{ label }}
    </label>

    <div
      class="statement-field__control"
      :class="{ 'is-open': open, 'has-value': Boolean(model.trim()) }"
    >
      <ReceiptText class="statement-field__icon" aria-hidden="true" />
      <input
        :id="fieldId"
        ref="inputRef"
        v-model="model"
        type="text"
        autocomplete="off"
        :placeholder="placeholder"
        :disabled="disabled"
        aria-autocomplete="list"
        :aria-expanded="showMenu"
        aria-haspopup="listbox"
        @focus="openDropdown"
        @click="openDropdown"
        @keydown.escape.prevent="closeDropdown"
        @keydown.enter.prevent="closeDropdown"
      />
      <button
        v-if="model.trim()"
        type="button"
        class="statement-field__clear"
        aria-label="Limpar nome na fatura"
        :disabled="disabled"
        @click="clearName"
      >
        <X aria-hidden="true" />
      </button>
      <ChevronDown
        class="statement-field__chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
      />
    </div>

    <div
      v-if="showMenu"
      class="statement-field__menu"
      role="listbox"
      :aria-label="label"
    >
      <p v-if="!exactMatch && model.trim()" class="statement-field__hint">
        Novo nome — será reutilizável depois de salvar
      </p>
      <button
        v-for="name in filtered"
        :key="name"
        type="button"
        class="statement-field__option"
        role="option"
        :aria-selected="name === model.trim()"
        @click="selectName(name)"
      >
        {{ name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.statement-field {
  position: relative;
  display: grid;
  gap: var(--space-2);
}

.statement-field__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.statement-field__control {
  display: flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.statement-field__control.is-open {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.statement-field__control input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: var(--text-sm);
}

.statement-field__icon,
.statement-field__chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.statement-field__chevron {
  transition: transform var(--transition-fast);
}

.statement-field__chevron.is-open {
  transform: rotate(180deg);
}

.statement-field__clear {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.statement-field__clear:hover {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.statement-field__clear :deep(svg) {
  width: 0.9rem;
  height: 0.9rem;
}

.statement-field__menu {
  position: absolute;
  z-index: 8;
  top: calc(100% + 0.35rem);
  right: 0;
  left: 0;
  display: grid;
  max-height: 14rem;
  padding: var(--space-1);
  gap: 0.125rem;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.statement-field__hint {
  padding: var(--space-2) var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.statement-field__option {
  display: block;
  width: 100%;
  min-height: 2.25rem;
  padding: var(--space-2) var(--space-3);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.statement-field__option:hover,
.statement-field__option[aria-selected='true'] {
  background: var(--color-surface-subtle);
}
</style>
