<script setup lang="ts">
import { ArrowLeft, Pencil, ReceiptText, TrendingUp } from '@lucide/vue'
import type { Asset, AssetProjectionReport, AssetType } from '~/types/asset'
import { formatDateBr } from '~/utils/dateMoney'

const route = useRoute()
const assetId = Number(route.params.id)
const months = ref(12)
const drawerOpen = ref(false)
const statementOpen = ref(false)

const { data: report, pending, error, refresh } = await useFetch<AssetProjectionReport>('/api/assets', {
  query: computed(() => ({ months: months.value, assetId })),
  default: () => null,
})

const asset = computed<Asset | null>(() => report.value?.assets[0] ?? null)
const typeLabels: Record<AssetType, string> = {
  fgts: 'FGTS',
  investment: 'Investimento',
  reserve: 'Reserva',
  property: 'Imóvel',
  vehicle: 'Veículo',
  other: 'Outro',
}

function horizonLabel() {
  return `${months.value} meses`
}
</script>

<template>
  <div class="asset-detail">
    <NuxtLink to="/patrimonio" class="asset-detail__back"><ArrowLeft aria-hidden="true" /> Voltar ao patrimônio</NuxtLink>

    <UiEmptyState
      v-if="error"
      title="Patrimônio não encontrado"
      description="Volte à lista e escolha outro item."
    />

    <template v-else-if="asset && report">
      <PageHeading
        eyebrow="Financeiro / Patrimônio"
        :title="asset.name"
        :description="`${typeLabels[asset.type]} · saldo confirmado em ${formatDateBr(asset.balanceDate)}`"
      >
        <template #actions>
          <UiButton variant="ghost" @click="drawerOpen = true">
            <template #leading><Pencil /></template>
            Editar
          </UiButton>
          <UiButton @click="statementOpen = true">
            <template #leading><ReceiptText /></template>
            Extrato e correções
          </UiButton>
        </template>
      </PageHeading>

      <section class="asset-kpis" :aria-label="`Resumo de ${asset.name}`">
        <UiCard class="asset-kpi asset-kpi--primary">
          <span>Estimado hoje</span>
          <strong><UiMoney :value="asset.estimatedCurrentBalance" /></strong>
          <small>Confirmado: <UiMoney :value="asset.currentBalance" /></small>
        </UiCard>
        <UiCard class="asset-kpi">
          <span>Aporte mensal</span>
          <strong><UiMoney :value="asset.monthlyContribution" /></strong>
          <small>Crescimento recorrente cadastrado</small>
        </UiCard>
        <UiCard class="asset-kpi asset-kpi--positive">
          <span>Projeção em {{ horizonLabel() }}</span>
          <strong><UiMoney :value="report.projectedTotal" /></strong>
          <small>Aportes e rendimentos deste item</small>
        </UiCard>
        <UiCard class="asset-kpi">
          <span>Rendimento estimado</span>
          <strong><UiMoney :value="report.projectedEarnings" /></strong>
          <small>{{ asset.annualYieldRate.toLocaleString('pt-BR') }}% ao ano</small>
        </UiCard>
      </section>

      <UiCard class="asset-projection" padding="none">
        <header class="asset-section-header">
          <div class="asset-section-header__icon"><TrendingUp aria-hidden="true" /></div>
          <div>
            <h2>Evolução projetada de {{ asset.name }}</h2>
            <p>Esta curva considera somente o saldo, os aportes e o rendimento deste patrimônio.</p>
          </div>
          <div class="asset-horizon" aria-label="Horizonte da projeção">
            <button
              v-for="option in [6, 12, 18]"
              :key="option"
              type="button"
              :class="{ 'is-active': months === option }"
              @click="months = option"
            >
              {{ option }} meses
            </button>
          </div>
        </header>
        <div class="asset-projection__body">
          <UiSkeleton v-if="pending" height="20rem" radius="md" />
          <AssetsAssetProjectionChart v-else :points="report.points" />
        </div>
        <footer class="asset-projection__footer">
          <span><strong><UiMoney :value="report.projectedContributions" /></strong> em novos aportes</span>
          <span><strong><UiMoney :value="report.projectedEarnings" /></strong> em rendimento estimado</span>
        </footer>
      </UiCard>

      <UiCard v-if="asset.notes" class="asset-notes">
        <span>Observação</span>
        <p>{{ asset.notes }}</p>
      </UiCard>

      <AssetsAssetFormDrawer v-model:open="drawerOpen" :asset="asset" @saved="refresh" />
      <AssetsAssetStatementDrawer v-model:open="statementOpen" :asset="asset" @changed="refresh" />
    </template>

    <section v-else class="asset-detail__loading">
      <UiSkeleton width="8rem" height="0.75rem" />
      <UiSkeleton width="18rem" height="2.5rem" />
      <div><UiSkeleton v-for="index in 4" :key="index" height="8rem" radius="md" /></div>
      <UiSkeleton height="27rem" radius="md" />
    </section>
  </div>
</template>

<style scoped>
.asset-detail__back { display: inline-flex; margin-bottom: var(--space-4); align-items: center; gap: var(--space-2); color: var(--color-brand); font-size: var(--text-xs); font-weight: var(--weight-semibold); text-decoration: none; }
.asset-detail__back svg { width: 1rem; height: 1rem; }
.asset-kpis { display: grid; margin-top: var(--space-5); grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.asset-kpi span { color: var(--color-ink-secondary); font-size: var(--text-xs); }
.asset-kpi strong { display: block; margin-top: var(--space-4); color: var(--color-ink); font-size: var(--text-xl); font-weight: var(--weight-semibold); line-height: var(--leading-tight); }
.asset-kpi small { display: block; margin-top: var(--space-3); color: var(--color-ink-muted); font-size: var(--text-xs); line-height: var(--leading-relaxed); }
.asset-kpi--primary strong { color: var(--color-brand); }
.asset-kpi--positive strong { color: var(--color-positive-ink); }
.asset-projection { margin-top: var(--space-5); }
.asset-section-header { display: flex; min-height: 5rem; padding: var(--space-4) var(--space-5); align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--color-border); }
.asset-section-header__icon { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border-radius: var(--radius-sm); background: var(--color-brand-soft); color: var(--color-brand); }
.asset-section-header__icon svg { width: 1rem; height: 1rem; }
.asset-section-header h2 { color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.asset-section-header p { margin-top: var(--space-1); color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-horizon { display: flex; padding: 0.2rem; margin-left: auto; gap: 0.15rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface-subtle); }
.asset-horizon button { min-height: 1.85rem; padding: 0 var(--space-3); border: 0; border-radius: calc(var(--radius-sm) - 2px); background: transparent; color: var(--color-ink-muted); font-size: var(--text-xs); cursor: pointer; }
.asset-horizon button.is-active { background: var(--color-surface); color: var(--color-ink); font-weight: var(--weight-semibold); box-shadow: var(--shadow-xs); }
.asset-projection__body { padding: var(--space-5); }
.asset-projection__footer { display: flex; padding: var(--space-4) var(--space-5); gap: var(--space-8); border-top: 1px solid var(--color-border); color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-projection__footer strong { color: var(--color-ink); }
.asset-notes { margin-top: var(--space-5); }
.asset-notes span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-notes p { margin-top: var(--space-2); color: var(--color-ink); font-size: var(--text-sm); line-height: var(--leading-relaxed); }
.asset-detail__loading { display: flex; flex-direction: column; gap: var(--space-5); }
.asset-detail__loading > div { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
@media (max-width: 1000px) { .asset-kpis, .asset-detail__loading > div { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .asset-kpis, .asset-detail__loading > div { grid-template-columns: 1fr; } .asset-section-header { align-items: flex-start; flex-wrap: wrap; } .asset-horizon { width: 100%; margin-left: 0; } .asset-horizon button { flex: 1; } .asset-projection__footer { flex-direction: column; gap: var(--space-2); } }
</style>
