<script setup lang="ts">
import type {
  SpendingGuardBreakdownGroup,
  SpendingGuardBreakdownItem,
  SpendingGuardSourceTotals,
} from '~/types/spendingGuard'
import { formatDateBr } from '~/utils/dateMoney'

const props = defineProps<{
  title: string
  total: number
  sourceTotals: SpendingGuardSourceTotals
  groups: SpendingGuardBreakdownGroup[]
}>()

const open = defineModel<boolean>('open', { required: true })

const itemCount = computed(() =>
  props.groups.reduce((sum, group) => sum + group.items.length, 0),
)

type DateGroup = {
  key: string
  label: string
  weekday: string
  total: number
  items: SpendingGuardBreakdownItem[]
}

function formatDateGroup(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return { label: formatDateBr(isoDate), weekday: '' }
  }

  return {
    label: new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
    }).format(date),
    weekday: new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
    })
      .format(date)
      .replace(/^./, (letter) => letter.toUpperCase()),
  }
}

function itemsByDate(items: SpendingGuardBreakdownItem[]) {
  const groups = new Map<string, DateGroup>()
  const sorted = [...items].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.amount - a.amount ||
      a.description.localeCompare(b.description, 'pt-BR'),
  )

  for (const item of sorted) {
    const current = groups.get(item.date)
    if (current) {
      current.items.push(item)
      current.total = Math.round((current.total + item.amount) * 100) / 100
      continue
    }

    groups.set(item.date, {
      key: item.date,
      ...formatDateGroup(item.date),
      total: item.amount,
      items: [item],
    })
  }

  return [...groups.values()]
}

const displayGroups = computed(() =>
  props.groups.map((group) => ({
    ...group,
    dateGroups: itemsByDate(group.items),
  })),
)

function itemMeta(item: SpendingGuardBreakdownItem) {
  const parts: string[] = []
  if (item.sourceLabel) {
    parts.push(item.sourceLabel)
  }
  parts.push(item.source === 'card' ? 'Cartão' : 'Conta')
  if (item.invoiceMonthLabel) {
    parts.push(`Fatura ${item.invoiceMonthLabel}`)
  }
  return parts.join(' · ')
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="title">
    <div class="spending-breakdown">
      <div class="spending-breakdown__summary">
        <div>
          <p>Total</p>
          <strong><UiMoney :value="total" /></strong>
        </div>
        <div>
          <p>{{ itemCount }} {{ itemCount === 1 ? 'lançamento' : 'lançamentos' }}</p>
          <span>
            Conta <UiMoney :value="sourceTotals.account" />
            · Cartão <UiMoney :value="sourceTotals.card" />
          </span>
        </div>
      </div>

      <UiEmptyState
        v-if="!groups.length"
        title="Nenhum lançamento"
        description="Não há despesas neste período."
      />

      <div v-else class="spending-breakdown__groups">
        <details
          v-for="group in displayGroups"
          :key="group.key"
          class="spending-breakdown__group"
          :class="{ 'is-single': displayGroups.length === 1 }"
          open
        >
          <summary class="spending-breakdown__group-head">
            <CategoriesCategoryIconChip
              v-if="group.icon && group.color"
              :icon="group.icon"
              :color="group.color"
            />
            <span
              v-else
              class="spending-breakdown__fallback"
              aria-hidden="true"
            >
              {{ group.label.slice(0, 1).toUpperCase() }}
            </span>
            <div class="spending-breakdown__group-copy">
              <strong>{{ group.label }}</strong>
              <p>
                {{ group.items.length }}
                {{
                  group.items.length === 1 ? 'lançamento' : 'lançamentos'
                }}
              </p>
            </div>
            <span class="spending-breakdown__group-total numeric">
              <UiMoney :value="group.total" />
            </span>
          </summary>

          <div class="spending-breakdown__dates">
            <section
              v-for="dateGroup in group.dateGroups"
              :key="dateGroup.key"
              class="spending-breakdown__date-group"
            >
              <header class="spending-breakdown__date-header">
                <div>
                  <strong>{{ dateGroup.label }}</strong>
                  <span>
                    <template v-if="dateGroup.weekday">
                      {{ dateGroup.weekday }} ·
                    </template>
                    {{ dateGroup.items.length }}
                    {{ dateGroup.items.length === 1 ? 'compra' : 'compras' }}
                  </span>
                </div>
                <strong class="spending-breakdown__date-total numeric">
                  <UiMoney :value="dateGroup.total" />
                </strong>
              </header>

              <ul class="spending-breakdown__list">
                <li v-for="item in dateGroup.items" :key="item.id">
                  <CategoriesCategoryIconChip
                    v-if="item.categoryIcon && item.categoryColor"
                    :icon="item.categoryIcon"
                    :color="item.categoryColor"
                    size="sm"
                  />
                  <span
                    v-else
                    class="spending-breakdown__item-fallback"
                    aria-hidden="true"
                  >
                    {{ item.description.slice(0, 1).toUpperCase() }}
                  </span>
                  <div class="spending-breakdown__copy">
                    <strong>{{ item.description }}</strong>
                    <p>{{ itemMeta(item) }}</p>
                  </div>
                  <span class="spending-breakdown__amount numeric">
                    <UiMoney :value="item.amount" />
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </details>
      </div>
    </div>
  </UiDrawer>
</template>

<style scoped>
.spending-breakdown {
  display: grid;
  gap: var(--space-5);
}

.spending-breakdown__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.spending-breakdown__summary p {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-breakdown__summary > div:first-child strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__summary > div:last-child {
  text-align: right;
}

.spending-breakdown__summary > div:last-child span {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.spending-breakdown__groups {
  display: grid;
  gap: var(--space-3);
}

.spending-breakdown__group {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.spending-breakdown__group.is-single {
  overflow: visible;
  border: 0;
  border-radius: 0;
}

.spending-breakdown__group-head {
  display: grid;
  align-items: center;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  list-style: none;
}

.spending-breakdown__group.is-single > .spending-breakdown__group-head {
  display: none;
}

.spending-breakdown__group-head::-webkit-details-marker {
  display: none;
}

.spending-breakdown__fallback {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__group-copy strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__group-copy p {
  margin-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-breakdown__group-total {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__dates {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.spending-breakdown__group.is-single .spending-breakdown__dates {
  padding: 0;
  border-top: 0;
}

.spending-breakdown__date-group + .spending-breakdown__date-group {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.spending-breakdown__date-header {
  display: flex;
  margin-bottom: var(--space-2);
  padding: 0 var(--space-1);
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
}

.spending-breakdown__date-header > div {
  display: grid;
  gap: 0.1rem;
}

.spending-breakdown__date-header > div > strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__date-header span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-breakdown__date-total {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.spending-breakdown__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.spending-breakdown__list li {
  display: grid;
  align-items: start;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.spending-breakdown__item-fallback {
  display: grid;
  width: 1.25rem;
  height: 1.25rem;
  place-items: center;
  border-radius: 0.3rem;
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
}

.spending-breakdown__copy strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.spending-breakdown__copy p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-breakdown__amount {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (max-width: 520px) {
  .spending-breakdown__list li {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .spending-breakdown__amount {
    grid-column: 2;
  }
}
</style>
