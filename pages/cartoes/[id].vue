<script setup lang="ts">
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  PieChart,
  Plus,
  Search,
  SlidersHorizontal,
  Wallet,
} from '@lucide/vue'
import type { Card } from '~/types/card'
import type { CardExpenseSaveResult } from '~/types/cardExpense'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import type { EntrySeriesScope } from '~/types/entry'
import type { SpendingGuardReport } from '~/types/spendingGuard'
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'
import { formatDateBr, roundMoney } from '~/utils/dateMoney'
import {
  defaultSortDir,
  entrySortOptions,
  groupEntriesByCategory,
  sortEntries,
  type EntrySortKey,
} from '~/utils/sortEntries'

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
const cardId = computed(() => Number(route.params.id))
const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)
const invoiceMonthInitialized = ref(false)
const searchQuery = ref('')
const sortBy = ref<EntrySortKey>('date')
const sortDir = ref<'asc' | 'desc'>(defaultSortDir('date'))
const expandedCategoryKeys = ref<string[]>([])
const invoiceSectionRef = ref<HTMLElement | null>(null)
const expenseDrawerOpen = ref(false)
const adjustmentDrawerOpen = ref(false)
const paymentDrawerOpen = ref(false)
const deleteDialogOpen = ref(false)
const pendingDeleteExpense = ref<CardInvoiceDetail['entries'][number] | null>(
  null,
)
const editingExpense = ref<CardInvoiceDetail['entries'][number] | null>(null)
const duplicatingExpense = ref<CardInvoiceDetail['entries'][number] | null>(
  null,
)
const spendingImpact = ref<{
  report: SpendingGuardReport
  purchase: CardExpenseSaveResult
} | null>(null)

function todayIsoLocal() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function setMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return
  selectedYear.value = year
  selectedMonth.value = month
}

function selectProjectionMonth(key: string) {
  setMonthKey(key)
  nextTick(() => {
    invoiceSectionRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}

function currentInvoiceMonthKey(closingDay: number) {
  return transacaoFaturaMonth(todayIsoLocal(), closingDay)
}

const monthKey = computed(
  () =>
    `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)

const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)

const {
  data: card,
  pending: cardPending,
  error: cardError,
  refresh: refreshCard,
} = await useFetch<Card>(() => `/api/cards/${cardId.value}`, {
  watch: [cardId],
})

const isCurrentMonth = computed(() => {
  if (!card.value) return false
  return monthKey.value === currentInvoiceMonthKey(card.value.closingDay)
})

watch(
  card,
  (value) => {
    if (!value || invoiceMonthInitialized.value) return
    const queryMonth = route.query.month
    if (typeof queryMonth === 'string' && /^\d{4}-\d{2}$/.test(queryMonth)) {
      setMonthKey(queryMonth)
    } else {
      setMonthKey(currentInvoiceMonthKey(value.closingDay))
    }
    invoiceMonthInitialized.value = true
  },
  { immediate: true },
)

watch(cardId, () => {
  invoiceMonthInitialized.value = false
})

const {
  data: invoice,
  pending: invoicePending,
  refresh: refreshInvoice,
} = await useFetch<CardInvoiceDetail>(
  () => `/api/cards/${cardId.value}/invoice?month=${monthKey.value}`,
  {
    watch: [cardId, monthKey],
    default: () => null,
  },
)

const projectionTotal = computed(() =>
  roundMoney(
    (invoice.value?.projection ?? []).reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
  ),
)

const categoryGradient = computed(() => {
  const categories = invoice.value?.categories ?? []
  if (!categories.length) return 'conic-gradient(var(--color-border) 0 100%)'

  let cursor = 0
  const stops: string[] = []
  for (const category of categories) {
    const next = cursor + category.percent
    stops.push(`${category.color} ${cursor}% ${next}%`)
    cursor = next
  }
  if (cursor < 100) {
    stops.push(`var(--color-border) ${cursor}% 100%`)
  }
  return `conic-gradient(${stops.join(', ')})`
})

const CATEGORY_VISIBLE_LIMIT = 6

const visibleCategories = computed(() => {
  const categories = invoice.value?.categories ?? []
  if (categories.length <= CATEGORY_VISIBLE_LIMIT) return categories

  const head = categories.slice(0, CATEGORY_VISIBLE_LIMIT - 1)
  const rest = categories.slice(CATEGORY_VISIBLE_LIMIT - 1)
  const amount = roundMoney(rest.reduce((sum, item) => sum + item.amount, 0))
  const percent = rest.reduce((sum, item) => sum + item.percent, 0)
  return [
    ...head,
    {
      id: '__others__',
      name: `+${rest.length} categorias`,
      color: '#9aa3af',
      amount,
      percent,
    },
  ]
})

const filteredBase = computed(() => {
  const entries = invoice.value?.entries ?? []
  const term = searchQuery.value.trim().toLowerCase()
  if (!term) return entries

  return entries.filter((entry) => {
    const amount = entry.amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    return (
      entry.description.toLowerCase().includes(term) ||
      (entry.categoryName?.toLowerCase().includes(term) ?? false) ||
      (entry.notes?.toLowerCase().includes(term) ?? false) ||
      amount.includes(term)
    )
  })
})

const filteredEntries = computed(() =>
  sortEntries(
    filteredBase.value,
    sortBy.value === 'category' ? 'date' : sortBy.value,
    sortBy.value === 'category' ? 'desc' : sortDir.value,
  ),
)

const categoryGroups = computed(() =>
  groupEntriesByCategory(filteredBase.value),
)

const showCategoryGroups = computed(() => sortBy.value === 'category')

watch(sortBy, (key) => {
  sortDir.value = defaultSortDir(key)
  if (key === 'category') {
    const first = categoryGroups.value[0]
    expandedCategoryKeys.value = first ? [first.key] : []
  }
})

function isCategoryExpanded(key: string) {
  return expandedCategoryKeys.value.includes(key)
}

function toggleCategory(key: string) {
  if (isCategoryExpanded(key)) {
    expandedCategoryKeys.value = expandedCategoryKeys.value.filter(
      (item) => item !== key,
    )
    return
  }
  expandedCategoryKeys.value = [...expandedCategoryKeys.value, key]
}

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  if (!card.value) return
  setMonthKey(currentInvoiceMonthKey(card.value.closingDay))
}

async function onExpenseSaved(result: CardExpenseSaveResult) {
  if (result.invoiceMonth) setMonthKey(result.invoiceMonth)
  await Promise.all([refreshInvoice(), refreshCard()])

  if (
    result.isEditing ||
    result.purchaseDate.slice(0, 7) !== todayIsoLocal().slice(0, 7)
  ) {
    return
  }

  try {
    const report = await $fetch<SpendingGuardReport>('/api/spending-guard')
    spendingImpact.value = { report, purchase: result }
  } catch {
    // O lançamento já foi salvo; uma falha no resumo não deve afetar o fluxo.
    spendingImpact.value = null
  }
}

function statusTone(status: CardInvoiceDetail['status']) {
  if (status === 'open') return 'warning'
  if (status === 'overdue') return 'negative'
  if (status === 'paid') return 'positive'
  return 'neutral'
}

function openExpenseDrawer(
  expense: CardInvoiceDetail['entries'][number] | null,
) {
  duplicatingExpense.value = null
  editingExpense.value = expense
  expenseDrawerOpen.value = true
}

function openDuplicateDrawer(
  expense: CardInvoiceDetail['entries'][number],
) {
  editingExpense.value = null
  duplicatingExpense.value = expense
  expenseDrawerOpen.value = true
}

watch(expenseDrawerOpen, (value) => {
  if (!value) {
    editingExpense.value = null
    duplicatingExpense.value = null
  }
})

function removeExpense(expense: CardInvoiceDetail['entries'][number]) {
  pendingDeleteExpense.value = expense
  deleteDialogOpen.value = true
}

async function confirmDeleteExpense(scope: EntrySeriesScope) {
  const expense = pendingDeleteExpense.value
  pendingDeleteExpense.value = null
  if (!expense) return
  await $fetch(
    `/api/cards/${cardId.value}/expenses/${expense.parentId}?scope=${scope}&occurrenceMonth=${expense.occurrenceMonth}`,
    { method: 'DELETE' },
  )
  await refreshInvoice()
}

function cancelDeleteExpense() {
  pendingDeleteExpense.value = null
}

const deleteDialogDescription = computed(() => {
  const expense = pendingDeleteExpense.value
  if (!expense) return 'Escolha o alcance da exclusão.'
  if (expense.recurrence === 'single') {
    return `Excluir "${expense.description}"?`
  }
  return `Excluir "${expense.description}". Escolha o alcance:`
})

const deleteShowsScope = computed(
  () => pendingDeleteExpense.value?.recurrence !== 'single',
)

async function onPaymentSaved() {
  await Promise.all([refreshInvoice(), refreshCard()])
}
</script>

<template>
  <div>
    <div v-if="cardError" class="card-missing">
      <UiEmptyState
        title="Cartão não encontrado"
        description="Esse cartão pode ter sido removido."
      >
        <template #action>
          <NuxtLink to="/cartoes">
            <UiButton variant="secondary">
              <template #leading><ArrowLeft /></template>
              Voltar aos cartões
            </UiButton>
          </NuxtLink>
        </template>
      </UiEmptyState>
    </div>

    <div v-else-if="cardPending || !card" class="card-detail-page">
      <UiSkeleton width="14rem" height="1rem" />
      <UiSkeleton width="20rem" height="2rem" />
      <UiSkeleton height="10rem" radius="md" />
      <UiSkeleton height="8rem" radius="md" />
    </div>

    <div v-else class="card-detail-page">
      <header class="card-detail-header">
        <div>
          <button
            type="button"
            class="card-detail-header__back"
            @click="navigateTo('/cartoes')"
          >
            <ArrowLeft aria-hidden="true" />
            <span>{{ card.name }}</span>
          </button>
          <p class="card-detail-header__meta">
            {{ card.bankName }}
            <span aria-hidden="true">•</span>
            Vence dia {{ card.dueDay }}
            <span aria-hidden="true">•</span>
            Fechamento dia {{ card.closingDay }}
          </p>
        </div>
        <UiButton @click="openExpenseDrawer(null)">
          <template #leading><Plus /></template>
          Nova despesa
        </UiButton>
      </header>

      <DashboardSpendingImpactNotice
        v-if="spendingImpact"
        :report="spendingImpact.report"
        :purchase="spendingImpact.purchase"
        @close="spendingImpact = null"
      />

      <section
        class="card-face"
        :style="{
          background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}d6 100%)`,
        }"
        aria-label="Resumo do cartão"
      >
        <div class="card-face__top">
          <div>
            <p>{{ card.bankName }}</p>
            <strong>{{ card.name }}</strong>
            <span v-if="card.lastFour">•••• {{ card.lastFour }}</span>
          </div>
          <AccountsBankMark
            :name="card.bankName"
            :color="card.color"
            :bank-key="card.bankKey"
          />
        </div>
        <div class="card-face__bottom">
          <div>
            <p>Limite</p>
            <strong><UiMoney :value="card.creditLimit" /></strong>
          </div>
          <div class="card-face__closing">
            <p>Fechamento</p>
            <strong>Dia {{ card.closingDay }}</strong>
          </div>
        </div>
      </section>

      <div class="card-insights">
        <UiCard>
          <p class="card-insights__label">Quitação estimada</p>
          <p class="card-insights__value">
            {{ invoice?.estimatedPayoffLabel ?? 'Sem previsão' }}
          </p>
          <p class="card-insights__hint">Mês da última fatura</p>
        </UiCard>
        <UiCard>
          <p class="card-insights__label">Faturas residuais a partir de</p>
          <p class="card-insights__value">
            {{ invoice?.residualInvoicesFrom ?? '—' }}
          </p>
          <p class="card-insights__hint">≤ 15% da média ou &lt; R$ 150</p>
        </UiCard>
      </div>

      <UiCard class="card-projection">
        <CardsInvoiceProjectionChart
          :items="invoice?.projection ?? []"
          :total="projectionTotal"
          :active-month="monthKey"
          @select="selectProjectionMonth"
        />
      </UiCard>

      <div ref="invoiceSectionRef" class="card-invoice-anchor">
        <div class="card-month-nav">
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

        <UiCard v-if="invoicePending && !invoice" class="card-invoice">
          <UiSkeleton width="8rem" height="0.9rem" />
          <UiSkeleton
            width="10rem"
            height="2rem"
            class="card-detail-page__gap"
          />
          <UiSkeleton
            height="0.4rem"
            radius="sm"
            class="card-detail-page__gap"
          />
        </UiCard>

        <UiCard v-else-if="invoice" class="card-invoice">
        <div class="card-invoice__top">
          <div>
            <p class="card-invoice__label">Fatura de {{ invoice.monthLabel }}</p>
            <p class="card-invoice__total">
              <UiMoney :value="invoice.total" />
            </p>
            <div
              v-if="invoice.adjustment !== 0"
              class="card-invoice__adjustment"
            >
              <div class="card-invoice__adjustment-row">
                <span>Calculado</span>
                <strong>
                  <UiMoney :value="invoice.entriesSubtotal" />
                </strong>
              </div>
              <div class="card-invoice__adjustment-row">
                <span>Ajuste</span>
                <strong
                  :class="{
                    'is-credit': invoice.adjustment < 0,
                    'is-debit': invoice.adjustment > 0,
                  }"
                >
                  {{ invoice.adjustment > 0 ? '+' : '−' }}
                  <UiMoney :value="Math.abs(invoice.adjustment)" />
                </strong>
              </div>
            </div>
            <p
              v-if="invoice.payment"
              class="card-invoice__payment-meta"
            >
              Paga em {{ formatDateBr(invoice.payment.paymentDate) }}
              · {{ invoice.payment.accountName }}
            </p>
            <span
              class="card-invoice__status"
              :class="`card-invoice__status--${statusTone(invoice.status)}`"
            >
              {{ invoice.statusLabel }}
            </span>
          </div>
          <div class="card-invoice__dates">
            <p>Fechamento: dia {{ invoice.closingDay }}</p>
            <p>Vencimento: dia {{ invoice.dueDay }}</p>
          </div>
        </div>

        <div class="card-invoice__limit">
          <div class="card-invoice__limit-row">
            <span>Limite comprometido</span>
            <strong>
              <UiMoney :value="invoice.usedAmount" />
              /
              <UiMoney :value="invoice.creditLimit" />
              • {{ invoice.usedPercent }}%
            </strong>
          </div>
          <div class="card-invoice__bar" aria-hidden="true">
            <span :style="{ width: `${invoice.usedPercent}%` }" />
          </div>
          <p>
            Disponível:
            <UiMoney :value="invoice.availableAmount" />
          </p>
        </div>

        <div class="card-invoice__actions">
          <UiButton
            v-if="invoice.status !== 'paid'"
            variant="secondary"
            @click="adjustmentDrawerOpen = true"
          >
            <template #leading><SlidersHorizontal /></template>
            Ajuste
          </UiButton>
          <UiButton
            v-if="invoice.status !== 'paid' && invoice.total > 0"
            @click="paymentDrawerOpen = true"
          >
            <template #leading><Wallet /></template>
            Pagar fatura
          </UiButton>
        </div>
      </UiCard>
      </div>

      <UiCard class="card-categories">
        <div class="card-categories__heading">
          <h2>Gastos por categoria</h2>
          <p>{{ invoice?.monthLabel ?? monthLabel }}</p>
        </div>

        <div
          v-if="invoice?.categories.length"
          class="card-categories__body"
        >
          <div
            class="card-categories__donut"
            :style="{ background: categoryGradient }"
            aria-hidden="true"
          >
            <span />
          </div>
          <ul>
            <li
              v-for="category in visibleCategories"
              :key="category.id"
            >
              <span
                class="card-categories__dot"
                :style="{ background: category.color }"
              />
              <strong>{{ category.name }}</strong>
              <div class="card-categories__values">
                <span class="numeric"
                  ><UiMoney :value="category.amount"
                /></span>
                <span>{{ category.percent }}%</span>
              </div>
            </li>
          </ul>
        </div>

        <UiEmptyState
          v-else
          title="Sem gastos neste mês"
          description="Quando houver compras nesta competência, o resumo por categoria aparece aqui."
        >
          <template #icon><PieChart /></template>
        </UiEmptyState>
      </UiCard>

      <UiCard class="card-entries" padding="none">
        <div class="card-entries__header">
          <div>
            <h2>Lançamentos</h2>
            <p>
              {{ filteredEntries.length }}
              {{ filteredEntries.length === 1 ? 'item' : 'itens' }}
            </p>
          </div>
          <UiSegmentedControl
            v-model="sortBy"
            :options="entrySortOptions"
            aria-label="Ordenar lançamentos"
          />
        </div>

        <div class="card-entries__search">
          <Search aria-hidden="true" />
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Buscar por descrição ou valor..."
            aria-label="Buscar lançamentos"
          />
        </div>

        <div v-if="filteredEntries.length && showCategoryGroups" class="card-entry-groups">
          <section
            v-for="group in categoryGroups"
            :key="group.key"
            class="card-entry-group"
          >
            <button
              type="button"
              class="card-entry-group__header"
              :aria-expanded="isCategoryExpanded(group.key)"
              @click="toggleCategory(group.key)"
            >
              <span class="card-entry-group__icon" aria-hidden="true">
                <CategoriesCategoryIconChip
                  v-if="group.categoryIcon && group.categoryColor"
                  :icon="group.categoryIcon"
                  :color="group.categoryColor"
                />
                <span v-else class="card-entry-group__fallback">?</span>
              </span>
              <span class="card-entry-group__meta">
                <strong>{{ group.name }}</strong>
                <span>
                  {{ group.entries.length }}
                  {{ group.entries.length === 1 ? 'item' : 'itens' }}
                </span>
              </span>
              <strong class="card-entry-group__total">
                <UiMoney :value="group.total" />
              </strong>
              <ChevronDown
                class="card-entry-group__chevron"
                :class="{
                  'card-entry-group__chevron--open': isCategoryExpanded(
                    group.key,
                  ),
                }"
                aria-hidden="true"
              />
            </button>
            <div
              v-show="isCategoryExpanded(group.key)"
              class="card-entry-group__body"
            >
              <CardsCardInvoiceEntryRow
                v-for="entry in group.entries"
                :key="entry.id"
                :entry="entry"
                compact
                @duplicate="openDuplicateDrawer(entry)"
                @edit="openExpenseDrawer(entry)"
                @remove="removeExpense(entry)"
              />
            </div>
          </section>
        </div>

        <UiList v-else-if="filteredEntries.length">
          <UiListItem
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="card-entry-wrap"
          >
            <CardsCardInvoiceEntryRow
              :entry="entry"
              @duplicate="openDuplicateDrawer(entry)"
              @edit="openExpenseDrawer(entry)"
              @remove="removeExpense(entry)"
            />
          </UiListItem>
        </UiList>

        <UiEmptyState
          v-else
          title="Nenhum lançamento neste mês"
          description="Adicione uma despesa ou troque o mês para consultar outra fatura."
        >
          <template #icon><CreditCard /></template>
          <template #action>
            <UiButton @click="openExpenseDrawer(null)">
              <template #leading><Plus /></template>
              Nova despesa
            </UiButton>
          </template>
        </UiEmptyState>
      </UiCard>

      <CardsCardExpenseFormDrawer
        v-model:open="expenseDrawerOpen"
        :card="card"
        :expense="editingExpense"
        :duplicate-from="duplicatingExpense"
        @saved="onExpenseSaved"
      />
      <CardsCardInvoiceAdjustmentDrawer
        v-if="invoice"
        v-model:open="adjustmentDrawerOpen"
        :card="card"
        :invoice="invoice"
        @saved="refreshInvoice"
      />
      <CardsCardInvoicePaymentDrawer
        v-if="invoice"
        v-model:open="paymentDrawerOpen"
        :card="card"
        :invoice="invoice"
        @saved="onPaymentSaved"
      />
      <UiSeriesScopeDialog
        v-model:open="deleteDialogOpen"
        title="Excluir despesa"
        :description="deleteDialogDescription"
        :show-scope-options="deleteShowsScope"
        confirm-label="Excluir"
        @confirm="confirmDeleteExpense"
        @cancel="cancelDeleteExpense"
      />
    </div>
  </div>
</template>

<style scoped>
.card-detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.card-detail-page__gap {
  margin-top: var(--space-3);
}

.card-missing {
  margin-top: var(--space-8);
}

.card-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-detail-header__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
  cursor: pointer;
}

.card-detail-header__back svg {
  width: 1.15rem;
  height: 1.15rem;
  color: var(--color-ink-muted);
}

.card-detail-header__meta {
  display: flex;
  flex-wrap: wrap;
  margin-top: var(--space-2);
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.card-face {
  display: flex;
  min-height: 10rem;
  padding: var(--space-6);
  flex-direction: column;
  justify-content: space-between;
  border-radius: var(--radius-lg);
  color: white;
  box-shadow: var(--shadow-sm);
}

.card-face__top,
.card-face__bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-face__top p,
.card-face__bottom p {
  font-size: var(--text-xs);
  opacity: 0.85;
}

.card-face__top strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.card-face__top span {
  display: block;
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  opacity: 0.9;
}

.card-face__bottom strong {
  display: block;
  margin-top: 0.2rem;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.card-face__closing {
  text-align: right;
}

.card-insights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.card-insights__label {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-insights__value {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.card-insights__hint {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.card-projection__heading h2,
.card-categories__heading h2,
.card-entries__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.card-categories__heading p,
.card-entries__header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-month-nav {
  display: flex;
  justify-content: flex-start;
}

.card-invoice-anchor {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  scroll-margin-top: var(--space-6);
}

.card-invoice__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-invoice__label {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-invoice__total {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: clamp(1.5rem, 2vw, var(--text-2xl));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.card-invoice__status {
  display: inline-flex;
  margin-top: var(--space-3);
  padding: 0.3rem 0.55rem;
  border-radius: var(--radius-round);
  font-size: 0.6875rem;
  font-weight: var(--weight-semibold);
}

.card-invoice__status--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.card-invoice__status--positive {
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
}

.card-invoice__status--negative {
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.card-invoice__status--neutral {
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.card-invoice__dates {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  text-align: right;
}

.card-invoice__dates p + p {
  margin-top: var(--space-1);
}

.card-invoice__limit {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.card-invoice__limit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.card-invoice__limit-row strong {
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.card-invoice__bar {
  overflow: hidden;
  height: 0.4rem;
  margin: var(--space-3) 0 var(--space-2);
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.card-invoice__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}

.card-invoice__limit > p {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.card-invoice__adjustment {
  display: flex;
  width: fit-content;
  max-width: 100%;
  margin: var(--space-3) 0;
  padding: var(--space-3) var(--space-4);
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.card-invoice__adjustment-row {
  display: flex;
  min-width: 11rem;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-invoice__adjustment-row span {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.card-invoice__adjustment-row strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.card-invoice__adjustment-row strong.is-credit {
  color: var(--color-positive-ink);
}

.card-invoice__adjustment-row strong.is-debit {
  color: var(--color-negative-ink);
}

.card-invoice__payment-meta {
  margin: var(--space-2) 0;
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.card-invoice__actions {
  display: flex;
  margin-top: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-2);
}

.card-categories__heading {
  margin-bottom: var(--space-3);
}

.card-categories__body {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: var(--space-5);
  align-items: center;
}

.card-categories__donut {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
}

.card-categories__donut span {
  position: absolute;
  inset: 1.1rem;
  border-radius: 50%;
  background: var(--color-surface);
}

.card-categories__body ul {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: 0.55rem;
  list-style: none;
}

.card-categories__body li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.card-categories__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-categories__body strong {
  min-width: 0;
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-categories__values {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--space-2);
  white-space: nowrap;
}

.card-categories__values span:first-child {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.card-categories__values span:last-child {
  min-width: 2.25rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-align: right;
}

.card-entries__header,
.card-entries__search {
  padding: var(--space-5) var(--space-5) 0;
}

.card-entries__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-entries__search {
  display: flex;
  margin-top: var(--space-4);
  padding-bottom: var(--space-4);
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.card-entries__search svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
  flex-shrink: 0;
}

.card-entries__search input {
  width: 100%;
  min-height: 2.25rem;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.card-entries__search input:focus {
  outline: none;
}

.card-entry-wrap :deep(.card-entry) {
  border-bottom: 0;
}

.card-entry-wrap + .card-entry-wrap {
  border-top: 1px solid var(--color-border);
}

.card-entry-groups {
  border-top: 1px solid var(--color-border);
}

.card-entry-group + .card-entry-group {
  border-top: 1px solid var(--color-border);
}

.card-entry-group__header {
  display: flex;
  width: 100%;
  padding: var(--space-4) var(--space-5);
  align-items: center;
  gap: var(--space-3);
  border: 0;
  background: var(--color-surface);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.card-entry-group__header:hover {
  background: var(--color-surface-subtle);
}

.card-entry-group__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
}

.card-entry-group__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.card-entry-group__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.card-entry-group__meta strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.card-entry-group__meta span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-entry-group__total {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.card-entry-group__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--color-ink-muted);
  transition: transform var(--transition-fast);
}

.card-entry-group__chevron--open {
  transform: rotate(180deg);
}

.card-entry-group__body {
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.card-entry-group__body :deep(.card-entry:last-child) {
  border-bottom: 0;
}

@media (max-width: 860px) {
  .card-insights,
  .card-categories__body {
    grid-template-columns: 1fr;
  }

  .card-invoice__top {
    flex-direction: column;
  }

  .card-invoice__dates {
    text-align: left;
  }

  .card-entry-group__body :deep(.card-entry--compact) {
    padding-left: var(--space-5);
  }

  .card-month-nav {
    width: 100%;
  }

  .card-month-nav :deep(.month-switcher) {
    width: 100%;
  }

  .card-entry-group__header {
    gap: var(--space-2);
  }

  .card-entry-group__total {
    font-size: var(--text-sm);
  }
}
</style>
