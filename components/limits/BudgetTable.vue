<script setup lang="ts">
import { ChevronDown, Pencil, Plus, Repeat2 } from '@lucide/vue'
import type { LimitRow, LimitScope } from '~/types/limits'

const props = defineProps<{
  categories: LimitRow[]
  supercategories: LimitRow[]
}>()

const emit = defineEmits<{
  edit: [scope: LimitScope, row: LimitRow]
  breakdown: [scope: LimitScope, row: LimitRow]
}>()

const showUnbudgeted = ref(false)

const unbudgetedCount = computed(
  () => props.categories.filter((row) => row.limitAmount === null).length,
)

const groups = computed(() => {
  const categoriesByParent = new Map<number, LimitRow[]>()
  for (const category of props.categories) {
    const parentId = category.parentReferenceId ?? 0
    const rows = categoriesByParent.get(parentId) ?? []
    rows.push(category)
    categoriesByParent.set(parentId, rows)
  }

  const superRows = [...props.supercategories]
  if (
    categoriesByParent.has(0) &&
    !superRows.some((row) => row.referenceId === 0)
  ) {
    superRows.push({
      referenceId: 0,
      parentReferenceId: null,
      label: 'Sem supercategoria',
      color: '#94a3b8',
      icon: 'folder-tree',
      spent: 0,
      limitAmount: null,
      limitId: null,
      recurring: false,
    })
  }

  return superRows
    .map((row) => {
      const allCategories = (categoriesByParent.get(row.referenceId) ?? []).sort(
        (a, b) =>
          (b.limitAmount !== null ? 1 : 0) -
            (a.limitAmount !== null ? 1 : 0) ||
          b.spent - a.spent ||
          a.label.localeCompare(b.label, 'pt-BR'),
      )
      const visibleCategories = showUnbudgeted.value
        ? allCategories
        : allCategories.filter(
            (category) =>
              category.limitAmount !== null || category.spent > 0,
          )
      const derivedBudget = allCategories.reduce(
        (sum, category) => sum + (category.limitAmount ?? 0),
        0,
      )
      const budgetedCategoryCount = allCategories.filter(
        (category) => category.limitAmount !== null,
      ).length

      return {
        row,
        allCategories,
        visibleCategories,
        budget: row.limitAmount,
        budgetedCategoryCount,
        hasAnyBudget: row.limitAmount !== null || derivedBudget > 0,
      }
    })
    .filter(
      (group) =>
        showUnbudgeted.value ||
        group.row.spent > 0 ||
        group.budget !== null ||
        group.visibleCategories.length > 0,
    )
    .sort(
      (a, b) =>
        (b.hasAnyBudget ? 1 : 0) - (a.hasAnyBudget ? 1 : 0) ||
        b.row.spent - a.row.spent ||
        a.row.label.localeCompare(b.row.label, 'pt-BR'),
    )
})

function remaining(spent: number, budget: number | null) {
  return budget === null ? null : budget - spent
}

function progress(spent: number, budget: number | null) {
  if (!budget || budget <= 0) return 0
  return Math.min(100, (spent / budget) * 100)
}

function tone(spent: number, budget: number | null) {
  if (budget === null) return 'neutral'
  if (spent > budget) return 'danger'
  if (spent / budget >= 0.8) return 'warning'
  return 'positive'
}
</script>

<template>
  <div class="budget-table">
    <div class="budget-table__head" aria-hidden="true">
      <span>Despesas</span>
      <span>Orçamento</span>
      <span>Utilizado</span>
      <span>Restante</span>
      <span />
    </div>

    <div class="budget-table__groups">
      <details
        v-for="group in groups"
        :key="group.row.referenceId"
        class="budget-group"
        open
      >
        <summary class="budget-group__summary">
          <div class="budget-group__identity">
            <ChevronDown class="budget-group__chevron" aria-hidden="true" />
            <CategoriesCategoryIconChip
              :icon="group.row.icon"
              :color="group.row.color"
              size="sm"
            />
            <div>
              <strong>{{ group.row.label }}</strong>
              <span v-if="group.row.recurring">Repete todo mês</span>
              <span v-else-if="group.budgetedCategoryCount">
                {{ group.budgetedCategoryCount }}
                {{
                  group.budgetedCategoryCount === 1
                    ? 'categoria com orçamento'
                    : 'categorias com orçamento'
                }}
              </span>
            </div>
          </div>

          <strong class="numeric" data-label="Orçamento">
            <UiMoney v-if="group.budget !== null" :value="group.budget" />
            <span v-else>—</span>
          </strong>
          <button
            type="button"
            class="budget-table__value-button numeric"
            data-label="Utilizado"
            :disabled="group.row.spent <= 0"
            @click.stop="emit('breakdown', 'supercategory', group.row)"
          >
            <UiMoney :value="group.row.spent" />
          </button>
          <strong
            class="budget-table__remaining numeric"
            :class="`is-${tone(group.row.spent, group.budget)}`"
            data-label="Restante"
          >
            <UiMoney
              v-if="remaining(group.row.spent, group.budget) !== null"
              :value="remaining(group.row.spent, group.budget)!"
            />
            <span v-else>—</span>
            <span
              v-if="group.budget !== null"
              class="budget-table__progress"
              :class="`is-${tone(group.row.spent, group.budget)}`"
              aria-hidden="true"
            >
              <span
                :style="{
                  width: `${progress(group.row.spent, group.budget)}%`,
                }"
              />
            </span>
          </strong>
          <button
            type="button"
            class="budget-table__edit"
            :aria-label="`Editar orçamento de ${group.row.label}`"
            @click.stop="emit('edit', 'supercategory', group.row)"
          >
            <Pencil v-if="group.row.limitAmount !== null" aria-hidden="true" />
            <Plus v-else aria-hidden="true" />
          </button>

        </summary>

        <ul v-if="group.visibleCategories.length" class="budget-group__children">
          <li
            v-for="category in group.visibleCategories"
            :key="category.referenceId"
            class="budget-row"
          >
            <div class="budget-row__identity">
              <CategoriesCategoryIconChip
                :icon="category.icon"
                :color="category.color"
                size="sm"
              />
              <div>
                <strong>{{ category.label }}</strong>
                <span v-if="category.recurring">
                  <Repeat2 aria-hidden="true" />
                  Todo mês
                </span>
              </div>
            </div>

            <strong class="numeric" data-label="Orçamento">
              <UiMoney
                v-if="category.limitAmount !== null"
                :value="category.limitAmount"
              />
              <span v-else>—</span>
            </strong>
            <button
              type="button"
              class="budget-table__value-button numeric"
              data-label="Utilizado"
              :disabled="category.spent <= 0"
              @click="emit('breakdown', 'category', category)"
            >
              <UiMoney :value="category.spent" />
            </button>
            <strong
              class="budget-table__remaining numeric"
              :class="`is-${tone(category.spent, category.limitAmount)}`"
              data-label="Restante"
            >
              <UiMoney
                v-if="remaining(category.spent, category.limitAmount) !== null"
                :value="remaining(category.spent, category.limitAmount)!"
              />
              <span v-else>—</span>
              <span
                v-if="category.limitAmount !== null"
                class="budget-table__progress"
                :class="`is-${tone(category.spent, category.limitAmount)}`"
                aria-hidden="true"
              >
                <span
                  :style="{
                    width: `${progress(category.spent, category.limitAmount)}%`,
                  }"
                />
              </span>
            </strong>
            <button
              type="button"
              class="budget-table__edit"
              :aria-label="`Editar orçamento de ${category.label}`"
              @click="emit('edit', 'category', category)"
            >
              <Pencil v-if="category.limitAmount !== null" aria-hidden="true" />
              <Plus v-else aria-hidden="true" />
            </button>

          </li>
        </ul>
      </details>
    </div>

    <button
      v-if="unbudgetedCount"
      type="button"
      class="budget-table__unbudgeted"
      @click="showUnbudgeted = !showUnbudgeted"
    >
      {{
        showUnbudgeted
          ? 'Ocultar categorias sem orçamento'
          : `Mostrar ${unbudgetedCount} sem orçamento`
      }}
    </button>
  </div>
</template>

<style scoped>
.budget-table__head,
.budget-group__summary,
.budget-row {
  display: grid;
  grid-template-columns: minmax(15rem, 1.6fr) repeat(3, minmax(6.5rem, 0.65fr)) 2.25rem;
  align-items: center;
  column-gap: var(--space-4);
}

.budget-table__head {
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.budget-table__head span:not(:first-child) {
  text-align: right;
}

.budget-table__groups {
  display: grid;
}

.budget-group + .budget-group {
  border-top: 1px solid var(--color-border);
}

.budget-group__summary {
  position: relative;
  min-height: 4.5rem;
  padding: var(--space-4) var(--space-5) calc(var(--space-4) + 0.35rem);
  cursor: pointer;
  list-style: none;
}

.budget-group__summary::-webkit-details-marker {
  display: none;
}

.budget-group__identity,
.budget-row__identity {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--space-3);
}

.budget-group__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-ink-muted);
  transition: transform var(--transition-fast);
}

.budget-group:not([open]) .budget-group__chevron {
  transform: rotate(-90deg);
}

.budget-group__identity strong,
.budget-row__identity strong {
  display: block;
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.budget-group__identity > div > span,
.budget-row__identity > div > span {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
}

.budget-group__identity :deep(.icon-chip),
.budget-row__identity :deep(.icon-chip) {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-sm);
}

.budget-group__identity :deep(.icon-chip svg),
.budget-row__identity :deep(.icon-chip svg) {
  width: 0.95rem;
  height: 0.95rem;
  stroke-width: 2;
}

.budget-row__identity {
  padding-left: 2rem;
}

.budget-row__identity span svg {
  width: 0.7rem;
  height: 0.7rem;
}

.budget-group__summary > strong,
.budget-row > strong {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-align: right;
}

.budget-table__remaining.is-positive {
  color: var(--color-positive-ink);
}

.budget-table__remaining.is-warning {
  color: var(--color-warning);
}

.budget-table__remaining.is-danger {
  color: var(--color-negative-ink);
}

.budget-table__remaining.is-neutral {
  color: var(--color-ink-muted);
}

.budget-table__remaining {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
}

.budget-table__value-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  text-align: right;
}

.budget-table__value-button:disabled {
  cursor: default;
}

.budget-table__value-button:not(:disabled):hover {
  color: var(--color-brand);
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.budget-table__edit {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  cursor: pointer;
}

.budget-table__edit:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.budget-table__edit svg {
  width: 0.9rem;
  height: 0.9rem;
}

.budget-table__progress {
  display: block;
  overflow: hidden;
  width: 100%;
  max-width: 6.5rem;
  height: 0.25rem;
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.budget-table__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}

.budget-table__progress.is-warning span {
  background: var(--color-warning);
}

.budget-table__progress.is-danger span {
  background: var(--color-negative);
}

.budget-group__children {
  margin: 0;
  padding: 0;
  list-style: none;
  background: color-mix(in srgb, var(--color-surface-subtle) 45%, transparent);
}

.budget-row {
  position: relative;
  min-height: 4.15rem;
  padding: var(--space-3) var(--space-5) calc(var(--space-3) + 0.3rem);
  border-top: 1px solid var(--color-border);
}

.budget-table__unbudgeted {
  width: 100%;
  padding: var(--space-4) var(--space-5);
  border: 0;
  border-top: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
  text-align: left;
}

.budget-table__unbudgeted:hover {
  color: var(--color-ink);
  background: var(--color-surface-subtle);
}

@media (max-width: 860px) {
  .budget-table__head {
    display: none;
  }

  .budget-group__summary,
  .budget-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-3);
  }

  .budget-group__identity,
  .budget-row__identity {
    grid-column: 1 / -1;
  }

  .budget-row__identity {
    padding-left: 1.5rem;
  }

  .budget-group__summary > strong,
  .budget-group__summary > .budget-table__value-button,
  .budget-row > strong,
  .budget-row > .budget-table__value-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .budget-group__summary > strong::before,
  .budget-group__summary > .budget-table__value-button::before,
  .budget-row > strong::before,
  .budget-row > .budget-table__value-button::before {
    color: var(--color-ink-muted);
    content: attr(data-label);
    font-size: var(--text-2xs);
    font-weight: var(--weight-medium);
  }

  .budget-table__edit {
    position: absolute;
    top: var(--space-3);
    right: var(--space-4);
  }

  .budget-group__identity,
  .budget-row__identity {
    padding-right: 2.75rem;
  }

  .budget-table__remaining {
    flex-wrap: wrap;
  }

  .budget-table__remaining .budget-table__progress {
    flex: 0 0 100%;
    margin-left: auto;
  }
}
</style>
