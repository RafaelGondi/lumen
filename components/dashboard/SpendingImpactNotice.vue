<script setup lang="ts">
import { CircleCheck, TriangleAlert, X } from '@lucide/vue'
import type { CardExpenseSaveResult } from '~/types/cardExpense'
import type { SpendingGuardReport } from '~/types/spendingGuard'

const props = defineProps<{
  report: SpendingGuardReport
  purchase: CardExpenseSaveResult
}>()

defineEmits<{ close: [] }>()

const isWarning = computed(() =>
  ['attention', 'critical', 'exceeded'].includes(props.report.status),
)
const exceededBy = computed(() =>
  Math.max(0, -props.report.remainingToLimit),
)
const actualExceeded = computed(() => props.report.spentPercent >= 100)
const commitmentsExceeded = computed(
  () =>
    !actualExceeded.value &&
    props.report.committedPercent >= 100,
)
const projectedRisk = computed(
  () =>
    props.report.futureCommitted > 0 &&
    props.report.committedPercent > props.report.spentPercent &&
    props.report.committedPercent >= 75,
)
</script>

<template>
  <div
    class="spending-impact"
    :class="{ 'spending-impact--warning': isWarning }"
    role="status"
    aria-live="polite"
  >
    <span class="spending-impact__icon">
      <TriangleAlert v-if="isWarning" aria-hidden="true" />
      <CircleCheck v-else aria-hidden="true" />
    </span>

    <div class="spending-impact__content">
      <strong>
        {{
          actualExceeded
            ? 'Compra registrada — limite mensal ultrapassado'
            : commitmentsExceeded
              ? 'Compra registrada — compromissos acima do limite'
              : isWarning
                ? 'Compra registrada — atenção ao limite mensal'
                : 'Compra registrada no radar de gastos'
        }}
      </strong>
      <p v-if="report.status === 'no-income'">
        A compra já conta em {{ report.fullLabel.toLowerCase() }}. Cadastre uma
        receita para o Lumen calcular o limite mensal.
      </p>
      <p v-else-if="actualExceeded">
        Você usou {{ report.spentPercent.toLocaleString('pt-BR') }}% do limite e
        ultrapassou em <UiMoney :value="exceededBy" />.
      </p>
      <p v-else-if="projectedRisk">
        Você usou {{ report.spentPercent.toLocaleString('pt-BR') }}% do limite.
        Com os compromissos previstos, chega a
        {{ report.committedPercent.toLocaleString('pt-BR') }}%.
      </p>
      <p v-else>
        Você usou {{ report.spentPercent.toLocaleString('pt-BR') }}% do limite.
        Ainda restam <UiMoney :value="report.remainingToLimit" />.
      </p>
      <small v-if="purchase.isInstallment">
        Esta parcela: <UiMoney :value="purchase.amount" /> · compromisso total:
        <UiMoney :value="purchase.commitmentTotal" />
      </small>
      <small v-else>
        A compra conta pela data da transação, não pelo vencimento da fatura.
      </small>
    </div>

    <button
      type="button"
      aria-label="Fechar aviso"
      @click="$emit('close')"
    >
      <X aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.spending-impact {
  display: flex;
  padding: var(--space-4);
  align-items: flex-start;
  gap: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--color-positive) 35%, white);
  border-radius: var(--radius-md);
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
}

.spending-impact--warning {
  border-color: color-mix(in srgb, var(--color-warning) 35%, white);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.spending-impact__icon {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  place-items: center;
}

.spending-impact__icon svg {
  width: 1.15rem;
  height: 1.15rem;
}

.spending-impact__content {
  min-width: 0;
  flex: 1;
}

.spending-impact__content strong {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.spending-impact__content p {
  margin-top: var(--space-1);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.spending-impact__content small {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.spending-impact > button {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  flex-shrink: 0;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

.spending-impact > button:hover {
  background: rgb(0 0 0 / 5%);
}

.spending-impact > button svg {
  width: 1rem;
  height: 1rem;
}
</style>
