<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { SpendingGuardReport } from '~/types/spendingGuard'

const props = defineProps<{ month: string }>()

const { data: report, pending } = await useFetch<SpendingGuardReport>(
  () => `/api/spending-guard?month=${props.month}`,
  { default: () => null },
)

const displayedSpend = computed(() => {
  if (!report.value) return 0
  if (report.value.monthKind === 'future') return report.value.committedTotal
  return report.value.spentToDate
})

const spentLimitPercent = computed(() => {
  if (!report.value?.spendingLimit) return 0
  return Math.min(
    100,
    (displayedSpend.value / report.value.spendingLimit) * 100,
  )
})

const spentBulletWidth = computed(() =>
  Math.min(report.value?.spentOfIncomePercent ?? 0, 100),
)

const limitMarkerPercent = computed(() =>
  Math.min(report.value?.limitOfIncomePercent ?? 75, 100),
)

const todayMarkerPercent = computed(() => {
  if (!report.value) return 0
  return (report.value.elapsedPercent / 100) * limitMarkerPercent.value
})

const spendLabel = computed(() => {
  if (report.value?.monthKind === 'past') return 'Total gasto'
  if (report.value?.monthKind === 'future') return 'Gasto previsto'
  return 'Gasto até hoje'
})

const statusLabel = computed(() => {
  if (!report.value) return ''
  if (report.value.monthKind === 'past') return 'Mês encerrado'
  if (report.value.monthKind === 'future') return 'Planejamento do mês'
  if (report.value.status === 'no-income') return ''

  const spentPct = spentLimitPercent.value
  const daysPct = report.value.elapsedPercent
  if (spentPct >= 100) return 'Limite estourado'
  if (spentPct > daysPct + 15) return 'Acima do ritmo esperado'
  if (spentPct > daysPct) return 'Levemente acima do esperado'
  return 'Dentro do esperado'
})

const statusTone = computed(() => {
  if (!report.value || report.value.monthKind !== 'current') return 'muted'
  if (spentLimitPercent.value >= 100) return 'danger'
  if (spentLimitPercent.value > report.value.elapsedPercent + 15) {
    return 'warning'
  }
  if (spentLimitPercent.value > report.value.elapsedPercent) return 'caution'
  return 'muted'
})

const savingsTone = computed(() => {
  const pct = report.value?.actualSavingsPercent
  if (pct === null || pct === undefined) return 'muted'
  if (pct >= (report.value?.savingsTargetPercent ?? 25)) return 'positive'
  if (pct >= 0) return 'warning'
  return 'danger'
})

const savedAmount = computed(() => {
  if (!report.value) return 0
  return Math.max(0, report.value.expectedIncome - displayedSpend.value)
})

const periodLabel = computed(() => {
  if (!report.value) return ''
  if (report.value.monthKind === 'past') return 'Mês encerrado'
  if (report.value.monthKind === 'future') return 'Mês futuro'
  return `Dia ${report.value.day} de ${report.value.daysInMonth}`
})

type BreakdownScope = 'spent' | 'future'

const breakdownOpen = ref(false)
const breakdownScope = ref<BreakdownScope>('spent')

const breakdownTitle = computed(() => {
  if (!report.value) return 'Detalhes'
  if (breakdownScope.value === 'future') {
    return report.value.monthKind === 'future'
      ? 'Gastos previstos'
      : 'Compromissos futuros'
  }
  if (report.value.monthKind === 'past') return 'Total gasto no mês'
  if (report.value.monthKind === 'future') return 'Gasto previsto'
  return 'Gasto até hoje'
})

const breakdownTotal = computed(() => {
  if (!report.value) return 0
  return breakdownScope.value === 'future'
    ? report.value.futureCommitted
    : displayedSpend.value
})

const breakdownGroups = computed(() => {
  if (!report.value) return []
  if (breakdownScope.value === 'future') {
    return report.value.futureBreakdown
  }
  if (report.value.monthKind === 'future') {
    return report.value.futureBreakdown
  }
  return report.value.spentBreakdown
})

const breakdownSourceTotals = computed(() => {
  if (!report.value) return { account: 0, card: 0 }
  if (
    breakdownScope.value === 'future' ||
    report.value.monthKind === 'future'
  ) {
    const groups = report.value.futureBreakdown
    return {
      account: roundBreakdownSource(groups, 'account'),
      card: roundBreakdownSource(groups, 'card'),
    }
  }
  return report.value.sourceTotals
})

function roundBreakdownSource(
  groups: SpendingGuardReport['spentBreakdown'],
  source: 'account' | 'card',
) {
  const total = groups
    .flatMap((group) => group.items)
    .filter((item) => item.source === source)
    .reduce((sum, item) => sum + item.amount, 0)
  return Math.round((total + Number.EPSILON) * 100) / 100
}

function openBreakdown(scope: BreakdownScope) {
  breakdownScope.value = scope
  breakdownOpen.value = true
}

function formatPercent(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
</script>

<template>
  <UiCard class="spending-guard" padding="none">
    <div v-if="pending || !report" class="spending-guard__loading">
      <UiSkeleton width="12rem" height="0.75rem" />
      <UiSkeleton width="18rem" height="1.4rem" />
      <UiSkeleton height="0.8rem" radius="sm" />
      <UiSkeleton height="4.5rem" />
    </div>

    <template v-else>
      <div class="spending-guard__main">
        <header class="spending-guard__header">
          <div>
            <p class="spending-guard__eyebrow">
              {{ report.fullLabel }} · {{ periodLabel }}
            </p>
            <h2>Meta: poupar {{ report.savingsTargetPercent }}% da receita</h2>
          </div>
          <div
            v-if="report.monthKind === 'current'"
            class="spending-guard__month-progress"
            aria-hidden="true"
          >
            <p>{{ formatPercent(report.elapsedPercent) }}% do mês</p>
            <span>
              <i :style="{ width: `${report.elapsedPercent}%` }" />
            </span>
          </div>
        </header>

        <div class="spending-guard__headline">
          <div>
            <p class="spending-guard__metric-label">{{ spendLabel }}</p>
            <button
              type="button"
              class="spending-guard__spent-trigger"
              :aria-label="`Ver detalhes: ${spendLabel}`"
              @click="openBreakdown('spent')"
            >
              <strong
                class="spending-guard__spent"
                :class="{ 'is-danger': spentLimitPercent >= 100 }"
              >
                <UiMoney :value="displayedSpend" />
              </strong>
              <span class="spending-guard__spent-hint">Ver detalhes</span>
            </button>
          </div>
          <div class="spending-guard__refs">
            <div>
              <p class="spending-guard__metric-label">Limite</p>
              <strong><UiMoney :value="report.spendingLimit" /></strong>
            </div>
            <span aria-hidden="true">·</span>
            <div>
              <p class="spending-guard__metric-label">Receita</p>
              <strong><UiMoney :value="report.expectedIncome" /></strong>
            </div>
          </div>
        </div>

        <p class="spending-guard__hint">
          Compras no cartão entram pela data da compra, não pelo vencimento da
          fatura.
        </p>

        <div
          v-if="report.status === 'no-income'"
          class="spending-guard__no-income"
        >
          Cadastre uma receita para calcular o limite mensal.
        </div>

        <template v-else>
          <div class="spending-guard__bullet">
            <div class="spending-guard__bullet-track">
              <div class="spending-guard__bullet-fills">
                <span
                  class="spending-guard__bullet-spending-zone"
                  :style="{ width: `${limitMarkerPercent}%` }"
                />
                <span
                  class="spending-guard__bullet-savings-zone"
                  :style="{ width: `${100 - limitMarkerPercent}%` }"
                />
                <span
                  class="spending-guard__bullet-spent"
                  :class="{
                    'is-warning': report.status === 'attention',
                    'is-danger':
                      report.status === 'critical' ||
                      report.status === 'exceeded',
                  }"
                  :style="{ width: `${spentBulletWidth}%` }"
                />
              </div>

              <div
                class="spending-guard__marker spending-guard__marker--limit"
                :style="{ left: `${limitMarkerPercent}%` }"
                tabindex="0"
              >
                <span class="spending-guard__marker-line" />
                <span class="spending-guard__marker-tip" role="tooltip">
                  Limite de gastos ·
                  <UiMoney :value="report.spendingLimit" />
                  ({{ formatPercent(limitMarkerPercent) }}% da receita)
                </span>
              </div>

              <div
                v-if="report.monthKind === 'current'"
                class="spending-guard__marker spending-guard__marker--today"
                :style="{ left: `${todayMarkerPercent}%` }"
                tabindex="0"
              >
                <span class="spending-guard__marker-line" />
                <span class="spending-guard__marker-tip" role="tooltip">
                  Hoje · Dia {{ report.day }} de {{ report.daysInMonth }}
                  ({{ formatPercent(report.elapsedPercent) }}% do mês)
                </span>
              </div>
            </div>

            <div class="spending-guard__bullet-meta">
              <div>
                <p :class="`is-${statusTone}`">{{ statusLabel }}</p>
                <span v-if="report.monthKind === 'current'">
                  <span class="spending-guard__legend-mark is-limit" />
                  Limite ({{ report.spendingLimitPercent }}%)
                </span>
                <span v-if="report.monthKind === 'current'">
                  <span class="spending-guard__legend-mark is-today" />
                  Hoje
                </span>
              </div>
              <span>{{ formatPercent(report.spentOfIncomePercent) }}% da receita</span>
            </div>
          </div>

          <p
            v-if="report.cardDeferred.amount > 0 && report.cardDeferred.invoiceMonthLabel"
            class="spending-guard__bridge"
          >
            <UiMoney :value="report.cardDeferred.amount" />
            deste total entram na fatura de
            {{ report.cardDeferred.invoiceMonthLabel }}.
          </p>

          <p
            v-if="report.futureCommitted > 0 && report.monthKind === 'current'"
            class="spending-guard__future-note"
          >
            Há
            <button
              type="button"
              class="spending-guard__inline-link"
              @click="openBreakdown('future')"
            >
              <UiMoney :value="report.futureCommitted" />
            </button>
            em despesas futuras neste mês — após elas, restam
            <UiMoney :value="report.availableAfterCommitments" />.
          </p>
        </template>
      </div>

      <footer
        v-if="report.status !== 'no-income' && report.expectedIncome > 0"
        class="spending-guard__footer"
      >
        <div>
          <p class="spending-guard__metric-label">Poupança efetiva</p>
          <div class="spending-guard__savings-headline">
            <strong :class="`is-${savingsTone}`">
              {{
                report.actualSavingsPercent !== null
                  ? `${formatPercent(report.actualSavingsPercent)}%`
                  : '—'
              }}
            </strong>
            <span v-if="report.actualSavingsPercent !== null">
              (meta: {{ report.savingsTargetPercent }}%)
            </span>
          </div>
          <p v-if="report.actualSavingsPercent !== null" class="spending-guard__saved">
            <UiMoney :value="savedAmount" /> poupados até agora
          </p>
        </div>

        <div class="spending-guard__flow">
          <div>
            <p class="spending-guard__metric-label">Receita</p>
            <strong><UiMoney :value="report.expectedIncome" /></strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <p class="spending-guard__metric-label">Meta poupança</p>
            <strong>{{ report.savingsTargetPercent }}%</strong>
          </div>
          <ArrowRight aria-hidden="true" />
          <div>
            <p class="spending-guard__metric-label">A poupar</p>
            <strong><UiMoney :value="report.savingsGoal" /></strong>
          </div>
        </div>
      </footer>

      <DashboardSpendingGuardBreakdownDrawer
        v-if="report"
        v-model:open="breakdownOpen"
        :title="breakdownTitle"
        :total="breakdownTotal"
        :source-totals="breakdownSourceTotals"
        :groups="breakdownGroups"
      />
    </template>
  </UiCard>
</template>

<style scoped>
.spending-guard {
  overflow: hidden;
}

.spending-guard__loading,
.spending-guard__main {
  padding: var(--space-5) var(--space-6);
}

.spending-guard__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.spending-guard__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.spending-guard__eyebrow,
.spending-guard__metric-label,
.spending-guard__hint,
.spending-guard__bullet-meta,
.spending-guard__bridge,
.spending-guard__future-note,
.spending-guard__saved {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-guard__header h2 {
  margin-top: var(--space-1);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.spending-guard__month-progress {
  flex-shrink: 0;
  min-width: 6rem;
  text-align: right;
}

.spending-guard__month-progress p {
  margin-bottom: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-guard__month-progress span {
  display: block;
  overflow: hidden;
  height: 0.35rem;
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.spending-guard__month-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink-muted);
}

.spending-guard__headline {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.spending-guard__spent-trigger {
  display: inline-grid;
  gap: var(--space-1);
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.spending-guard__spent-trigger:hover .spending-guard__spent-hint,
.spending-guard__spent-trigger:focus-visible .spending-guard__spent-hint {
  color: var(--color-brand);
}

.spending-guard__spent-trigger:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

.spending-guard__spent {
  color: var(--color-ink);
  font-size: clamp(1.75rem, 3vw, 2.25rem);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.03em;
}

.spending-guard__spent.is-danger {
  color: var(--color-negative-ink);
}

.spending-guard__spent-hint {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.spending-guard__inline-link {
  display: inline;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: var(--weight-semibold);
  text-decoration: underline;
  text-decoration-color: var(--color-border-strong);
  text-underline-offset: 0.15em;
  cursor: pointer;
}

.spending-guard__inline-link:hover,
.spending-guard__inline-link:focus-visible {
  color: var(--color-brand);
  text-decoration-color: currentColor;
}

.spending-guard__inline-link:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.spending-guard__refs {
  display: flex;
  align-items: end;
  gap: var(--space-3);
  margin-bottom: 0.15rem;
}

.spending-guard__refs > span {
  color: var(--color-border-strong);
}

.spending-guard__refs strong {
  color: var(--color-ink-secondary);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.spending-guard__hint {
  margin-top: var(--space-3);
}

.spending-guard__no-income {
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: var(--text-xs);
}

.spending-guard__bullet {
  margin-top: var(--space-5);
}

.spending-guard__bullet-track {
  position: relative;
}

.spending-guard__bullet-fills {
  position: relative;
  overflow: hidden;
  height: 1rem;
  border-radius: var(--radius-md);
}

.spending-guard__bullet-spending-zone,
.spending-guard__bullet-savings-zone,
.spending-guard__bullet-spent {
  position: absolute;
  top: 0;
  bottom: 0;
}

.spending-guard__bullet-spending-zone {
  left: 0;
  background: var(--color-surface-subtle);
}

.spending-guard__bullet-savings-zone {
  right: 0;
  background: color-mix(in srgb, var(--color-positive) 8%, var(--color-surface-subtle));
}

.spending-guard__bullet-spent {
  left: 0;
  margin: 0.15rem 0;
  border-radius: calc(var(--radius-md) - 0.15rem);
  background: var(--color-positive);
  transition: width var(--transition-base);
}

.spending-guard__bullet-spent.is-warning {
  background: var(--color-warning);
}

.spending-guard__bullet-spent.is-danger {
  background: var(--color-negative);
}

.spending-guard__marker {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  width: 1.25rem;
  transform: translateX(-50%);
  cursor: help;
}

.spending-guard__marker-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
}

.spending-guard__marker--limit .spending-guard__marker-line {
  background: var(--color-ink-muted);
}

.spending-guard__marker--today .spending-guard__marker-line {
  width: 1px;
  background: var(--color-brand);
}

.spending-guard__marker-tip {
  position: absolute;
  bottom: calc(100% + 0.45rem);
  left: 50%;
  z-index: 5;
  width: max-content;
  max-width: 14rem;
  padding: 0.4rem 0.55rem;
  border-radius: var(--radius-sm);
  background: var(--color-nav);
  color: var(--color-white);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
  line-height: 1.3;
  opacity: 0;
  transform: translate(-50%, 0.2rem);
  pointer-events: none;
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.spending-guard__marker-tip::after {
  position: absolute;
  top: 100%;
  left: 50%;
  border: 0.3rem solid transparent;
  border-top-color: var(--color-nav);
  content: '';
  transform: translateX(-50%);
}

.spending-guard__marker:hover .spending-guard__marker-tip,
.spending-guard__marker:focus .spending-guard__marker-tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.spending-guard__marker:focus {
  outline: none;
}

.spending-guard__marker:focus-visible .spending-guard__marker-line {
  box-shadow: 0 0 0 2px var(--color-focus);
}

.spending-guard__bullet-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.spending-guard__bullet-meta > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.spending-guard__bullet-meta p.is-danger {
  color: var(--color-negative-ink);
}

.spending-guard__bullet-meta p.is-warning,
.spending-guard__bullet-meta p.is-caution {
  color: var(--color-warning);
}

.spending-guard__legend-mark {
  display: inline-block;
  width: 0.125rem;
  height: 0.75rem;
  margin-right: var(--space-1);
  vertical-align: middle;
}

.spending-guard__legend-mark.is-limit {
  background: var(--color-ink-muted);
}

.spending-guard__legend-mark.is-today {
  background: var(--color-brand);
}

.spending-guard__bridge,
.spending-guard__future-note {
  margin-top: var(--space-3);
}

.spending-guard__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border);
}

.spending-guard__savings-headline {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.spending-guard__savings-headline strong {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.spending-guard__savings-headline strong.is-positive {
  color: var(--color-positive-ink);
}

.spending-guard__savings-headline strong.is-warning {
  color: var(--color-warning);
}

.spending-guard__savings-headline strong.is-danger {
  color: var(--color-negative-ink);
}

.spending-guard__saved {
  margin-top: var(--space-1);
}

.spending-guard__flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.spending-guard__flow svg {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--color-border-strong);
  flex-shrink: 0;
}

.spending-guard__flow strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (max-width: 760px) {
  .spending-guard__header {
    flex-direction: column;
  }

  .spending-guard__month-progress {
    width: 100%;
    text-align: left;
  }

  .spending-guard__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .spending-guard__bullet-meta {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .spending-guard__loading,
  .spending-guard__main,
  .spending-guard__footer {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }
}
</style>
