<script setup lang="ts">
import { CalendarDays, Gauge, PiggyBank, WalletCards } from '@lucide/vue'
import type {
  SpendingGuardPace,
  SpendingGuardReport,
} from '~/types/spendingGuard'

const props = defineProps<{ month: string }>()

const { data: report, pending } = await useFetch<SpendingGuardReport>(
  () => `/api/spending-guard?month=${props.month}`,
  { default: () => null },
)

const actualWidth = computed(() =>
  Math.min(100, Math.max(0, report.value?.spentPercent ?? 0)),
)
const committedWidth = computed(() => {
  if (!report.value) return 0
  const extra = report.value.committedPercent - report.value.spentPercent
  return Math.min(100 - actualWidth.value, Math.max(0, extra))
})
const todayPosition = computed(() =>
  Math.min(100, Math.max(0, report.value?.elapsedPercent ?? 0)),
)
const displayedSpend = computed(() =>
  report.value?.monthKind === 'future'
    ? report.value.committedTotal
    : report.value?.spentToDate ?? 0,
)
const displayedPercent = computed(() =>
  report.value?.monthKind === 'future'
    ? report.value.committedPercent
    : report.value?.spentPercent ?? 0,
)
const displayedSourceTotals = computed(() =>
  report.value?.monthKind === 'future'
    ? report.value.committedSourceTotals
    : report.value?.sourceTotals,
)
const spendLabel = computed(() => {
  if (report.value?.monthKind === 'past') return 'Gasto no mês'
  if (report.value?.monthKind === 'future') return 'Gasto previsto'
  return 'Gasto até hoje'
})
const availableLabel = computed(() => {
  if (report.value?.monthKind === 'past') return 'Saldo do limite'
  if (report.value?.monthKind === 'future') return 'Disponível para planejar'
  return 'Disponível para gastar'
})
const availableValue = computed(() =>
  report.value?.monthKind === 'future'
    ? report.value.availableAfterCommitments
    : report.value?.remainingToLimit ?? 0,
)
const periodLabel = computed(() => {
  if (!report.value) return ''
  if (report.value.monthKind === 'past') return 'Mês encerrado'
  if (report.value.monthKind === 'future') return 'Planejamento do mês'
  return `Dia ${report.value.day} de ${report.value.daysInMonth}`
})
const progressLabel = computed(() => {
  if (!report.value) return ''
  if (report.value.monthKind === 'past') return 'Resultado final do mês'
  if (report.value.monthKind === 'future') {
    return 'Baseado nos lançamentos já cadastrados'
  }
  return paceLabels[report.value.pace]
})

const paceLabels: Record<SpendingGuardPace, string> = {
  below: 'Abaixo do ritmo esperado',
  'on-track': 'Dentro do ritmo esperado',
  'slightly-above': 'Levemente acima do esperado',
  above: 'Acima do ritmo esperado',
}

function percent(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
</script>

<template>
  <UiCard class="spending-guard" padding="none">
    <div v-if="pending || !report" class="spending-guard__loading">
      <UiSkeleton width="12rem" height="0.75rem" />
      <UiSkeleton width="18rem" height="1.4rem" />
      <UiSkeleton height="0.8rem" radius="sm" />
      <div class="spending-guard__loading-grid">
        <UiSkeleton v-for="index in 3" :key="index" height="4.5rem" />
      </div>
    </div>

    <template v-else>
      <div class="spending-guard__main">
        <header class="spending-guard__header">
          <div>
            <p class="spending-guard__eyebrow">
              {{ report.fullLabel }} · {{ periodLabel }}
            </p>
            <h2>Radar de gastos</h2>
          </div>
          <span class="spending-guard__goal">
            <PiggyBank aria-hidden="true" />
            Meta: poupar {{ report.savingsTargetPercent }}%
          </span>
        </header>

        <div class="spending-guard__headline">
          <div class="spending-guard__metric spending-guard__metric--primary">
            <p class="spending-guard__metric-label">{{ spendLabel }}</p>
            <strong><UiMoney :value="displayedSpend" /></strong>
            <div class="spending-guard__sources">
              <span>
                Contas
                <UiMoney :value="displayedSourceTotals?.account ?? 0" />
              </span>
              <span>
                Cartões
                <UiMoney :value="displayedSourceTotals?.card ?? 0" />
              </span>
            </div>
          </div>
          <div class="spending-guard__metric">
            <p class="spending-guard__metric-label">Limite mensal</p>
            <strong><UiMoney :value="report.spendingLimit" /></strong>
            <span class="spending-guard__metric-hint">
              {{ report.spendingLimitPercent }}% da receita
            </span>
          </div>
          <div class="spending-guard__metric">
            <p class="spending-guard__metric-label">Receita prevista</p>
            <strong><UiMoney :value="report.expectedIncome" /></strong>
            <span class="spending-guard__metric-hint">
              Recebida + a receber
            </span>
          </div>
        </div>

        <div
          v-if="report.status === 'no-income'"
          class="spending-guard__no-income"
        >
          Cadastre uma receita para calcular o limite mensal. Seus gastos já
          continuam sendo acompanhados pela data da compra.
        </div>

        <template v-else>
          <div
            class="spending-guard__progress"
            :class="`spending-guard__progress--${report.status}`"
            role="progressbar"
            aria-label="Uso do limite mensal de gastos"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="Math.min(100, displayedPercent)"
          >
            <span
              class="spending-guard__progress-actual"
              :style="{ width: `${actualWidth}%` }"
            />
            <span
              v-if="committedWidth > 0"
              class="spending-guard__progress-committed"
              :style="{
                left: `${actualWidth}%`,
                width: `${committedWidth}%`,
              }"
            />
            <span
              v-if="report.monthKind === 'current'"
              class="spending-guard__today-marker"
              :style="{ left: `${todayPosition}%` }"
              tabindex="0"
              :aria-label="`Hoje: ${percent(report.elapsedPercent)}% do mês já passou`"
            >
              <span class="spending-guard__tooltip" role="tooltip">
                Hoje · {{ percent(report.elapsedPercent) }}% do mês já passou
              </span>
            </span>
          </div>

          <div class="spending-guard__progress-meta">
            <p>
              {{ progressLabel }}
              <span v-if="report.futureCommitted > 0">
                · área clara = compromissos previstos
              </span>
            </p>
            <p>{{ percent(displayedPercent) }}% do limite usado</p>
          </div>
        </template>
      </div>

      <div class="spending-guard__stats">
        <div>
          <span class="spending-guard__stat-icon">
            <WalletCards aria-hidden="true" />
          </span>
          <p>{{ availableLabel }}</p>
          <strong
            :class="{ 'is-negative': availableValue < 0 }"
          >
            <UiMoney :value="availableValue" />
          </strong>
          <small
            v-if="
              report.monthKind !== 'future' && report.futureCommitted > 0
            "
          >
            Após previstos:
            <UiMoney :value="report.availableAfterCommitments" />
          </small>
          <small v-else>
            {{
              report.monthKind === 'future'
                ? 'Após os gastos já previstos'
                : 'Até o limite do mês'
            }}
          </small>
        </div>

        <div>
          <span class="spending-guard__stat-icon">
            <CalendarDays aria-hidden="true" />
          </span>
          <p>
            {{
              report.monthKind === 'future'
                ? 'Gastos previstos'
                : 'Compromissos restantes'
            }}
          </p>
          <strong><UiMoney :value="report.futureCommitted" /></strong>
          <small>Já cadastrados neste mês</small>
        </div>

        <div>
          <span class="spending-guard__stat-icon">
            <Gauge aria-hidden="true" />
          </span>
          <p>Disponível por dia</p>
          <strong><UiMoney :value="report.dailyAvailable" /></strong>
          <small>
            {{
              report.monthKind === 'past'
                ? 'Mês encerrado'
                : report.monthKind === 'future'
                  ? `Para os ${report.daysInMonth} dias do mês`
                  : report.daysRemaining === 0
                    ? 'Hoje é o último dia'
                    : report.daysRemaining === 1
                      ? 'Para o último dia'
                      : `Para ${report.daysRemaining} dias restantes`
            }}
          </small>
        </div>
      </div>

      <footer class="spending-guard__footer">
        <span>Receita <UiMoney :value="report.expectedIncome" /></span>
        <span aria-hidden="true">→</span>
        <span>
          Limite ({{ report.spendingLimitPercent }}%)
          <UiMoney :value="report.spendingLimit" />
        </span>
        <span aria-hidden="true">→</span>
        <span>
          Meta de economia
          <UiMoney :value="report.savingsGoal" />
        </span>
      </footer>
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

.spending-guard__loading-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
.spending-guard__metric-hint,
.spending-guard__sources,
.spending-guard__stats p,
.spending-guard__stats small {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.spending-guard__header h2 {
  margin-top: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.spending-guard__goal {
  display: inline-flex;
  padding: 0.35rem 0.6rem;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-round);
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.spending-guard__goal svg,
.spending-guard__stat-icon svg {
  width: 1rem;
  height: 1rem;
}

.spending-guard__headline {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: 1.35fr 1fr 1fr;
  gap: var(--space-3);
}

.spending-guard__metric {
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.spending-guard__metric--primary {
  border-color: color-mix(in srgb, var(--color-brand) 20%, var(--color-border));
  background: var(--color-brand-soft);
}

.spending-guard__headline strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: clamp(1.1rem, 2.2vw, 1.75rem);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.spending-guard__metric-hint {
  display: block;
  margin-top: var(--space-2);
}

.spending-guard__sources {
  display: flex;
  flex-wrap: wrap;
  margin-top: var(--space-3);
  gap: var(--space-2);
}

.spending-guard__sources > span {
  display: inline-flex;
  padding: 0.3rem 0.5rem;
  align-items: baseline;
  gap: var(--space-1);
  border: 1px solid color-mix(in srgb, var(--color-brand) 14%, var(--color-border));
  border-radius: var(--radius-round);
  background: color-mix(in srgb, var(--color-surface) 78%, transparent);
  white-space: nowrap;
}

.spending-guard__sources :deep(.ui-money) {
  color: var(--color-ink-secondary);
  font-weight: var(--weight-semibold);
}

.spending-guard__progress {
  position: relative;
  overflow: visible;
  height: 0.65rem;
  margin-top: var(--space-5);
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.spending-guard__progress-actual,
.spending-guard__progress-committed {
  position: absolute;
  top: 0;
  bottom: 0;
}

.spending-guard__progress-actual {
  left: 0;
  border-radius: var(--radius-round);
  background: var(--color-positive);
  transition: width var(--transition-base);
}

.spending-guard__progress-committed {
  background: color-mix(in srgb, var(--color-positive) 28%, white);
}

.spending-guard__progress--attention .spending-guard__progress-actual {
  background: var(--color-warning);
}

.spending-guard__progress--attention .spending-guard__progress-committed {
  background: color-mix(in srgb, var(--color-warning) 28%, white);
}

.spending-guard__progress--critical .spending-guard__progress-actual,
.spending-guard__progress--exceeded .spending-guard__progress-actual {
  background: var(--color-negative);
}

.spending-guard__progress--critical .spending-guard__progress-committed,
.spending-guard__progress--exceeded .spending-guard__progress-committed {
  background: color-mix(in srgb, var(--color-negative) 28%, white);
}

.spending-guard__today-marker {
  position: absolute;
  top: -0.25rem;
  z-index: 2;
  width: 1rem;
  height: 1.15rem;
  transform: translateX(-50%);
  cursor: help;
}

.spending-guard__today-marker::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: var(--color-ink-muted);
  content: "";
  transform: translateX(-50%);
}

.spending-guard__today-marker:focus {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.spending-guard__tooltip {
  position: absolute;
  bottom: calc(100% + 0.55rem);
  left: 50%;
  width: max-content;
  max-width: 13rem;
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

.spending-guard__tooltip::after {
  position: absolute;
  top: 100%;
  left: 50%;
  border: 0.3rem solid transparent;
  border-top-color: var(--color-nav);
  content: "";
  transform: translateX(-50%);
}

.spending-guard__today-marker:hover .spending-guard__tooltip,
.spending-guard__today-marker:focus .spending-guard__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.spending-guard__progress-meta {
  display: flex;
  margin-top: var(--space-2);
  justify-content: space-between;
  gap: var(--space-4);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.spending-guard__no-income {
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: var(--text-xs);
}

.spending-guard__stats {
  display: grid;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.spending-guard__stats > div {
  position: relative;
  padding: var(--space-4) var(--space-6);
}

.spending-guard__stats > div + div {
  border-left: 1px solid var(--color-border);
}

.spending-guard__stat-icon {
  position: absolute;
  top: var(--space-4);
  right: var(--space-5);
  color: var(--color-ink-muted);
}

.spending-guard__stats strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.spending-guard__stats strong.is-negative {
  color: var(--color-negative-ink);
}

.spending-guard__stats small {
  display: block;
  margin-top: var(--space-1);
}

.spending-guard__footer {
  display: flex;
  padding: var(--space-4) var(--space-6);
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.spending-guard__footer span:not([aria-hidden]) {
  display: inline-flex;
  gap: var(--space-1);
}

@media (max-width: 760px) {
  .spending-guard__loading-grid,
  .spending-guard__headline,
  .spending-guard__stats {
    grid-template-columns: 1fr;
  }

  .spending-guard__header {
    flex-direction: column;
  }

  .spending-guard__headline {
    gap: var(--space-3);
  }

  .spending-guard__headline strong {
    font-size: var(--text-xl);
  }

  .spending-guard__stats > div + div {
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }

  .spending-guard__footer {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }

  .spending-guard__footer span[aria-hidden] {
    display: none;
  }
}

@media (max-width: 480px) {
  .spending-guard__loading,
  .spending-guard__main,
  .spending-guard__stats > div,
  .spending-guard__footer {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }

  .spending-guard__progress-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-1);
  }
}
</style>
