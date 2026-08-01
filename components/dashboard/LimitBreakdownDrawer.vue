<script setup lang="ts">
import type { LimitBreakdownItem, LimitBreakdownReport } from '~/types/limits'
import { formatDateBr } from '~/utils/dateMoney'

const props = defineProps<{
  report: LimitBreakdownReport | null
  pending: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const itemCount = computed(() => props.report?.items.length ?? 0)

function itemMeta(item: LimitBreakdownItem) {
  const parts = [formatDateBr(item.date)]

  if (item.sourceLabel) parts.push(item.sourceLabel)
  parts.push(item.source === 'card' ? 'Cartão' : 'Conta')

  if (item.recurrence === 'installment' && item.installmentCount) {
    parts.push(`${item.installmentCount} parcelas`)
  } else if (item.recurrence === 'fixed') {
    parts.push('Fixo mensal')
  }

  return parts.join(' · ')
}

function itemAmountLabel(item: LimitBreakdownItem) {
  if (item.recurrence !== 'installment' || !item.installmentCount) return null
  return `Parcela de ${item.originalAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })}`
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="report ? `Consumo de ${report.label}` : 'Consumo do limite'"
  >
    <div class="limit-breakdown">
      <UiSkeleton v-if="pending && !report" height="12rem" radius="md" />

      <template v-else-if="report">
        <div class="limit-breakdown__summary">
          <div>
            <p>Consumido no mês</p>
            <strong><UiMoney :value="report.spent" /></strong>
            <span v-if="report.limitAmount !== null">
              de <UiMoney :value="report.limitAmount" /> definidos
            </span>
          </div>
          <div>
            <p>{{ itemCount }} {{ itemCount === 1 ? 'compra' : 'compras' }}</p>
            <span>
              Conta <UiMoney :value="report.sourceTotals.account" />
              · Cartão <UiMoney :value="report.sourceTotals.card" />
            </span>
          </div>
        </div>

        <UiEmptyState
          v-if="!report.items.length"
          title="Nenhuma compra consumindo este limite"
          description="Quando houver compras neste mês para esta categoria, elas aparecerão aqui."
        />

        <ul v-else class="limit-breakdown__list">
          <li v-for="item in report.items" :key="item.id">
            <CategoriesCategoryIconChip
              v-if="item.categoryIcon && item.categoryColor"
              :icon="item.categoryIcon"
              :color="item.categoryColor"
              size="sm"
            />
            <span v-else class="limit-breakdown__fallback" aria-hidden="true">
              {{ item.description.slice(0, 1).toUpperCase() }}
            </span>

            <div class="limit-breakdown__copy">
              <strong>{{ item.description }}</strong>
              <p>{{ itemMeta(item) }}</p>
              <p v-if="itemAmountLabel(item)" class="limit-breakdown__installment">
                {{ itemAmountLabel(item) }} · conta no limite pelo total da compra
              </p>
            </div>

            <span class="limit-breakdown__amount numeric">
              <UiMoney :value="item.amount" />
            </span>
          </li>
        </ul>
      </template>
    </div>
  </UiDrawer>
</template>

<style scoped>
.limit-breakdown {
  display: grid;
  gap: var(--space-5);
}

.limit-breakdown__summary {
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

.limit-breakdown__summary p,
.limit-breakdown__summary span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__summary strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__summary > div:last-child {
  text-align: right;
}

.limit-breakdown__summary > div:last-child span {
  display: block;
  margin-top: var(--space-1);
}

.limit-breakdown__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.limit-breakdown__list li {
  display: grid;
  align-items: start;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.limit-breakdown__fallback {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__copy strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.limit-breakdown__copy p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__copy .limit-breakdown__installment {
  color: var(--color-ink-secondary);
}

.limit-breakdown__amount {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (max-width: 520px) {
  .limit-breakdown__summary > div:last-child {
    text-align: left;
  }

  .limit-breakdown__list li {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .limit-breakdown__amount {
    grid-column: 2;
  }
}
</style>