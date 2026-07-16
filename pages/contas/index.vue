<script setup lang="ts">
import { Plus, WalletCards } from '@lucide/vue'
import type { Account } from '~/types/account'

const {
  data: accounts,
  pending,
  refresh,
} = await useFetch<Account[]>('/api/accounts', { default: () => [] })

const drawerOpen = ref(false)
const editingAccount = ref<Account | null>(null)

const totalBalance = computed(() =>
  accounts.value.reduce((sum, account) => sum + account.balance, 0),
)

function openDrawer(account: Account | null) {
  editingAccount.value = account
  drawerOpen.value = true
}

async function removeAccount(account: Account) {
  if (!window.confirm(`Excluir a conta "${account.name}"?`)) return

  await $fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div>
    <PageHeading
      eyebrow="Financeiro / Contas"
      title="Contas"
      description="Suas contas bancárias e carteiras digitais."
    >
      <template #actions>
        <UiButton @click="openDrawer(null)">
          <template #leading><Plus /></template>
          Nova conta
        </UiButton>
      </template>
    </PageHeading>

    <section class="accounts-summary" aria-label="Saldo total em contas">
      <div>
        <p class="accounts-summary__label">Saldo total em contas</p>
        <p class="accounts-summary__value">
          <UiMoney :value="totalBalance" />
        </p>
      </div>
      <p class="accounts-summary__count">
        {{ accounts.length }}
        {{ accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas' }}
      </p>
    </section>

    <UiSnapCarousel
      v-if="pending"
      class="accounts-list"
      :items="[1, 2, 3, 4, 5, 6]"
      :get-key="(item) => item"
      aria-label="Carregando contas"
      aria-hidden="true"
    >
      <template #default>
        <UiSkeleton height="10rem" radius="md" />
      </template>
    </UiSnapCarousel>

    <UiSnapCarousel
      v-else-if="accounts.length"
      class="accounts-list"
      :items="accounts"
      :get-key="(account) => account.id"
      aria-label="Contas bancárias"
      dots-label="Contas"
    >
      <template #default="{ item: account }">
        <AccountsAccountCard
          :account="account"
          @edit="openDrawer(account)"
          @remove="removeAccount(account)"
        />
      </template>
    </UiSnapCarousel>

    <UiCard v-else padding="none">
      <UiEmptyState
        title="Nenhuma conta cadastrada"
        description="Cadastre a primeira conta para acompanhar saldos e lançamentos."
      >
        <template #icon><WalletCards /></template>
        <template #action>
          <UiButton @click="openDrawer(null)">
            <template #leading><Plus /></template>
            Nova conta
          </UiButton>
        </template>
      </UiEmptyState>
    </UiCard>

    <AccountsAccountFormDrawer
      v-model:open="drawerOpen"
      :account="editingAccount"
      @saved="refresh"
    />
  </div>
</template>

<style scoped>
.accounts-summary {
  display: flex;
  min-height: 6.25rem;
  padding: var(--space-6);
  margin-top: var(--space-6);
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  border: 1px solid var(--color-nav);
  border-radius: var(--radius-md);
  background: linear-gradient(180deg, #1a2740 0%, var(--color-nav) 62%);
  color: var(--color-white);
  box-shadow: var(--shadow-xs);
}

.accounts-summary__label {
  color: #a4b2c8;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.accounts-summary__value {
  margin-top: var(--space-2);
  font-size: clamp(1.5rem, 2vw, var(--text-2xl));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.accounts-summary__count {
  color: #a4b2c8;
  font-size: var(--text-xs);
}

.accounts-list {
  margin-top: var(--space-5);
}

@media (max-width: 900px) {
  .accounts-summary {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
