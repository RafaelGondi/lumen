<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Receipt,
} from '@lucide/vue'
import type { BankKey } from '~/types/account'
import type { CashFlowDay, CashFlowMovement, CashFlowReport } from '~/types/cashFlow'

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

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)
const selectedDate = ref<string | null>(null)

const monthKey = computed(
  () =>
    `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)

const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)

const isCurrentMonth = computed(() => {
  const today = new Date()
  return (
    selectedYear.value === today.getFullYear() &&
    selectedMonth.value === today.getMonth() + 1
  )
})

const {
  data: report,
  pending,
  error,
} = await useFetch<CashFlowReport>(
  () => `/api/reports/cash-flow?month=${monthKey.value}`,
  {
    watch: [monthKey],
    default: () => null,
  },
)

watch(
  report,
  (value) => {
    if (!value?.days.length) {
      selectedDate.value = null
      return
    }
    const today = value.days.find((day) => day.isToday)
    selectedDate.value = today?.date ?? value.days[0]!.date
  },
  { immediate: true },
)

const selectedDay = computed<CashFlowDay | null>(() => {
  if (!report.value || !selectedDate.value) return null
  return (
    report.value.days.find((day) => day.date === selectedDate.value) ?? null
  )
})

const criticalDays = computed(
  () => report.value?.days.filter((day) => day.isCritical) ?? [],
)

const kpiCards = computed(() => {
  if (!report.value) return []
  type Tone = 'neutral' | 'positive' | 'negative'
  const cards: {
    key: string
    label: string
    value: number
    support: string
    tone: Tone
  }[] = [
    {
      key: 'opening',
      label: 'Saldo inicial',
      value: report.value.openingBalance,
      support: 'Dia 1',
      tone: 'neutral',
    },
  ]

  if (report.value.monthKind === 'current' && report.value.todayBalance !== null) {
    cards.push({
      key: 'today',
      label: 'Saldo hoje',
      value: report.value.todayBalance,
      support: 'Consolidado real',
      tone: report.value.todayBalance >= 0 ? 'positive' : 'negative',
    })
  }

  cards.push({
    key: 'worst',
    label: 'Pior saldo',
    value: report.value.worstBalance,
    support: `Dia ${report.value.worstDay}`,
    tone: report.value.worstBalance >= 0 ? 'positive' : 'negative',
  })

  cards.push({
    key: 'closing',
    label: 'Saldo fim do mês',
    value: report.value.closingBalance,
    support:
      report.value.closingDelta === 0
        ? 'Sem variação vs início'
        : `${report.value.closingDelta > 0 ? '+' : ''}${formatMoney(report.value.closingDelta)} vs início`,
    tone: report.value.closingBalance >= 0 ? 'positive' : 'negative',
  })

  return cards
})

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  const today = new Date()
  selectedYear.value = today.getFullYear()
  selectedMonth.value = today.getMonth() + 1
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function dayTitle(day: CashFlowDay) {
  const [, m, d] = day.date.split('-')
  const monthShort = MONTH_NAMES[Number(m) - 1]!.slice(0, 3).toLowerCase()
  return `Dia ${day.day} — ${Number(d)} ${monthShort}`
}

function movementIcon(type: CashFlowDay['movements'][number]['type']) {
  if (type === 'income') return ArrowUpRight
  if (type === 'card_invoice') return CreditCard
  if (type === 'expense') return ArrowDownRight
  return ArrowLeftRight
}

function movementMeta(movement: CashFlowMovement) {
  const parts = [movement.statusLabel]
  if (movement.categoryName) parts.push(movement.categoryName)
  if (movement.accountLabel) parts.push(movement.accountLabel)
  return parts.join(' · ')
}
</script>

<template>
  <div class="reports-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Relatórios"
      description="Análise detalhada das suas finanças"
    >
      <template #actions>
        <UiMonthSwitcher
          :label="report?.fullLabel ?? monthLabel"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
        />
      </template>
    </PageHeading>

    <ReportsReportTabs />

    <div v-if="error" class="reports-page__error">
      <UiEmptyState
        title="Não foi possível carregar o fluxo"
        description="Tente novamente em instantes."
      />
    </div>

    <template v-else>
      <section
        class="reports-kpis"
        :class="{ 'reports-kpis--three': kpiCards.length === 3 }"
        aria-label="Resumo do fluxo de caixa"
      >
        <template v-if="pending && !report">
          <UiCard v-for="index in 4" :key="index">
            <UiSkeleton width="6rem" height="0.8rem" />
            <UiSkeleton
              width="8rem"
              height="1.6rem"
              class="reports-page__gap"
            />
            <UiSkeleton
              width="4rem"
              height="0.7rem"
              class="reports-page__gap"
            />
          </UiCard>
        </template>
        <UiCard
          v-for="card in kpiCards"
          v-else
          :key="card.key"
          class="reports-kpi"
        >
          <p class="reports-kpi__label">{{ card.label }}</p>
          <p
            class="reports-kpi__value"
            :class="`reports-kpi__value--${card.tone}`"
          >
            <UiMoney :value="card.value" />
          </p>
          <p class="reports-kpi__support">{{ card.support }}</p>
        </UiCard>
      </section>

      <UiCard class="reports-chart-card" padding="md">
        <UiSkeleton v-if="pending && !report" height="14rem" radius="md" />
        <ReportsCashFlowChart
          v-else-if="report"
          :days="report.days"
          :selected-date="selectedDate"
          @select="selectedDate = $event"
        />
      </UiCard>

      <div class="reports-bottom">
        <UiCard class="reports-critical">
          <div class="reports-critical__heading">
            <h2>Dias críticos</h2>
            <p>
              Dias em que o saldo fica negativo ou cai abaixo de
              {{ formatMoney(report?.criticalThreshold ?? 500) }}
            </p>
          </div>

          <UiEmptyState
            v-if="!criticalDays.length"
            title="Nenhum dia crítico neste mês"
            description="O saldo projetado permanece acima do limiar."
          >
            <template #icon><AlertTriangle /></template>
          </UiEmptyState>

          <ul v-else class="reports-critical__list">
            <li v-for="day in criticalDays" :key="day.date">
              <button type="button" @click="selectedDate = day.date">
                <strong>Dia {{ day.day }}</strong>
                <span>
                  <UiMoney :value="day.balance" />
                </span>
              </button>
            </li>
          </ul>
        </UiCard>

        <UiCard class="reports-day" padding="none">
          <div class="reports-day__header">
            <div>
              <h2>
                {{
                  selectedDay
                    ? dayTitle(selectedDay)
                    : 'Selecione um dia'
                }}
              </h2>
              <p v-if="selectedDay">
                Saldo ao fim do dia:
                <UiMoney :value="selectedDay.balance" />
              </p>
            </div>
          </div>

          <UiEmptyState
            v-if="selectedDay && !selectedDay.movements.length"
            title="Sem lançamentos neste dia"
            description="Não há entradas ou saídas com data efetiva neste dia."
          >
            <template #icon><Receipt /></template>
          </UiEmptyState>

          <ul v-else-if="selectedDay" class="reports-day__list">
            <li
              v-for="movement in selectedDay.movements"
              :key="movement.id"
              class="reports-day__item"
            >
              <div class="reports-day__icon" aria-hidden="true">
                <AccountsBankMark
                  v-if="
                    movement.type === 'card_invoice' &&
                    movement.bankKey &&
                    movement.bankColor
                  "
                  :name="movement.bankName ?? movement.accountLabel ?? ''"
                  :color="movement.bankColor"
                  :bank-key="(movement.bankKey as BankKey)"
                  tint
                />
                <CategoriesCategoryIconChip
                  v-else-if="movement.categoryIcon && movement.categoryColor"
                  :icon="movement.categoryIcon"
                  :color="movement.categoryColor"
                />
                <span
                  v-else
                  class="reports-day__fallback"
                  :class="`reports-day__fallback--${movement.type}`"
                >
                  <component :is="movementIcon(movement.type)" />
                </span>
              </div>
              <div class="reports-day__main">
                <p>{{ movement.description }}</p>
                <span>{{ movementMeta(movement) }}</span>
              </div>
              <strong
                class="reports-day__amount"
                :class="{
                  'reports-day__amount--positive':
                    movement.signedAmount > 0,
                  'reports-day__amount--negative':
                    movement.signedAmount < 0,
                }"
              >
                <UiMoney :value="movement.signedAmount" />
              </strong>
            </li>
          </ul>
        </UiCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.reports-page__gap {
  margin-top: var(--space-3);
}

.reports-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.reports-kpis--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reports-kpi__label {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-kpi__value {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: clamp(1.125rem, 1.6vw, var(--text-lg));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.reports-kpi__value--positive {
  color: var(--color-positive-ink);
}

.reports-kpi__value--negative {
  color: var(--color-negative-ink);
}

.reports-kpi__support {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-bottom {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: var(--space-4);
}

.reports-critical__heading h2,
.reports-day__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.reports-critical__heading p,
.reports-day__header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-critical__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-4);
  list-style: none;
}

.reports-critical__list button {
  display: flex;
  width: 100%;
  padding: var(--space-3);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  color: var(--color-ink);
  cursor: pointer;
  text-align: left;
}

.reports-critical__list button:hover {
  border-color: var(--color-border-strong);
}

.reports-critical__list strong {
  font-size: var(--text-sm);
}

.reports-critical__list span {
  color: var(--color-negative-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.reports-day__header {
  padding: var(--space-4) var(--space-4) var(--space-3);
}

.reports-day__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.reports-day__item {
  display: flex;
  padding: 0.65rem var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.reports-day__icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.reports-day__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
}

.reports-day__fallback svg {
  width: 1rem;
  height: 1rem;
}

.reports-day__fallback--income {
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
}

.reports-day__fallback--expense {
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.reports-day__fallback--card_invoice {
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.reports-day__main {
  min-width: 0;
  flex: 1;
}

.reports-day__main p {
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reports-day__main span {
  display: block;
  overflow: hidden;
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reports-day__amount {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.reports-day__amount--positive {
  color: var(--color-positive-ink);
}

.reports-day__amount--negative {
  color: var(--color-negative-ink);
}

@media (max-width: 960px) {
  .reports-kpis,
  .reports-kpis--three,
  .reports-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
