<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  FileStack,
  Receipt,
} from '@lucide/vue'
import type { BankKey } from '~/types/account'
import type {
  FinanceListItem,
  FinanceListSectionData,
} from '~/types/finance'

const props = defineProps<{
  title: string
  kind: 'payables' | 'incomes'
  section: FinanceListSectionData
  emptyTitle: string
  emptyDescription: string
}>()

const totalLabel = computed(() =>
  props.kind === 'payables' ? 'Total' : 'Total do mês',
)

function itemMeta(item: FinanceListItem) {
  if (item.kind === 'card_invoice') {
    return `${item.category} · ${item.account}`
  }
  return `${item.dateLabel} · ${item.category}`
}

function statusSideLabel(item: FinanceListItem) {
  if (props.kind !== 'incomes') return null
  if (item.settled) return 'Recebido'
  return 'A receber'
}

function openItem(item: FinanceListItem) {
  if (!item.linkTo) return
  void navigateTo(item.linkTo)
}
</script>

<template>
  <UiCard class="finance-list" padding="none">
    <header class="finance-list__header">
      <div class="finance-list__title-line">
        <span class="finance-list__title-icon" aria-hidden="true">
          <ArrowUpRight v-if="kind === 'payables'" />
          <ArrowDownLeft v-else />
        </span>
        <h2>{{ title }}</h2>
      </div>
      <p class="finance-list__sort">
        ↑ mais antigo
        <span>{{ section.itemCount }} {{ section.itemCount === 1 ? 'item' : 'items' }}</span>
      </p>
    </header>

    <div v-if="section.itemCount" class="finance-list__body">
      <section
        v-for="group in section.groups"
        :key="group.key"
        class="finance-list__group"
      >
        <ul class="finance-list__items">
          <li v-for="item in group.items" :key="item.id">
            <div
              class="finance-list__row"
              :class="{
                'finance-list__row--link': Boolean(item.linkTo),
                'finance-list__row--settled':
                  item.settled && kind === 'payables',
              }"
              :role="item.linkTo ? 'link' : undefined"
              :tabindex="item.linkTo ? 0 : undefined"
              @click="openItem(item)"
              @keydown.enter.prevent="openItem(item)"
            >
              <div class="finance-list__icon" aria-hidden="true">
                <AccountsBankMark
                  v-if="
                    item.kind === 'card_invoice' &&
                    item.bankKey &&
                    item.bankColor
                  "
                  :name="item.account"
                  :color="item.bankColor"
                  :bank-key="(item.bankKey as BankKey)"
                  tint
                  size="md"
                />
                <CategoriesCategoryIconChip
                  v-else-if="item.categoryIcon && item.categoryColor"
                  :icon="item.categoryIcon"
                  :color="item.categoryColor"
                />
                <span
                  v-else
                  class="finance-list__fallback"
                  :class="{
                    'finance-list__fallback--invoice':
                      item.kind === 'card_invoice',
                  }"
                >
                  <CreditCard v-if="item.kind === 'card_invoice'" />
                  <Receipt v-else />
                </span>
              </div>

              <div class="finance-list__identity">
                <p>{{ item.name }}</p>
                <span>{{ itemMeta(item) }}</span>
              </div>

              <div class="finance-list__amount-wrap">
                <p
                  class="finance-list__amount numeric"
                  :class="`finance-list__amount--${kind}`"
                >
                  <UiMoney :value="item.amount" />
                </p>
                <span
                  v-if="statusSideLabel(item)"
                  class="finance-list__side-status"
                  :class="{
                    'finance-list__side-status--received': item.settled,
                  }"
                >
                  {{ statusSideLabel(item) }}
                </span>
              </div>
            </div>
          </li>
        </ul>

        <div class="finance-list__subtotal">
          <span>{{ group.label }}</span>
          <strong class="numeric"><UiMoney :value="group.total" /></strong>
        </div>
      </section>

      <footer class="finance-list__total">
        <span>{{ totalLabel }}</span>
        <strong
          class="numeric"
          :class="`finance-list__total-value--${kind}`"
        >
          <UiMoney :value="section.total" />
        </strong>
      </footer>
    </div>

    <UiEmptyState
      v-else
      :title="emptyTitle"
      :description="emptyDescription"
    >
      <template #icon>
        <FileStack />
      </template>
    </UiEmptyState>
  </UiCard>
</template>

<style scoped>
.finance-list {
  overflow: hidden;
}

.finance-list__header {
  display: flex;
  min-height: 3.25rem;
  padding: var(--space-4) var(--space-5);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.finance-list__title-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.finance-list__title-icon {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
  color: var(--color-ink-secondary);
}

.finance-list__title-icon svg {
  width: 1rem;
  height: 1rem;
}

.finance-list__title-line h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
}

.finance-list__sort {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.finance-list__sort span {
  margin-left: var(--space-1);
}

.finance-list__body {
  padding-bottom: var(--space-2);
}

.finance-list__group + .finance-list__group {
  margin-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.finance-list__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.finance-list__row {
  display: grid;
  min-height: 3.5rem;
  padding: 0.65rem var(--space-5);
  grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.finance-list__row--link {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.finance-list__row--link:hover {
  background: var(--color-surface-subtle);
}

.finance-list__row--link:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: -2px;
}

.finance-list__row--settled .finance-list__identity p,
.finance-list__row--settled .finance-list__identity span,
.finance-list__row--settled .finance-list__amount {
  color: var(--color-ink-muted);
  text-decoration: line-through;
}

.finance-list__row--settled .finance-list__icon {
  opacity: 0.45;
}

.finance-list__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  flex-shrink: 0;
}

.finance-list__icon :deep(.bank-mark),
.finance-list__icon :deep(.icon-chip) {
  width: 2.25rem;
  height: 2.25rem;
}

.finance-list__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.finance-list__fallback--invoice {
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.finance-list__fallback svg {
  width: 1rem;
  height: 1rem;
}

.finance-list__identity {
  min-width: 0;
}

.finance-list__identity p {
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finance-list__identity span {
  display: block;
  overflow: hidden;
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.finance-list__amount-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}

.finance-list__amount {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.finance-list__side-status {
  color: var(--color-ink-muted);
  font-size: 0.625rem;
  font-weight: var(--weight-medium);
}

.finance-list__side-status--received {
  color: var(--color-positive);
}

.finance-list__subtotal {
  display: flex;
  padding: 0.35rem var(--space-5) 0.55rem;
  align-items: center;
  justify-content: space-between;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.finance-list__subtotal strong {
  font-weight: var(--weight-medium);
}

.finance-list__total {
  display: flex;
  margin: var(--space-2) var(--space-5) var(--space-3);
  padding-top: var(--space-3);
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.finance-list__total strong {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.finance-list__total-value--payables {
  color: var(--color-negative-ink);
}

.finance-list__total-value--incomes {
  color: var(--color-positive-ink);
}

@media (max-width: 480px) {
  .finance-list__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    min-height: 0;
    padding: var(--space-4);
  }

  .finance-list__row {
    padding: 0.65rem var(--space-4);
  }
}
</style>
