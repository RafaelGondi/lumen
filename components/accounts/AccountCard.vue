<script setup lang="ts">
import { ChevronRight, Pencil, Trash2 } from '@lucide/vue'
import type { Account } from '~/types/account'

defineProps<{
  account: Account
}>()

defineEmits<{
  edit: []
  remove: []
}>()
</script>

<template>
  <NuxtLink :to="`/contas/${account.id}`" class="account-card">
    <div class="account-card__top">
      <AccountsBankMark
        :name="account.bankName"
        :color="account.color"
        :bank-key="account.bankKey"
      />
      <div class="account-card__identity">
        <p class="account-card__name">{{ account.name }}</p>
        <p class="account-card__bank">{{ account.bankName }}</p>
      </div>
      <ChevronRight class="account-card__chevron" aria-hidden="true" />
    </div>

    <div class="account-card__bottom">
      <div>
        <p class="account-card__balance-label">Saldo atual</p>
        <p class="account-card__balance">
          <UiMoney :value="account.balance" />
        </p>
      </div>

      <div class="account-card__actions">
        <button
          type="button"
          aria-label="Editar conta"
          @click.prevent.stop="$emit('edit')"
        >
          <Pencil aria-hidden="true" />
        </button>
        <button
          type="button"
          class="account-card__delete"
          aria-label="Excluir conta"
          @click.prevent.stop="$emit('remove')"
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.account-card {
  display: flex;
  min-height: 10rem;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.account-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}

.account-card__top {
  display: flex;
  padding: var(--space-5);
  align-items: center;
  gap: var(--space-3);
}

.account-card__identity {
  min-width: 0;
  flex: 1;
}

.account-card__name {
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card__bank {
  overflow: hidden;
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card__chevron {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.account-card__bottom {
  display: flex;
  padding: var(--space-4) var(--space-5) var(--space-5);
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.account-card__balance-label {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.account-card__balance {
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.account-card__actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.account-card:hover .account-card__actions,
.account-card:focus-within .account-card__actions {
  opacity: 1;
}

.account-card__actions button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.account-card__actions button:hover {
  color: var(--color-ink);
  border-color: var(--color-border-strong);
}

.account-card__actions .account-card__delete:hover {
  color: var(--color-negative);
  border-color: var(--color-negative);
}

.account-card__actions svg {
  width: 0.85rem;
  height: 0.85rem;
}
</style>
