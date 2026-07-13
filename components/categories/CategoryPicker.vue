<script setup lang="ts">
import { ChevronDown, Search, X } from '@lucide/vue'
import type { Category } from '~/types/category'

const props = withDefaults(
  defineProps<{
    categories: Category[]
    label?: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    label: 'Categoria',
    placeholder: 'Buscar categoria...',
    disabled: false,
  },
)

const model = defineModel<number | null>({ required: true })

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const fieldId = useId()

const selected = computed(
  () => props.categories.find((category) => category.id === model.value) ?? null,
)

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return props.categories
  return props.categories.filter((category) =>
    category.name.toLowerCase().includes(term),
  )
})

watch(model, (value) => {
  if (value !== null) query.value = ''
})

function openDropdown() {
  if (props.disabled) return
  open.value = true
  nextTick(() => inputRef.value?.focus())
}

function closeDropdown() {
  open.value = false
  query.value = ''
}

function selectCategory(category: Category) {
  model.value = category.id
  closeDropdown()
}

function clearCategory() {
  model.value = null
  query.value = ''
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
  <div ref="rootRef" class="category-picker">
    <label v-if="label" :for="fieldId" class="category-picker__label">
      {{ label }}
    </label>

    <button
      v-if="selected && !open"
      type="button"
      class="category-picker__tag"
      :disabled="disabled"
      :aria-label="`Categoria ${selected.name}. Clique para alterar.`"
      @click="openDropdown"
    >
      <CategoriesCategoryIconChip
        :icon="selected.icon"
        :color="selected.color"
        size="sm"
      />
      <span class="category-picker__name">{{ selected.name }}</span>
      <span
        class="category-picker__clear"
        role="button"
        tabindex="0"
        aria-label="Remover categoria"
        @click.stop="clearCategory"
        @keydown.enter.prevent="clearCategory"
        @keydown.space.prevent="clearCategory"
      >
        <X aria-hidden="true" />
      </span>
    </button>

    <div v-else class="category-picker__control">
      <Search class="category-picker__search-icon" aria-hidden="true" />
      <input
        :id="fieldId"
        ref="inputRef"
        v-model="query"
        type="search"
        autocomplete="off"
        :placeholder="placeholder"
        :disabled="disabled"
        aria-autocomplete="list"
        :aria-expanded="open"
        aria-haspopup="listbox"
        @focus="open = true"
        @click="open = true"
        @keydown.escape.prevent="closeDropdown"
      />
      <ChevronDown
        class="category-picker__chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
      />
    </div>

    <div
      v-if="open && !disabled"
      class="category-picker__menu"
      role="listbox"
      :aria-label="label"
    >
      <p v-if="!filtered.length" class="category-picker__empty">
        Nenhuma categoria encontrada.
      </p>
      <button
        v-for="category in filtered"
        :key="category.id"
        type="button"
        class="category-picker__option"
        role="option"
        :aria-selected="category.id === model"
        @click="selectCategory(category)"
      >
        <CategoriesCategoryIconChip
          :icon="category.icon"
          :color="category.color"
          size="sm"
        />
        <span>{{ category.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-picker {
  position: relative;
  display: grid;
  gap: var(--space-2);
}

.category-picker__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.category-picker__tag,
.category-picker__control {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.category-picker__tag {
  width: 100%;
  padding: 0 var(--space-2) 0 var(--space-3);
  color: var(--color-ink);
  font: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: left;
  cursor: pointer;
}

.category-picker__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-picker__clear {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--color-ink-muted);
}

.category-picker__clear:hover {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.category-picker__clear :deep(svg) {
  width: 0.95rem;
  height: 0.95rem;
}

.category-picker__control {
  padding: 0 var(--space-3);
}

.category-picker__control input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: var(--text-sm);
}

.category-picker__search-icon,
.category-picker__chevron {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.category-picker__chevron {
  transition: transform var(--transition-fast);
}

.category-picker__chevron.is-open {
  transform: rotate(180deg);
}

.category-picker__menu {
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

.category-picker__empty {
  padding: var(--space-3);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-picker__option {
  display: flex;
  width: 100%;
  min-height: 2.25rem;
  padding: var(--space-2) var(--space-3);
  align-items: center;
  gap: var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.category-picker__option:hover,
.category-picker__option[aria-selected='true'] {
  background: var(--color-surface-subtle);
}
</style>
