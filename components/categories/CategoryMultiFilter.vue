<script setup lang="ts">
import { Check, ChevronDown, ListFilter, Search, X } from '@lucide/vue'

type FilterOption = {
  id: number
  name: string
  color: string
  icon: string
}

const props = defineProps<{
  options: FilterOption[]
  singular: string
  plural: string
  scopeOptions: Array<{
    value: 'category' | 'supercategory'
    label: string
  }>
}>()

const model = defineModel<number[]>({ required: true })
const scope = defineModel<'category' | 'supercategory'>('scope', {
  required: true,
})

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

const selectedIds = computed(() => new Set(model.value))
const selectedOptions = computed(() =>
  props.options.filter((option) => selectedIds.value.has(option.id)),
)
const filteredOptions = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('pt-BR')
  if (!term) return props.options
  return props.options.filter((option) =>
    option.name.toLocaleLowerCase('pt-BR').includes(term),
  )
})

watch(scope, () => {
  query.value = ''
})

function toggleMenu() {
  open.value = !open.value
  if (open.value) nextTick(() => searchRef.value?.focus())
}

function closeMenu() {
  open.value = false
  query.value = ''
}

function toggleOption(optionId: number) {
  model.value = selectedIds.value.has(optionId)
    ? model.value.filter((id) => id !== optionId)
    : [...model.value, optionId]
}

function clearSelection() {
  model.value = []
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !rootRef.value) return
  if (event.target instanceof Node && !rootRef.value.contains(event.target)) {
    closeMenu()
  }
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() =>
  document.removeEventListener('pointerdown', onDocumentPointerDown),
)
</script>

<template>
  <div ref="rootRef" class="category-filter">
    <div class="category-filter__actions">
      <button
        type="button"
        class="category-filter__trigger"
        :class="{ 'is-active': model.length > 0 }"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-label="
          model.length
            ? `Filtrar por ${singular}, ${model.length} selecionada${model.length === 1 ? '' : 's'}`
            : `Filtrar por ${singular}`
        "
        @click="toggleMenu"
      >
        <ListFilter aria-hidden="true" />
        <span>{{ model.length ? plural : `Filtrar por ${singular}` }}</span>
        <strong v-if="model.length" aria-hidden="true">
          {{ model.length }}
        </strong>
        <ChevronDown
          class="category-filter__chevron"
          :class="{ 'is-open': open }"
          aria-hidden="true"
        />
      </button>

      <button
        v-if="model.length"
        type="button"
        class="category-filter__clear"
        @click="clearSelection"
      >
        Limpar
      </button>
    </div>

    <div
      v-if="open"
      class="category-filter__menu"
      role="listbox"
      :aria-label="`Filtrar por ${plural.toLocaleLowerCase('pt-BR')}`"
      aria-multiselectable="true"
      @keydown.escape.prevent="closeMenu"
    >
      <div class="category-filter__scope">
        <UiSegmentedControl v-model="scope" :options="scopeOptions" />
      </div>

      <label class="category-filter__search">
        <Search aria-hidden="true" />
        <input
          ref="searchRef"
          v-model="query"
          type="search"
          autocomplete="off"
          :placeholder="`Buscar ${singular}...`"
          :aria-label="`Buscar ${singular}`"
        />
      </label>

      <div class="category-filter__menu-meta">
        <span>
          {{
            model.length
              ? `${model.length} selecionada${model.length === 1 ? '' : 's'}`
              : 'Selecione uma ou mais'
          }}
        </span>
        <button v-if="model.length" type="button" @click="clearSelection">
          Limpar seleção
        </button>
      </div>

      <div class="category-filter__options">
        <p v-if="!filteredOptions.length" class="category-filter__empty">
          Nenhuma {{ singular }} encontrada.
        </p>
        <button
          v-for="option in filteredOptions"
          v-else
          :key="option.id"
          type="button"
          class="category-filter__option"
          role="option"
          :aria-selected="selectedIds.has(option.id)"
          @click="toggleOption(option.id)"
        >
          <CategoriesCategoryIconChip
            :icon="option.icon"
            :color="option.color"
            size="sm"
          />
          <span>{{ option.name }}</span>
          <span
            class="category-filter__check"
            :class="{ 'is-checked': selectedIds.has(option.id) }"
            aria-hidden="true"
          >
            <Check v-if="selectedIds.has(option.id)" />
          </span>
        </button>
      </div>
    </div>

    <div v-if="selectedOptions.length" class="category-filter__selected">
      <button
        v-for="option in selectedOptions"
        :key="option.id"
        type="button"
        :aria-label="`Remover filtro ${option.name}`"
        @click="toggleOption(option.id)"
      >
        <CategoriesCategoryIconChip
          :icon="option.icon"
          :color="option.color"
          size="sm"
        />
        <span>{{ option.name }}</span>
        <X aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-filter {
  position: relative;
  display: grid;
  gap: var(--space-2);
  width: auto;
}

.category-filter__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.category-filter__trigger {
  display: inline-flex;
  min-height: 2.25rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.category-filter__trigger:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.category-filter__trigger.is-active {
  border-color: color-mix(in srgb, var(--color-brand) 45%, var(--color-border));
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.category-filter__trigger > svg {
  width: 1rem;
  height: 1rem;
}

.category-filter__trigger strong {
  display: grid;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.3rem;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--color-brand);
  color: var(--color-white);
  font-size: 0.625rem;
  line-height: 1;
}

.category-filter__chevron {
  transition: transform var(--transition-fast);
}

.category-filter__chevron.is-open {
  transform: rotate(180deg);
}

.category-filter__clear,
.category-filter__menu-meta button {
  border: 0;
  background: transparent;
  color: var(--color-brand-ink);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.category-filter__menu {
  position: absolute;
  z-index: 12;
  top: 2.65rem;
  left: 0;
  display: grid;
  width: min(22rem, calc(100vw - 3rem));
  padding: var(--space-2);
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.category-filter__search {
  display: flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.category-filter__scope :deep(.ui-segmented) {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.category-filter__search svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.category-filter__search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: var(--text-sm);
}

.category-filter__menu-meta {
  display: flex;
  padding: 0 var(--space-2);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.category-filter__options {
  display: grid;
  max-height: 17rem;
  gap: 0.125rem;
  overflow-y: auto;
}

.category-filter__option {
  display: grid;
  min-height: 2.5rem;
  padding: var(--space-2);
  grid-template-columns: auto minmax(0, 1fr) auto;
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

.category-filter__option:hover,
.category-filter__option[aria-selected='true'] {
  background: var(--color-surface-subtle);
}

.category-filter__check {
  display: grid;
  width: 1.15rem;
  height: 1.15rem;
  place-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: 0.3rem;
}

.category-filter__check.is-checked {
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-white);
}

.category-filter__check svg {
  width: 0.75rem;
  height: 0.75rem;
  stroke-width: 2.5;
}

.category-filter__empty {
  padding: var(--space-4);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  text-align: center;
}

.category-filter__selected {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.category-filter__selected button {
  display: inline-flex;
  min-height: 1.75rem;
  padding: 0 var(--space-2) 0 0.25rem;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font: inherit;
  font-size: var(--text-xs);
  cursor: pointer;
}

.category-filter__selected button:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.category-filter__selected button > svg {
  width: 0.8rem;
  height: 0.8rem;
  color: var(--color-ink-muted);
}

@media (max-width: 720px) {
  .category-filter,
  .category-filter__actions {
    width: 100%;
  }

  .category-filter__trigger {
    width: auto;
    min-width: 0;
    flex: 1;
    justify-content: flex-start;
  }

  .category-filter__trigger .category-filter__chevron {
    margin-left: auto;
  }

  .category-filter__clear {
    width: auto;
  }

  .category-filter__menu {
    right: 0;
    width: 100%;
  }
}
</style>
