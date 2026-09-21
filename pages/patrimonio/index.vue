<script setup lang="ts">
import { ArrowRight, Banknote, BriefcaseBusiness, Building2, CarFront, ChartNoAxesCombined, Info, Landmark, Pencil, Plus, Trash2 } from '@lucide/vue'
import type { Asset, AssetProjectionReport, AssetType } from '~/types/asset'
import { formatDateBr } from '~/utils/dateMoney'

const drawerOpen = ref(false)
const editingAsset = ref<Asset | null>(null)
const deleteDialogOpen = ref(false)
const pendingDeletion = ref<Asset | null>(null)
const deleting = ref(false)
const { data: report, pending, error, refresh } = await useFetch<AssetProjectionReport>('/api/assets', {
  query: { months: 12 },
  default: () => null,
})

const typeMeta: Record<AssetType, { label: string; icon: typeof Landmark }> = {
  fgts: { label: 'FGTS', icon: Landmark },
  investment: { label: 'Investimento', icon: ChartNoAxesCombined },
  reserve: { label: 'Reserva', icon: Banknote },
  property: { label: 'Imóvel', icon: Building2 },
  vehicle: { label: 'Veículo', icon: CarFront },
  other: { label: 'Outro', icon: BriefcaseBusiness },
}

function openDrawer(asset: Asset | null) {
  editingAsset.value = asset
  drawerOpen.value = true
}

function openAsset(asset: Asset) {
  return navigateTo(`/patrimonio/${asset.id}`)
}

function requestAssetRemoval(asset: Asset) {
  pendingDeletion.value = asset
  deleteDialogOpen.value = true
}

async function confirmAssetRemoval() {
  if (!pendingDeletion.value) return
  deleting.value = true
  try {
    await $fetch(`/api/assets/${pendingDeletion.value.id}`, { method: 'DELETE' })
    deleteDialogOpen.value = false
    pendingDeletion.value = null
    await refresh()
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="assets-page">
    <PageHeading
      eyebrow="Financeiro / Patrimônio"
      title="Patrimônio"
      description="Escolha um item para acompanhar sua evolução, projeção e histórico separadamente."
    >
      <template #actions>
        <UiButton @click="openDrawer(null)">
          <template #leading><Plus /></template>
          Novo patrimônio
        </UiButton>
      </template>
    </PageHeading>

    <div class="assets-notice">
      <Info aria-hidden="true" />
      <p><strong>Visão separada.</strong> FGTS, reservas e investimentos têm projeções próprias e não alteram contas, fluxo de caixa ou dívidas.</p>
    </div>

    <UiEmptyState v-if="error" title="Não foi possível carregar o patrimônio" description="Tente novamente em instantes." />

    <template v-else>
      <section class="asset-overview" aria-label="Resumo do patrimônio">
        <template v-if="pending && !report">
          <UiCard v-for="index in 3" :key="index">
            <UiSkeleton width="8rem" height="0.75rem" />
            <UiSkeleton width="9rem" height="1.5rem" class="assets-page__gap" />
          </UiCard>
        </template>
        <template v-else-if="report">
          <UiCard class="asset-overview__card asset-overview__card--primary">
            <span>Patrimônio estimado hoje</span>
            <strong><UiMoney :value="report.currentTotal" /></strong>
            <small>Soma dos itens acompanhados</small>
          </UiCard>
          <UiCard class="asset-overview__card">
            <span>Saldos confirmados</span>
            <strong><UiMoney :value="report.registeredTotal" /></strong>
            <small>Últimos valores informados</small>
          </UiCard>
          <UiCard class="asset-overview__card">
            <span>Itens acompanhados</span>
            <strong>{{ report.assets.length }}</strong>
            <small>Cada um com histórico e projeção próprios</small>
          </UiCard>
        </template>
      </section>

      <section v-if="report?.assets.length" class="asset-list-section">
        <header class="asset-list-section__header">
          <div>
            <h2>Seus patrimônios</h2>
            <p>Clique em um card para abrir a análise individual.</p>
          </div>
          <span>{{ report.assets.length }} {{ report.assets.length === 1 ? 'item' : 'itens' }}</span>
        </header>

        <div class="asset-list">
          <UiCard
            v-for="asset in report.assets"
            :key="asset.id"
            class="asset-item"
            padding="md"
            role="link"
            tabindex="0"
            :aria-label="`Abrir detalhes de ${asset.name}`"
            @click="openAsset(asset)"
            @keydown.enter="openAsset(asset)"
          >
            <div class="asset-item__top">
              <div class="asset-item__identity">
                <span class="asset-item__icon"><component :is="typeMeta[asset.type].icon" aria-hidden="true" /></span>
                <div>
                  <strong>{{ asset.name }}</strong>
                  <span>{{ typeMeta[asset.type].label }} · saldo em {{ formatDateBr(asset.balanceDate) }}</span>
                </div>
              </div>
              <div class="asset-item__actions">
                <button type="button" :aria-label="`Editar ${asset.name}`" @click.stop="openDrawer(asset)"><Pencil aria-hidden="true" /></button>
                <button type="button" :aria-label="`Excluir ${asset.name}`" @click.stop="requestAssetRemoval(asset)"><Trash2 aria-hidden="true" /></button>
              </div>
            </div>

            <div class="asset-item__balance">
              <span>Estimado hoje</span>
              <strong><UiMoney :value="asset.estimatedCurrentBalance" /></strong>
              <small>Confirmado: <UiMoney :value="asset.currentBalance" /></small>
            </div>

            <dl class="asset-item__details">
              <div><dt>Aporte mensal</dt><dd><UiMoney :value="asset.monthlyContribution" /></dd></div>
              <div><dt>Rendimento</dt><dd>{{ asset.annualYieldRate.toLocaleString('pt-BR') }}% a.a.</dd></div>
              <div><dt>Em 12 meses</dt><dd><UiMoney :value="asset.projectedBalance" /></dd></div>
            </dl>

            <div class="asset-item__open"><span>Ver evolução e extrato</span><ArrowRight aria-hidden="true" /></div>
          </UiCard>
        </div>
      </section>

      <UiCard v-else-if="!pending" class="asset-empty" padding="none">
        <UiEmptyState title="Nenhum patrimônio cadastrado" description="Cadastre o FGTS, uma reserva ou outro bem para acompanhar cada evolução separadamente.">
          <template #icon><Landmark /></template>
          <template #action>
            <UiButton @click="openDrawer(null)"><template #leading><Plus /></template>Cadastrar patrimônio</UiButton>
          </template>
        </UiEmptyState>
      </UiCard>
    </template>

    <AssetsAssetFormDrawer v-model:open="drawerOpen" :asset="editingAsset" @saved="refresh" />
    <UiConfirmDialog
      v-model:open="deleteDialogOpen"
      title="Excluir patrimônio"
      :description="`Excluir ${pendingDeletion?.name ?? 'este item'} e todo o seu histórico? Esta ação não pode ser desfeita.`"
      confirm-label="Excluir patrimônio"
      :busy="deleting"
      @confirm="confirmAssetRemoval"
      @cancel="pendingDeletion = null"
    />
  </div>
</template>

<style scoped>
.assets-page__gap { margin-top: var(--space-4); }
.assets-notice { display: flex; padding: var(--space-4); margin-top: var(--space-5); align-items: flex-start; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-ink-secondary); font-size: var(--text-xs); line-height: var(--leading-relaxed); }
.assets-notice svg { width: 1rem; height: 1rem; margin-top: 0.1rem; flex: 0 0 auto; color: var(--color-brand); }
.assets-notice strong { color: var(--color-ink); }
.asset-overview { display: grid; margin-top: var(--space-4); grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.asset-overview__card span { color: var(--color-ink-secondary); font-size: var(--text-xs); }
.asset-overview__card strong { display: block; margin-top: var(--space-4); color: var(--color-ink); font-size: var(--text-xl); font-weight: var(--weight-semibold); line-height: var(--leading-tight); }
.asset-overview__card small { display: block; margin-top: var(--space-3); color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-overview__card--primary strong { color: var(--color-brand); }
.asset-list-section { padding-top: var(--space-6); }
.asset-list-section__header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); }
.asset-list-section__header h2 { color: var(--color-ink); font-size: var(--text-lg); font-weight: var(--weight-semibold); }
.asset-list-section__header p { margin-top: var(--space-1); color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-list-section__header > span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-list { display: grid; margin-top: var(--space-4); grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.asset-item { min-width: 0; cursor: pointer; transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
.asset-item:hover, .asset-item:focus-visible { border-color: color-mix(in srgb, var(--color-brand) 45%, var(--color-border)); box-shadow: var(--shadow-sm); transform: translateY(-2px); outline: none; }
.asset-item__top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.asset-item__identity { display: flex; min-width: 0; align-items: center; gap: var(--space-3); }
.asset-item__icon { display: grid; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; place-items: center; border-radius: var(--radius-sm); background: var(--color-brand-soft); color: var(--color-brand); }
.asset-item__icon svg { width: 1.1rem; height: 1.1rem; }
.asset-item__identity div { min-width: 0; }
.asset-item__identity strong { display: block; overflow: hidden; color: var(--color-ink); font-size: var(--text-sm); text-overflow: ellipsis; white-space: nowrap; }
.asset-item__identity div > span { display: block; margin-top: var(--space-1); color: var(--color-ink-muted); font-size: 0.6875rem; }
.asset-item__actions { display: flex; gap: var(--space-1); }
.asset-item__actions button { display: grid; width: 1.9rem; height: 1.9rem; padding: 0; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.asset-item__actions button:hover { background: var(--color-surface-subtle); color: var(--color-ink); }
.asset-item__actions svg { width: 0.95rem; height: 0.95rem; }
.asset-item__balance { margin-top: var(--space-6); }
.asset-item__balance > span { display: block; color: var(--color-ink-muted); font-size: var(--text-xs); }
.asset-item__balance strong { display: block; margin-top: var(--space-1); color: var(--color-ink); font-size: var(--text-2xl); line-height: var(--leading-tight); }
.asset-item__balance small { display: block; margin-top: var(--space-2); color: var(--color-ink-muted); font-size: 0.6875rem; }
.asset-item__details { display: grid; padding-top: var(--space-4); margin: var(--space-5) 0 0; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); border-top: 1px solid var(--color-border); }
.asset-item__details dt { color: var(--color-ink-muted); font-size: 0.625rem; }
.asset-item__details dd { margin: var(--space-1) 0 0; color: var(--color-ink); font-size: var(--text-xs); font-weight: var(--weight-medium); }
.asset-item__open { display: flex; padding-top: var(--space-4); margin-top: var(--space-4); align-items: center; justify-content: space-between; border-top: 1px solid var(--color-border); color: var(--color-brand); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.asset-item__open svg { width: 1rem; height: 1rem; transition: transform 160ms ease; }
.asset-item:hover .asset-item__open svg { transform: translateX(0.2rem); }
.asset-empty { margin-top: var(--space-5); }
@media (max-width: 1000px) { .asset-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .asset-overview, .asset-list { grid-template-columns: 1fr; } }
</style>
