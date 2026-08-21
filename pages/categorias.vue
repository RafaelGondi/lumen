<script setup lang="ts">
import { FolderTree, Plus, Search, Sparkles, Tags } from '@lucide/vue'
import type { Category, CategoryType, Supercategory } from '~/types/category'
import type {
  CategorizationRule,
  CategorizationRulePayload,
} from '~/types/categorizationRule'

type TypeFilter = 'all' | CategoryType

const activeTab = ref<'categories' | 'supercategories' | 'rules'>('categories')
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

const {
  data: rules,
  pending: rulesPending,
  refresh: refreshRules,
} = await useFetch<CategorizationRule[]>('/api/categorization-rules', {
  default: () => [],
})

const tabs = computed(() => [
  { id: 'categories', label: 'Categorias', count: categories.value.length },
  {
    id: 'supercategories',
    label: 'Supercategorias',
    count: supercategories.value.length,
  },
  { id: 'rules', label: 'Regras inteligentes', count: rules.value.length },
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

const filteredRules = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return rules.value
  return rules.value.filter(
    (rule) =>
      rule.pattern.toLowerCase().includes(term) ||
      rule.categoryName.toLowerCase().includes(term),
  )
})

/** Sair de um tipo sem pendências deixaria a lista vazia sem explicação. */
watch(orphanCount, (count) => {
  if (count === 0) onlyOrphans.value = false
})

const categoryDrawerOpen = ref(false)
const editingCategory = ref<Category | null>(null)

const supercategoryDrawerOpen = ref(false)
const editingSupercategory = ref<Supercategory | null>(null)
const ruleDrawerOpen = ref(false)
const editingRule = ref<CategorizationRule | null>(null)

function openCategoryDrawer(category: Category | null) {
  editingCategory.value = category
  categoryDrawerOpen.value = true
}

function openSupercategoryDrawer(supercategory: Supercategory | null) {
  editingSupercategory.value = supercategory
  supercategoryDrawerOpen.value = true
}

function openRuleDrawer(rule: CategorizationRule | null) {
  editingRule.value = rule
  ruleDrawerOpen.value = true
}

async function refreshAll() {
  await Promise.all([
    refreshCategories(),
    refreshSupercategories(),
    refreshRules(),
  ])
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

async function toggleRule(rule: CategorizationRule) {
  const payload: CategorizationRulePayload = {
    field: rule.field,
    operator: rule.operator,
    pattern: rule.pattern,
    categoryId: rule.categoryId,
    active: !rule.active,
  }
  await $fetch(`/api/categorization-rules/${rule.id}`, {
    method: 'PUT',
    body: payload,
  })
  await refreshRules()
}

async function removeRule(rule: CategorizationRule) {
  if (!window.confirm(`Excluir a regra para “${rule.pattern}”?`)) return
  await $fetch(`/api/categorization-rules/${rule.id}`, { method: 'DELETE' })
  await refreshRules()
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
        <UiButton v-if="activeTab === 'categories'" @click="openCategoryDrawer(null)">
          <template #leading><Plus /></template>
          Nova categoria
        </UiButton>
        <UiButton
          v-else-if="activeTab === 'supercategories'"
          @click="openSupercategoryDrawer(null)"
        >
          <template #leading><Plus /></template>
          Nova supercategoria
        </UiButton>
        <UiButton v-else @click="openRuleDrawer(null)">
          <template #leading><Sparkles /></template>
          Nova regra
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

    <template v-else-if="activeTab === 'supercategories'">
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

    <template v-else>
      <div class="rules-intro">
        <div class="rules-intro__icon"><Sparkles aria-hidden="true" /></div>
        <div>
          <strong>Categorize novos lançamentos sem esforço</strong>
          <p>
            As regras analisam descrição e nome no extrato. Elas só agem quando
            nenhuma categoria foi escolhida manualmente.
          </p>
        </div>
        <span>Regra mais específica vence</span>
      </div>

      <div class="rules-toolbar">
        <div class="categories-toolbar__search">
          <Search aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            placeholder="Buscar regra ou categoria..."
            aria-label="Buscar regra"
          />
        </div>
      </div>

      <UiCard v-if="rulesPending" padding="none">
        <div class="rules-skeleton">
          <UiSkeleton v-for="index in 4" :key="index" height="5.25rem" radius="sm" />
        </div>
      </UiCard>
      <UiCard v-else-if="filteredRules.length" padding="none">
        <div class="rules-list">
          <CategoriesCategorizationRuleCard
            v-for="rule in filteredRules"
            :key="rule.id"
            :rule="rule"
            @edit="openRuleDrawer(rule)"
            @toggle="toggleRule(rule)"
            @remove="removeRule(rule)"
          />
        </div>
      </UiCard>
      <UiCard v-else padding="none">
        <UiEmptyState
          :title="rules.length ? 'Nenhuma regra encontrada' : 'Nenhuma regra inteligente'"
          :description="
            rules.length
              ? 'Tente buscar por outro texto ou categoria.'
              : 'Crie uma regra para categorizar automaticamente novas compras e movimentações.'
          "
        >
          <template #icon><Sparkles /></template>
          <template v-if="!rules.length" #action>
            <UiButton @click="openRuleDrawer(null)">
              <template #leading><Plus /></template>
              Criar primeira regra
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
    <CategoriesCategorizationRuleFormDrawer
      v-model:open="ruleDrawerOpen"
      :rule="editingRule"
      :categories="categories"
      @saved="refreshRules"
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
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: var(--space-3);
}

.supercategories-grid {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-4);
}

.rules-intro {
  display: flex;
  margin: var(--space-5) 0 0;
  padding: var(--space-4) var(--space-5);
  align-items: center;
  gap: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.rules-intro__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

.rules-intro__icon svg { width: 1.1rem; height: 1.1rem; }
.rules-intro > div:nth-child(2) { min-width: 0; flex: 1; }
.rules-intro strong { font-size: var(--text-sm); }
.rules-intro p { margin-top: var(--space-1); color: var(--color-ink-muted); font-size: var(--text-xs); line-height: 1.45; }
.rules-intro > span { color: var(--color-ink-muted); font-size: var(--text-xs); white-space: nowrap; }
.rules-toolbar { display: flex; margin: var(--space-4) 0; }
.rules-skeleton { overflow: hidden; }

.categories-grid > *,
.supercategories-grid > * {
  min-width: 0;
}

@media (max-width: 960px) {
  .supercategories-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .categories-tabs {
    margin-top: var(--space-4);
  }

  .categories-toolbar {
    display: grid;
    margin: var(--space-4) 0;
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .categories-toolbar__search {
    width: 100%;
    min-width: 0;
  }

  .categories-toolbar :deep(.ui-segmented) {
    display: flex;
    width: 100%;
    overflow-x: auto;
  }

  .categories-toolbar :deep(.ui-segmented__option) {
    flex: 1 0 auto;
  }

  .categories-orphans {
    width: 100%;
    justify-content: center;
  }

  .categories-grid,
  .supercategories-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .rules-intro { align-items: flex-start; }
  .rules-intro > span { display: none; }
  .rules-toolbar .categories-toolbar__search { width: 100%; }
}
</style>
