<script setup lang="ts">
import {
  Landmark,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from '@lucide/vue'

const {
  selectedMonth,
  selectedYear,
  selectedMonthNumber,
  isLoading,
  canGoPrevious,
  canGoNext,
  isCurrentMonth,
  changeMonth,
  goToCurrentMonth,
  selectMonth,
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
          :year="selectedYear"
          :month="selectedMonthNumber"
          :can-go-previous="canGoPrevious"
          :can-go-next="canGoNext"
          :is-current="isCurrentMonth"
          @previous="changeMonth(-1)"
          @next="changeMonth(1)"
          @current="goToCurrentMonth"
          @select="selectMonth"
        />
      </template>
    </PageHeading>

    <section class="overview" aria-labelledby="overview-title">
      <AkSectionHeader class="overview__heading">
        <span id="overview-title">Resumo financeiro</span>
        <template #action>
          <p class="overview__updated">
            <span aria-hidden="true" />
            Atualizado: {{ selectedMonth?.updatedAt ?? '—' }}
          </p>
        </template>
      </AkSectionHeader>

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
  margin-bottom: var(--space-4);
}

.overview__updated {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
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
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-2);
  }
}
</style>
