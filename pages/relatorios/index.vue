<script setup lang="ts">
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  LoaderCircle,
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

const selectedDaySummary = computed(() => {
  if (!report.value || !selectedDay.value) return null
  const index = report.value.days.findIndex(
    (day) => day.date === selectedDay.value?.date,
  )
  const openingBalance =
    index > 0
      ? report.value.days[index - 1]!.balance
      : report.value.openingBalance
  const pendingImpact = selectedDay.value.movements.reduce(
    (sum, movement) =>
      movement.affectsBalance ? sum : sum + movement.signedAmount,
    0,
  )

  return {
    openingBalance,
    closingBalance: selectedDay.value.balance,
    pendingImpact: Math.round(pendingImpact * 100) / 100,
    variation:
      Math.round((selectedDay.value.balance - openingBalance) * 100) / 100,
  }
})

const selectedDayVariationLabel = computed(() => {
  if (!selectedDay.value) return 'Variação do saldo'
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return selectedDay.value.date <= todayKey
    ? 'Variação consolidada'
    : 'Variação projetada'
})

const criticalDays = computed(
  () => report.value?.days.filter((day) => day.isCritical) ?? [],
)

type CriticalPeriod = {
  key: string
  startDay: number
  endDay: number
  duration: number
  worstDay: CashFlowDay
}

const criticalPeriods = computed<CriticalPeriod[]>(() => {
  const periods: CriticalPeriod[] = []

  for (const day of criticalDays.value) {
    const current = periods.at(-1)
    if (current && day.day === current.endDay + 1) {
      current.endDay = day.day
      current.duration += 1
      if (day.balance < current.worstDay.balance) current.worstDay = day
      continue
    }

    periods.push({
      key: day.date,
      startDay: day.day,
      endDay: day.day,
      duration: 1,
      worstDay: day,
    })
  }

  return periods
})

function criticalPeriodLabel(period: CriticalPeriod) {
  if (period.startDay === period.endDay) return `Dia ${period.startDay}`
  return `Dias ${period.startDay}–${period.endDay}`
}

const flowTotals = computed(() => {
  const movements = report.value?.days.flatMap((day) => day.movements) ?? []
  const inflows = movements.reduce(
    (sum, movement) =>
      movement.signedAmount > 0 ? sum + movement.signedAmount : sum,
    0,
  )
  const outflows = movements.reduce(
    (sum, movement) =>
      movement.signedAmount < 0 ? sum + Math.abs(movement.signedAmount) : sum,
    0,
  )

  return {
    inflows: Math.round(inflows * 100) / 100,
    outflows: Math.round(outflows * 100) / 100,
  }
})

const kpiCards = computed(() => {
  if (!report.value) return []
  type Tone = 'neutral' | 'positive' | 'negative'
  const cards: {
    key: string
    label: string
    value: number
    support: string
    tone: Tone
  }[] = []

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
    tone:
      report.value.days.some((d) => d.isCritical) || report.value.worstBalance < 0
        ? 'negative'
        : 'positive',
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

function selectMonth({ year, month }: { year: number; month: number }) {
  selectedYear.value = year
  selectedMonth.value = month
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
      eyebrow=""
      title="Fluxo de caixa"
      description="Entenda quando o dinheiro entra, sai e como isso afeta o seu saldo."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="monthLabel"
          :year="selectedYear"
          :month="selectedMonth"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
          @select="selectMonth"
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

    <div v-else class="reports-content" :aria-busy="pending">
      <div
        v-if="pending && report"
        class="reports-content__loading"
        role="status"
        aria-live="polite"
      >
        <span class="reports-content__loading-pill">
          <LoaderCircle aria-hidden="true" />
          Calculando {{ monthLabel }}…
        </span>
      </div>

      <section
        class="reports-overview"
        :class="{ 'reports-overview--single-risk': kpiCards.length === 1 }"
        aria-label="Resumo do fluxo de caixa"
      >
        <UiCard class="reports-reconciliation" padding="none">
          <header class="reports-reconciliation__header">
            <div>
              <h2>Conciliação do mês</h2>
              <p>Do saldo de abertura ao fechamento projetado.</p>
            </div>
          </header>

          <div v-if="pending && !report" class="reports-reconciliation__loading">
            <UiSkeleton height="5rem" radius="md" />
          </div>
          <div v-else-if="report" class="reports-reconciliation__formula">
            <div class="reports-reconciliation__balance">
              <span>Saldo inicial</span>
              <strong><UiMoney :value="report.openingBalance" /></strong>
            </div>
            <span class="reports-reconciliation__arrow" aria-hidden="true">→</span>
            <div class="reports-reconciliation__movements">
              <div class="reports-reconciliation__movement is-positive">
                <span>Entradas</span>
                <strong>+ <UiMoney :value="flowTotals.inflows" /></strong>
              </div>
              <div class="reports-reconciliation__movement is-negative">
                <span>Saídas</span>
                <strong>− <UiMoney :value="flowTotals.outflows" /></strong>
              </div>
            </div>
            <span class="reports-reconciliation__arrow" aria-hidden="true">→</span>
            <div class="reports-reconciliation__balance is-closing">
              <span>Saldo fim do mês</span>
              <strong><UiMoney :value="report.closingBalance" /></strong>
              <small
                :class="report.closingDelta >= 0 ? 'is-positive' : 'is-negative'"
              >
                {{ report.closingDelta >= 0 ? '+' : '−' }}
                <UiMoney :value="Math.abs(report.closingDelta)" /> no mês
              </small>
            </div>
          </div>
        </UiCard>

        <div class="reports-risks">
          <template v-if="pending && !report">
            <UiCard v-for="index in 2" :key="index">
              <UiSkeleton width="6rem" height="0.8rem" />
              <UiSkeleton width="8rem" height="1.6rem" class="reports-page__gap" />
              <UiSkeleton width="4rem" height="0.7rem" class="reports-page__gap" />
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
        </div>
      </section>

      <UiCard class="reports-chart-card" padding="md">
        <UiSkeleton v-if="pending && !report" height="14rem" radius="md" />
        <ReportsCashFlowChart
          v-else-if="report"
          :days="report.days"
          :snapshot="report.snapshot"
          :selected-date="selectedDate"
          :critical-threshold="report.criticalThreshold"
          :month-kind="report.monthKind"
          @select="selectedDate = $event"
        />
      </UiCard>

      <div v-if="pending && !report" class="reports-bottom">
        <UiCard v-for="index in 2" :key="index">
          <UiSkeleton width="9rem" height="1rem" />
          <UiSkeleton height="7rem" radius="md" class="reports-page__gap" />
        </UiCard>
      </div>

      <div v-else class="reports-bottom">
        <UiCard class="reports-critical">
          <div class="reports-critical__heading">
            <h2>
              Períodos de atenção
              <span v-if="criticalPeriods.length" class="reports-critical__count">
                {{ criticalPeriods.length }}
              </span>
            </h2>
            <p>
              Intervalos em que o saldo fica negativo ou abaixo de
              {{ formatMoney(report?.criticalThreshold ?? 500) }}.
              <template v-if="criticalDays.length">
                {{ criticalDays.length }} dias no total.
              </template>
            </p>
          </div>

          <div
            v-if="selectedDaySummary?.pendingImpact"
            class="reports-day__pending"
          >
            <span>Previsto, ainda não refletido no saldo</span>
            <strong
              :class="selectedDaySummary.pendingImpact >= 0 ? 'is-positive' : 'is-negative'"
            >
              {{ selectedDaySummary.pendingImpact >= 0 ? '+' : '−' }}
              <UiMoney :value="Math.abs(selectedDaySummary.pendingImpact)" />
            </strong>
          </div>

          <UiEmptyState
            v-if="!criticalPeriods.length"
            title="Nenhum período de atenção neste mês"
            description="O saldo projetado permanece acima do limiar."
          >
            <template #icon><AlertTriangle /></template>
          </UiEmptyState>

          <ul v-else class="reports-critical__list">
            <li v-for="period in criticalPeriods" :key="period.key">
              <button
                type="button"
                @click="selectedDate = period.worstDay.date"
              >
                <div>
                  <strong>{{ criticalPeriodLabel(period) }}</strong>
                  <small>
                    {{ period.duration }}
                    {{ period.duration === 1 ? 'dia' : 'dias' }} · menor saldo
                    no dia {{ period.worstDay.day }}
                  </small>
                </div>
                <span>
                  <UiMoney :value="period.worstDay.balance" />
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
              <p v-if="selectedDay">Movimentações e efeito no saldo.</p>
            </div>
            <div v-if="selectedDay" class="reports-day__closing">
              <span>Saldo ao fim do dia</span>
              <strong><UiMoney :value="selectedDay.balance" /></strong>
            </div>
          </div>

          <div v-if="selectedDaySummary" class="reports-day__summary">
            <div>
              <span>Saldo inicial</span>
              <strong><UiMoney :value="selectedDaySummary.openingBalance" /></strong>
            </div>
            <div
              :class="selectedDaySummary.variation >= 0 ? 'is-positive' : 'is-negative'"
            >
              <span>{{ selectedDayVariationLabel }}</span>
              <strong>
                {{ selectedDaySummary.variation >= 0 ? '+' : '−' }}
                <UiMoney :value="Math.abs(selectedDaySummary.variation)" />
              </strong>
            </div>
            <div>
              <span>Saldo final</span>
              <strong><UiMoney :value="selectedDaySummary.closingBalance" /></strong>
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
    </div>
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

.reports-content {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.reports-content__loading {
  position: absolute;
  z-index: 10;
  inset: 0;
  display: flex;
  padding-top: var(--space-7);
  align-items: flex-start;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 76%, transparent);
  backdrop-filter: blur(1px);
}

.reports-content__loading-pill {
  display: inline-flex;
  min-height: 2.75rem;
  padding: 0 var(--space-4);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  box-shadow: var(--shadow-md);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.reports-content__loading-pill svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-brand);
  animation: reports-loading-spin 0.8s linear infinite;
}

@keyframes reports-loading-spin {
  to {
    transform: rotate(360deg);
  }
}

.reports-overview {
  display: grid;
  grid-template-columns: minmax(0, 2.2fr) repeat(2, minmax(10rem, 0.65fr));
  gap: var(--space-4);
  align-items: stretch;
}

.reports-overview--single-risk {
  grid-template-columns: minmax(0, 3fr) minmax(11rem, 1fr);
}

.reports-risks {
  display: contents;
}

.reports-reconciliation__header {
  display: flex;
  padding: var(--space-4) var(--space-5) var(--space-3);
  align-items: center;
  gap: var(--space-4);
}

.reports-reconciliation__header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.reports-reconciliation__header p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-reconciliation__loading,
.reports-reconciliation__formula {
  padding: 0 var(--space-5) var(--space-5);
}

.reports-reconciliation__formula {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) auto minmax(12rem, 1.35fr) auto minmax(10rem, 1.15fr);
  align-items: stretch;
  gap: var(--space-4);
}

.reports-reconciliation__balance {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.reports-reconciliation__balance > span,
.reports-reconciliation__movement > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-reconciliation__balance > strong {
  color: var(--color-ink);
  font-size: clamp(var(--text-lg), 2vw, var(--text-xl));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.025em;
  white-space: nowrap;
}

.reports-reconciliation__movements {
  display: grid;
  grid-template-rows: repeat(2, 1fr);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.reports-reconciliation__movement {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.reports-reconciliation__movement + .reports-reconciliation__movement {
  border-top: 1px solid var(--color-border);
}

.reports-reconciliation__movement strong {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.reports-reconciliation__movement.is-positive strong {
  color: var(--color-positive-ink);
}

.reports-reconciliation__movement.is-negative strong {
  color: var(--color-negative-ink);
}

.reports-reconciliation__balance.is-closing {
  border-color: transparent;
  background: var(--color-brand-soft);
}

.reports-reconciliation__balance.is-closing > strong {
  color: var(--color-brand-ink);
}

.reports-reconciliation__balance small {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
}

.reports-reconciliation__balance small.is-positive {
  color: var(--color-positive-ink);
}

.reports-reconciliation__balance small.is-negative {
  color: var(--color-negative-ink);
}

.reports-reconciliation__arrow {
  align-self: center;
  color: var(--color-ink-muted);
  font-size: var(--text-md);
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

.reports-critical__count {
  display: inline-flex;
  align-items: center;
  margin-left: var(--space-2);
  padding: 0.1rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  vertical-align: middle;
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
  display: block;
  font-size: var(--text-sm);
}

.reports-critical__list small {
  display: block;
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-critical__list span {
  color: var(--color-negative-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.reports-day__header {
  display: flex;
  padding: var(--space-4) var(--space-4) var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.reports-day__closing {
  display: grid;
  justify-items: end;
  gap: var(--space-1);
  text-align: right;
}

.reports-day__closing span,
.reports-day__summary span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-day__closing strong {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.reports-day__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.reports-day__summary > div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  padding: 0 var(--space-3);
  border-left: 1px solid var(--color-border);
}

.reports-day__summary > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.reports-day__summary > div:last-child {
  padding-right: 0;
}

.reports-day__summary strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.reports-day__summary .is-positive strong {
  color: var(--color-positive-ink);
}

.reports-day__summary .is-negative strong {
  color: var(--color-negative-ink);
}

.reports-day__pending {
  display: flex;
  padding: var(--space-2) var(--space-4);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-warning-soft);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.reports-day__pending strong {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.reports-day__pending strong.is-positive {
  color: var(--color-positive-ink);
}

.reports-day__pending strong.is-negative {
  color: var(--color-negative-ink);
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
  .reports-overview,
  .reports-bottom {
    grid-template-columns: 1fr;
  }

  .reports-risks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
}

@media (max-width: 640px) {
  .reports-reconciliation__formula {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .reports-reconciliation__arrow {
    display: none;
  }

  .reports-reconciliation__balance {
    padding: var(--space-3);
  }

  .reports-risks {
    grid-template-columns: 1fr;
  }

  .reports-day__header {
    align-items: stretch;
    flex-direction: column;
  }

  .reports-day__closing {
    justify-items: start;
    text-align: left;
  }

  .reports-day__summary {
    grid-template-columns: 1fr;
    row-gap: var(--space-3);
  }

  .reports-day__summary > div {
    padding: 0;
    border-left: 0;
  }
}
</style>
