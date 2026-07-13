<script setup lang="ts">
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  CircleOff,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
} from '@lucide/vue'
import type { Account } from '~/types/account'
import type { EntryOccurrence, EntrySeriesScope } from '~/types/entry'
import { formatDateBr, roundMoney } from '~/utils/dateMoney'
import {
  defaultSortDir,
  entrySortOptions,
  sortEntries,
  type EntrySortKey,
} from '~/utils/sortEntries'

type EntryFilter = 'all' | 'income' | 'expense'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const route = useRoute()
const accountId = computed(() => Number(route.params.id))
const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

const monthKey = computed(
  () =>
    `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)

const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)

const {
  data: account,
  pending: accountPending,
  refresh: refreshAccount,
  error: accountError,
} = await useFetch<Account>(() => `/api/accounts/${accountId.value}`, {
  watch: [accountId],
})

const {
  data: entries,
  pending: entriesPending,
  refresh: refreshEntries,
} = await useFetch<EntryOccurrence[]>(
  () => `/api/entries?accountId=${accountId.value}&month=${monthKey.value}`,
  {
    default: () => [],
    watch: [accountId, monthKey],
  },
)

const drawerOpen = ref(false)
const editingEntry = ref<EntryOccurrence | null>(null)
const deleteDialogOpen = ref(false)
const pendingDeleteEntry = ref<EntryOccurrence | null>(null)
const filter = ref<EntryFilter>('all')
const searchQuery = ref('')
const sortBy = ref<EntrySortKey>('date')
const sortDir = ref<'asc' | 'desc'>(defaultSortDir('date'))

const filterOptions = [
  { value: 'all' as const, label: 'Todos' },
  { value: 'income' as const, label: 'Entradas' },
  { value: 'expense' as const, label: 'Saídas' },
]

const monthEntries = computed(() => entries.value)

const monthSummary = computed(() => {
  let income = 0
  let expense = 0

  for (const entry of monthEntries.value) {
    if (entry.type === 'income') income += entry.amount
    else if (entry.type === 'expense') expense += entry.amount
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
  }
})

const filteredEntries = computed(() => {
  const term = searchQuery.value.trim().toLowerCase()

  const filtered = monthEntries.value.filter((entry) => {
    if (filter.value === 'income' && !isIncoming(entry)) return false
    if (filter.value === 'expense' && !isOutgoing(entry)) return false

    if (!term) return true

    const amountLabel = entry.amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    return (
      entry.description.toLowerCase().includes(term) ||
      (entry.categoryName?.toLowerCase().includes(term) ?? false) ||
      (entry.statementName?.toLowerCase().includes(term) ?? false) ||
      (entry.destinationAccountName?.toLowerCase().includes(term) ?? false) ||
      (entry.accountName?.toLowerCase().includes(term) ?? false) ||
      amountLabel.includes(term) ||
      String(entry.amount).includes(term.replace(',', '.'))
    )
  })

  return sortEntries(filtered, sortBy.value, sortDir.value)
})

watch(sortBy, (key) => {
  sortDir.value = defaultSortDir(key)
})

const heroStyle = computed(() => {
  const color = account.value?.color ?? '#14508f'
  return {
    background: `linear-gradient(135deg, ${color}18 0%, ${color}28 55%, ${color}14 100%)`,
    borderColor: `${color}33`,
  }
})

const isCurrentMonth = computed(() => {
  const now = new Date()
  return (
    selectedYear.value === now.getFullYear() &&
    selectedMonth.value === now.getMonth() + 1
  )
})

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  const now = new Date()
  selectedYear.value = now.getFullYear()
  selectedMonth.value = now.getMonth() + 1
}

async function refreshAll() {
  await Promise.all([refreshAccount(), refreshEntries()])
}

function openCreateDrawer() {
  editingEntry.value = null
  drawerOpen.value = true
}

function openEditDrawer(entry: EntryOccurrence) {
  editingEntry.value = entry
  drawerOpen.value = true
}

watch(drawerOpen, (value) => {
  if (!value) editingEntry.value = null
})

function removeEntry(entry: EntryOccurrence) {
  pendingDeleteEntry.value = entry
  deleteDialogOpen.value = true
}

async function confirmDeleteEntry(scope: EntrySeriesScope) {
  const entry = pendingDeleteEntry.value
  pendingDeleteEntry.value = null
  if (!entry) return
  await $fetch(
    `/api/entries/${entry.id}?scope=${scope}&occurrenceMonth=${entry.occurrenceMonth}`,
    { method: 'DELETE' },
  )
  await refreshAll()
}

function cancelDeleteEntry() {
  pendingDeleteEntry.value = null
}

const deleteDialogDescription = computed(() => {
  const entry = pendingDeleteEntry.value
  if (!entry) return 'Escolha o alcance da exclusão.'
  if (entry.recurrence === 'single') {
    return `Excluir "${entry.description}"?`
  }
  return `Excluir "${entry.description}". Escolha o alcance:`
})

const deleteShowsScope = computed(
  () => pendingDeleteEntry.value?.recurrence !== 'single',
)

async function setPayment(
  entry: EntryOccurrence,
  state: 'auto' | 'paid' | 'unpaid',
) {
  let paymentDate: string | null = null
  if (state === 'paid') {
    const value = window.prompt(
      entry.type === 'income'
        ? 'Data do recebimento (dd/mm/aaaa):'
        : 'Data do pagamento (dd/mm/aaaa):',
      formatDateBr(new Date().toISOString().slice(0, 10)),
    )
    if (!value) return
    const [day, month, year] = value.split('/').map((item) => item.trim())
    paymentDate = `${year}-${month}-${day}`
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      window.alert('Informe uma data válida.')
      return
    }
  }

  await $fetch(`/api/entries/${entry.id}/payment`, {
    method: 'PUT',
    body: {
      occurrenceMonth: entry.occurrenceMonth,
      state,
      paymentDate,
    },
  })
  await refreshAll()
}

function isOutgoing(entry: EntryOccurrence) {
  return (
    entry.type === 'expense' ||
    (entry.type === 'transfer' && entry.transferDirection === 'out')
  )
}

function isIncoming(entry: EntryOccurrence) {
  return (
    entry.type === 'income' ||
    (entry.type === 'transfer' && entry.transferDirection === 'in')
  )
}

function isSettled(entry: EntryOccurrence) {
  return entry.settled
}

function statusLabel(entry: EntryOccurrence) {
  if (entry.type === 'transfer') {
    if (entry.paymentState === 'unpaid') return 'Não liquidada'
    if (entry.settled) return 'Liquidada'
    return 'Pendente'
  }
  if (entry.paymentState === 'unpaid') return 'Não pago'
  if (entry.status === 'received') return 'Recebido'
  if (entry.status === 'paid') return 'Pago'
  return 'Pendente'
}

function entryMeta(entry: EntryOccurrence) {
  const parts = [formatDateBr(entry.date)]

  if (entry.type === 'transfer') {
    if (entry.transferDirection === 'out' && entry.destinationAccountName) {
      parts.push(`Para ${entry.destinationAccountName}`)
    } else if (entry.transferDirection === 'in' && entry.accountName) {
      parts.push(`De ${entry.accountName}`)
    }
    return parts.join(' · ')
  }

  if (entry.recurrence === 'installment' && entry.installmentIndex && entry.installmentCount) {
    parts.push(`${entry.installmentIndex}/${entry.installmentCount}`)
  } else if (entry.recurrence === 'fixed') {
    parts.push('Fixa')
  } else if (entry.categoryName) {
    parts.push(entry.categoryName)
  }

  if (entry.statementName) parts.push(entry.statementName)

  return parts.join(' · ')
}
</script>

<template>
  <div v-if="accountError" class="account-missing">
    <UiEmptyState
      title="Conta não encontrada"
      description="Essa conta pode ter sido removida."
    >
      <template #action>
        <NuxtLink to="/contas">
          <UiButton variant="secondary">
            <template #leading><ArrowLeft /></template>
            Voltar às contas
          </UiButton>
        </NuxtLink>
      </template>
    </UiEmptyState>
  </div>

  <div v-else-if="accountPending || !account">
    <UiSkeleton width="12rem" height="1rem" />
    <UiSkeleton width="18rem" height="2rem" class="account-detail__spacer" />
    <UiSkeleton height="6rem" radius="md" class="account-detail__spacer" />
  </div>

  <div v-else>
    <PageHeading
      eyebrow="Financeiro / Contas"
      :title="account.name"
      :description="account.bankName"
    >
      <template #actions>
        <UiButton variant="secondary" @click="navigateTo('/contas')">
          <template #leading><ArrowLeft /></template>
          Contas
        </UiButton>
        <UiButton @click="openCreateDrawer">
          <template #leading><Plus /></template>
          Novo lançamento
        </UiButton>
      </template>
    </PageHeading>

    <section class="account-hero" :style="heroStyle">
      <div>
        <p class="account-hero__name">{{ account.name }}</p>
        <p class="account-hero__bank">{{ account.bankName }}</p>
        <p class="account-hero__label">Saldo atual</p>
        <p class="account-hero__balance">
          <UiMoney :value="account.balance" />
        </p>
      </div>
      <AccountsBankMark
        :name="account.bankName"
        :color="account.color"
        :bank-key="account.bankKey"
        size="lg"
      />
    </section>

    <section class="account-month" aria-label="Resumo do mês">
      <div class="account-month__nav">
        <UiMonthSwitcher
          :label="monthLabel"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
        />
      </div>

      <div class="account-month__stats">
        <div>
          <p>Entradas</p>
          <strong>
            <UiMoney :value="monthSummary.income" />
          </strong>
        </div>
        <div>
          <p>Saídas</p>
          <strong>
            <UiMoney :value="monthSummary.expense" />
          </strong>
        </div>
        <div>
          <p>Saldo do mês</p>
          <strong
            :class="{ 'account-month__negative': monthSummary.balance < 0 }"
          >
            <UiMoney :value="monthSummary.balance" />
          </strong>
        </div>
      </div>
    </section>

    <section class="account-entries" aria-label="Lançamentos">
      <UiCard padding="none">
        <header class="account-entries__toolbar">
          <div class="account-entries__filters">
            <h2 class="sr-only">Lançamentos</h2>
            <UiSegmentedControl v-model="filter" :options="filterOptions" />
            <UiSegmentedControl
              v-model="sortBy"
              :options="entrySortOptions"
              aria-label="Ordenar lançamentos"
            />
            <p class="account-entries__count">
              {{ filteredEntries.length }}
              {{ filteredEntries.length === 1 ? 'item' : 'itens' }}
            </p>
          </div>

          <div class="account-entries__search">
            <Search aria-hidden="true" />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Buscar por descrição ou valor..."
              aria-label="Buscar lançamentos"
            />
          </div>
        </header>

        <div v-if="entriesPending" class="account-entries__loading">
          <UiSkeleton v-for="index in 4" :key="index" height="4.25rem" />
        </div>

        <UiList v-else-if="filteredEntries.length">
          <UiListItem
            v-for="entry in filteredEntries"
            :key="entry.occurrenceKey"
            class="entry-row"
            :class="{ 'entry-row--settled': isSettled(entry) }"
            interactive
          >
            <div class="entry-row__icon" aria-hidden="true">
              <span
                v-if="entry.type === 'transfer'"
                class="entry-row__fallback entry-row__fallback--transfer"
              >
                <ArrowLeftRight />
              </span>
              <CategoriesCategoryIconChip
                v-else-if="entry.categoryIcon && entry.categoryColor"
                :icon="entry.categoryIcon"
                :color="entry.categoryColor"
              />
              <span v-else class="entry-row__fallback">
                <Receipt />
              </span>
            </div>

            <div class="entry-row__main">
              <p>{{ entry.description }}</p>
              <span>{{ entryMeta(entry) }}</span>
            </div>

            <div
              class="entry-row__status"
              :class="{
                'entry-row__status--pending': !entry.settled,
                'entry-row__status--unpaid': entry.paymentState === 'unpaid',
              }"
            >
              <template v-if="statusLabel(entry)">
                <span>{{ statusLabel(entry) }}</span>
                <CheckCircle2 aria-hidden="true" />
              </template>
            </div>

            <p
              class="entry-row__amount"
              :class="{
                'entry-row__amount--expense': isOutgoing(entry),
                'entry-row__amount--transfer': entry.type === 'transfer',
              }"
            >
              {{ isOutgoing(entry) ? '−' : '+' }}
              <UiMoney :value="entry.amount" />
            </p>

            <div class="entry-row__actions">
              <button
                v-if="!entry.settled"
                type="button"
                :aria-label="
                  entry.type === 'income'
                    ? 'Marcar como recebido'
                    : 'Marcar como pago'
                "
                :title="
                  entry.type === 'income'
                    ? 'Marcar como recebido'
                    : 'Marcar como pago'
                "
                @click="setPayment(entry, 'paid')"
              >
                <CheckCircle2 aria-hidden="true" />
              </button>
              <button
                v-if="entry.paymentState !== 'unpaid'"
                type="button"
                aria-label="Marcar como não pago"
                title="Marcar como não pago"
                @click="setPayment(entry, 'unpaid')"
              >
                <CircleOff aria-hidden="true" />
              </button>
              <button
                v-if="entry.paymentState !== 'auto'"
                type="button"
                aria-label="Voltar ao estado automático"
                title="Voltar ao estado automático"
                @click="setPayment(entry, 'auto')"
              >
                <RotateCcw aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Editar lançamento"
                title="Editar lançamento"
                @click="openEditDrawer(entry)"
              >
                <Pencil aria-hidden="true" />
              </button>
              <button
                type="button"
                class="entry-row__delete"
                aria-label="Excluir lançamento"
                @click="removeEntry(entry)"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </UiListItem>
        </UiList>

        <UiEmptyState
          v-else
          :title="
            monthEntries.length
              ? 'Nenhum lançamento encontrado'
              : 'Nenhum lançamento neste mês'
          "
          :description="
            monthEntries.length
              ? 'Ajuste os filtros ou a busca para ver outros resultados.'
              : 'Registre uma receita ou despesa para este período.'
          "
        >
          <template #icon><Receipt /></template>
          <template v-if="!monthEntries.length" #action>
            <UiButton @click="openCreateDrawer">
              <template #leading><Plus /></template>
              Novo lançamento
            </UiButton>
          </template>
        </UiEmptyState>
      </UiCard>
    </section>

    <AccountsEntryFormDrawer
      v-model:open="drawerOpen"
      :account="account"
      :entry="editingEntry"
      @saved="refreshAll"
    />
    <UiSeriesScopeDialog
      v-model:open="deleteDialogOpen"
      title="Excluir lançamento"
      :description="deleteDialogDescription"
      :show-scope-options="deleteShowsScope"
      confirm-label="Excluir"
      @confirm="confirmDeleteEntry"
      @cancel="cancelDeleteEntry"
    />
  </div>
</template>

<style scoped>
.account-detail__spacer {
  margin-top: var(--space-4);
}

.account-missing {
  margin-top: var(--space-8);
}

.account-hero {
  display: flex;
  min-height: 8.5rem;
  padding: var(--space-6);
  margin-top: var(--space-6);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.account-hero__name {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.account-hero__bank {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.account-hero__label {
  margin-top: var(--space-5);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.account-hero__balance {
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: clamp(1.5rem, 2vw, var(--text-2xl));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.account-month {
  margin-top: var(--space-5);
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.account-month__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.account-month__stats {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.account-month__stats p {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.account-month__stats strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.account-month__negative {
  color: var(--color-negative-ink);
}

.account-entries {
  margin-top: var(--space-5);
}

.account-entries__toolbar {
  display: flex;
  padding: var(--space-4) var(--space-5);
  flex-direction: column;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.account-entries__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.account-entries__count {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.account-entries__search {
  display: flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.account-entries__search:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.account-entries__search svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.account-entries__search input {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.account-entries__search input:focus {
  outline: none;
}

.account-entries__loading {
  display: grid;
  padding: var(--space-4) var(--space-5);
  gap: var(--space-3);
}

.entry-row {
  display: grid;
  min-height: 4.5rem;
  padding: var(--space-3) var(--space-5);
  grid-template-columns: 2.25rem minmax(12rem, 1fr) 6.5rem 7.5rem auto;
  align-items: center;
  gap: var(--space-3);
}

.entry-row__icon {
  display: grid;
  place-items: center;
}

.entry-row__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.entry-row__fallback--transfer {
  border-color: color-mix(in srgb, var(--color-brand) 35%, var(--color-border));
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.entry-row__fallback svg {
  width: 1rem;
  height: 1rem;
}

.entry-row__main {
  min-width: 0;
}

.entry-row__main p {
  overflow: hidden;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-row__main span {
  display: block;
  overflow: hidden;
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-row__status {
  display: flex;
  min-height: 1.25rem;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  color: var(--color-positive-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.entry-row__status svg {
  width: 0.95rem;
  height: 0.95rem;
}

.entry-row__status--pending {
  color: var(--color-ink-muted);
}

.entry-row__status--unpaid {
  color: var(--color-negative-ink);
}

.entry-row__amount {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0.25rem;
  color: var(--color-positive-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.entry-row__amount--expense {
  color: var(--color-negative-ink);
}

.entry-row__actions {
  display: flex;
  gap: 0.125rem;
}

.entry-row__actions button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.entry-row__actions button:hover:not(:disabled) {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.entry-row__actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.entry-row__actions .entry-row__delete:hover:not(:disabled) {
  color: var(--color-negative);
}

.entry-row__actions svg {
  width: 0.9rem;
  height: 0.9rem;
}

.entry-row--settled .entry-row__main p,
.entry-row--settled .entry-row__main span {
  color: var(--color-ink-muted);
  text-decoration: line-through;
}

.entry-row--settled .entry-row__amount {
  opacity: 0.72;
}
</style>
