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

function itemMeta(item: SpendingGuardBreakdownItem) {
  const parts: string[] = [formatDateBr(item.date)]
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
          v-for="group in groups"
          :key="group.key"
          class="spending-breakdown__group"
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

          <ul class="spending-breakdown__list">
            <li v-for="item in group.items" :key="item.id">
              <div class="spending-breakdown__copy">
                <strong>{{ item.description }}</strong>
                <p>{{ itemMeta(item) }}</p>
              </div>
              <span class="spending-breakdown__amount numeric">
                <UiMoney :value="item.amount" />
              </span>
            </li>
          </ul>
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

.spending-breakdown__group-head {
  display: grid;
  align-items: center;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  list-style: none;
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

.spending-breakdown__list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-border);
}

.spending-breakdown__list li {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.spending-breakdown__list li + li {
  border-top: 1px solid var(--color-border);
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
</style>
