<script setup lang="ts">
import { FolderTree, Plus, Search, Tags } from '@lucide/vue'
import type { Category, CategoryType, Supercategory } from '~/types/category'

type TypeFilter = 'all' | CategoryType

const activeTab = ref<'categories' | 'supercategories'>('categories')
const search = ref('')
const typeFilter = ref<TypeFilter>('all')

const {
  data: categories,
  pending: categoriesPending,
  refresh: refreshCategories,
} = await useFetch<Category[]>('/api/categories', { default: () => [] })

const {
  data: supercategories,
  pending: supercategoriesPending,
  refresh: refreshSupercategories,
} = await useFetch<Supercategory[]>('/api/supercategories', {
  default: () => [],
})

const tabs = computed(() => [
  { id: 'categories', label: 'Categorias', count: categories.value.length },
  {
    id: 'supercategories',
    label: 'Supercategorias',
    count: supercategories.value.length,
  },
])

const typeFilterOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'transfer', label: 'Transferências' },
]

/** Filtro à parte do tipo: são dimensões independentes e combinam. */
const onlyOrphans = ref(false)

function matchesType(category: Category) {
  return typeFilter.value === 'all' || category.type === typeFilter.value
}

/**
 * Conta dentro do tipo selecionado, não no total: com "Receitas" ativo, um
 * número que incluísse despesas não bateria com o que a lista mostraria.
 */
const orphanCount = computed(
  () =>
    categories.value.filter(
      (category) => matchesType(category) && !category.supercategoryId,
    ).length,
)

const filteredCategories = computed(() => {
  const term = search.value.trim().toLowerCase()

  return categories.value.filter((category) => {
    if (!matchesType(category)) return false
    if (onlyOrphans.value && category.supercategoryId) return false

    return !term || category.name.toLowerCase().includes(term)
  })
})

/** Sair de um tipo sem pendências deixaria a lista vazia sem explicação. */
watch(orphanCount, (count) => {
  if (count === 0) onlyOrphans.value = false
})

const categoryDrawerOpen = ref(false)
const editingCategory = ref<Category | null>(null)

const supercategoryDrawerOpen = ref(false)
const editingSupercategory = ref<Supercategory | null>(null)

function openCategoryDrawer(category: Category | null) {
  editingCategory.value = category
  categoryDrawerOpen.value = true
}

function openSupercategoryDrawer(supercategory: Supercategory | null) {
  editingSupercategory.value = supercategory
  supercategoryDrawerOpen.value = true
}

async function refreshAll() {
  await Promise.all([refreshCategories(), refreshSupercategories()])
}

async function removeCategory(category: Category) {
  if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return

  await $fetch(`/api/categories/${category.id}`, { method: 'DELETE' })
  await refreshAll()
}

async function removeSupercategory(supercategory: Supercategory) {
  const warning =
    supercategory.categories.length > 0
      ? `Excluir "${supercategory.name}"? As ${supercategory.categories.length} categorias associadas ficarão sem supercategoria.`
      : `Excluir a supercategoria "${supercategory.name}"?`

  if (!window.confirm(warning)) return

  await $fetch(`/api/supercategories/${supercategory.id}`, {
    method: 'DELETE',
  })
  await refreshAll()
}
</script>

<template>
  <div>
    <PageHeading
      eyebrow="Financeiro / Categorias"
      title="Categorias"
      description="Gerencie categorias e supercategorias dos seus lançamentos."
    >
      <template #actions>
        <UiButton
          v-if="activeTab === 'categories'"
          @click="openCategoryDrawer(null)"
        >
          <template #leading><Plus /></template>
          Nova categoria
        </UiButton>
        <UiButton v-else @click="openSupercategoryDrawer(null)">
          <template #leading><Plus /></template>
          Nova supercategoria
        </UiButton>
      </template>
    </PageHeading>

    <UiTabs v-model="activeTab" :tabs="tabs" class="categories-tabs" />

    <template v-if="activeTab === 'categories'">
      <div class="categories-toolbar">
        <div class="categories-toolbar__search">
          <Search aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar categoria..."
            aria-label="Buscar categoria"
          />
        </div>
        <UiSegmentedControl v-model="typeFilter" :options="typeFilterOptions" />

        <button
          v-if="orphanCount"
          type="button"
          class="categories-orphans"
          :class="{ 'categories-orphans--on': onlyOrphans }"
          :aria-pressed="onlyOrphans"
          @click="onlyOrphans = !onlyOrphans"
        >
          <FolderTree aria-hidden="true" />
          Sem supercategoria
          <span>{{ orphanCount }}</span>
        </button>
      </div>

      <div v-if="categoriesPending" class="categories-grid" aria-hidden="true">
        <UiSkeleton v-for="index in 8" :key="index" height="4.5rem" radius="md" />
      </div>

      <div v-else-if="filteredCategories.length" class="categories-grid">
        <CategoriesCategoryCard
          v-for="category in filteredCategories"
          :key="category.id"
          :category="category"
          @edit="openCategoryDrawer(category)"
          @remove="removeCategory(category)"
        />
      </div>

      <UiCard v-else padding="none">
        <UiEmptyState
          v-if="categories.length === 0"
          title="Nenhuma categoria cadastrada"
          description="Crie a primeira categoria para começar a organizar seus lançamentos."
        >
          <template #icon><Tags /></template>
          <template #action>
            <UiButton @click="openCategoryDrawer(null)">
              <template #leading><Plus /></template>
              Nova categoria
            </UiButton>
          </template>
        </UiEmptyState>
        <UiEmptyState
          v-else
          title="Nenhum resultado"
          description="Nenhuma categoria corresponde à busca ou ao filtro selecionado."
        >
          <template #icon><Search /></template>
        </UiEmptyState>
      </UiCard>
    </template>

    <template v-else>
      <div
        v-if="supercategoriesPending"
        class="supercategories-grid"
        aria-hidden="true"
      >
        <UiSkeleton v-for="index in 6" :key="index" height="9rem" radius="md" />
      </div>

      <div v-else-if="supercategories.length" class="supercategories-grid">
        <CategoriesSupercategoryCard
          v-for="supercategory in supercategories"
          :key="supercategory.id"
          :supercategory="supercategory"
          @edit="openSupercategoryDrawer(supercategory)"
          @remove="removeSupercategory(supercategory)"
        />
      </div>

      <UiCard v-else padding="none">
        <UiEmptyState
          title="Nenhuma supercategoria cadastrada"
          description="Supercategorias agrupam categorias relacionadas, como Moradia ou Alimentação."
        >
          <template #icon><FolderTree /></template>
          <template #action>
            <UiButton @click="openSupercategoryDrawer(null)">
              <template #leading><Plus /></template>
              Nova supercategoria
            </UiButton>
          </template>
        </UiEmptyState>
      </UiCard>
    </template>

    <CategoriesCategoryFormDrawer
      v-model:open="categoryDrawerOpen"
      :category="editingCategory"
      :supercategories="supercategories"
      @saved="refreshAll"
    />
    <CategoriesSupercategoryFormDrawer
      v-model:open="supercategoryDrawerOpen"
      :supercategory="editingSupercategory"
      @saved="refreshAll"
    />
  </div>
</template>

<style scoped>
.categories-tabs {
  margin-top: var(--space-6);
}

.categories-toolbar {
  display: flex;
  flex-wrap: wrap;
  margin: var(--space-5) 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-4);
}

/**
 * Fica desligado por padrão e some quando não há pendência: é uma tarefa a
 * fazer, não um estado permanente da tela.
 */
.categories-orphans {
  display: inline-flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.categories-orphans svg {
  width: 0.9rem;
  height: 0.9rem;
}

.categories-orphans span {
  padding: 0.1rem 0.4rem;
  border-radius: var(--radius-sm);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.categories-orphans:hover {
  border-color: var(--color-ink-muted);
  color: var(--color-ink);
}

.categories-orphans--on {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.categories-orphans--on span {
  background: var(--color-surface);
}

.categories-toolbar__search {
  display: flex;
  min-width: 18rem;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.categories-toolbar__search:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.categories-toolbar__search svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.categories-toolbar__search input {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.categories-toolbar__search input:focus {
  outline: none;
}

.categories-toolbar__search input::placeholder {
  color: var(--color-ink-muted);
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--space-3);
}

.supercategories-grid {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}
</style>
