<script setup lang="ts">
import {
  Landmark,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from '@lucide/vue'

const {
  selectedMonth,
  isLoading,
  canGoPrevious,
  canGoNext,
  isCurrentMonth,
  changeMonth,
  goToCurrentMonth,
} = useFinanceDashboard()
</script>

<template>
  <div>
    <PageHeading
      eyebrow="Financeiro / Visão geral"
      title="Fluxo de caixa"
      description="Acompanhe entradas, despesas e a posição consolidada do período."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="selectedMonth?.fullLabel ?? 'Carregando…'"
          :can-go-previous="canGoPrevious"
          :can-go-next="canGoNext"
          :is-current="isCurrentMonth"
          @previous="changeMonth(-1)"
          @next="changeMonth(1)"
          @current="goToCurrentMonth"
        />
      </template>
    </PageHeading>

    <section class="overview" aria-labelledby="overview-title">
      <div class="overview__heading">
        <div>
          <h2 id="overview-title">Resumo financeiro</h2>
          <p>
            Posição consolidada de
            {{ selectedMonth?.fullLabel.toLowerCase() ?? '…' }}
          </p>
        </div>
        <p class="overview__updated">
          <span aria-hidden="true" />
          Atualizado: {{ selectedMonth?.updatedAt ?? '—' }}
        </p>
      </div>

      <DashboardSkeleton v-if="isLoading || !selectedMonth" />

      <div v-else :key="selectedMonth.key" class="dashboard-content">
        <DashboardStatsCarousel
          :previous-balance="selectedMonth.stats.previousBalance"
          :revenues="selectedMonth.stats.revenues"
          :expenses="selectedMonth.stats.expenses"
          :current-balance="selectedMonth.stats.currentBalance"
        />

        <div class="lists-grid">
          <DashboardFinanceListSection
            title="Contas a pagar"
            kind="payables"
            :section="selectedMonth.payables"
            empty-title="Nenhuma conta a pagar"
            empty-description="Não há despesas neste período."
          />
          <DashboardFinanceListSection
            title="Entradas"
            kind="incomes"
            :section="selectedMonth.incomes"
            empty-title="Nenhuma entrada no período"
            empty-description="Registre receitas para vê-las aqui."
          />
        </div>

        <DashboardSpendingGuard
          class="spending-guard-section"
          :month="selectedMonth.key"
        />

        <DashboardLimitsOverview
          class="limits-overview-section"
          :month="selectedMonth.key"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview {
  margin-top: var(--space-8);
}

.lists-grid {
  display: grid;
  margin-top: var(--space-5);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: var(--space-4);
}

.spending-guard-section,
.limits-overview-section {
  margin-top: var(--space-5);
}

.overview__heading {
  display: flex;
  margin-bottom: var(--space-4);
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
}

.overview__heading h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.overview__heading > div p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.overview__updated {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.overview__updated span {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--color-positive);
}

.dashboard-content {
  animation: content-in var(--transition-base) both;
}

@keyframes content-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 900px) {
  .lists-grid {
    grid-template-columns: 1fr;
  }

  .overview__heading {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}
</style>
