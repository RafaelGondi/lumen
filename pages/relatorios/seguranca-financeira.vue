<script setup lang="ts">
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CarFront,
  ChartNoAxesCombined,
  Info,
  Landmark,
  Plus,
  ShieldCheck,
} from '@lucide/vue'
import type { AssetType } from '~/types/asset'
import type { FinancialSecurityReport } from '~/types/financialSecurity'

const route = useRoute()
const requestedCostMode = computed<'historical' | 'projected' | undefined>(() => {
  const value = route.query.costMode
  return value === 'historical' || value === 'projected' ? value : undefined
})
const { data: report, pending, error, refresh } = await useFetch<FinancialSecurityReport>('/api/reports/financial-security', {
  query: computed(() => requestedCostMode.value ? { costMode: requestedCostMode.value } : {}),
  default: () => null,
})

const selectedIds = ref<number[]>([])
const costMode = computed<'historical' | 'projected'>(() => requestedCostMode.value ?? report.value?.costMode ?? 'historical')
const chartScope = computed<'all' | 'future'>(() => route.query.scope === 'future' ? 'future' : 'all')
const chartHorizon = computed<'6' | '12' | '18'>(() => {
  const value = route.query.horizon
  return value === '6' || value === '12' || value === '18' ? value : '18'
})
const chartHorizonValues = ['6', '12', '18'] as const
const saving = ref(false)
const filterLoading = ref(false)
let filterLoadingTimer: ReturnType<typeof setTimeout> | undefined
const saved = ref(false)
const saveError = ref('')
const assetDrawerOpen = ref(false)

const typeMeta: Record<AssetType, { label: string; icon: typeof Landmark }> = {
  fgts: { label: 'FGTS', icon: Landmark },
  investment: { label: 'Investimento', icon: ChartNoAxesCombined },
  reserve: { label: 'Reserva', icon: Banknote },
  property: { label: 'Imóvel', icon: Building2 },
  vehicle: { label: 'Veículo', icon: CarFront },
  other: { label: 'Outro', icon: BriefcaseBusiness },
}

watch(report, (value) => {
  if (!value) return
  selectedIds.value = value.assets.filter(asset => asset.enabled).map(asset => asset.id)
}, { immediate: true })

const allSelected = computed(() => Boolean(report.value?.assets.length)
  && report.value!.assets.every(asset => selectedIds.value.includes(asset.id)))
const coverageInTwelveMonths = computed(() => report.value?.points
  .filter(point => point.kind === 'projected')[11]?.coverageMonths ?? report.value?.coverageMonths ?? 0)
const coverageChange = computed(() => coverageInTwelveMonths.value - (report.value?.coverageMonths ?? 0))
const visiblePoints = computed(() => {
  if (!report.value) return []
  const future = report.value.points
    .filter(point => point.kind !== 'historical')
    .slice(0, Number(chartHorizon.value) + 1)
  if (chartScope.value === 'future') return future
  return [...report.value.points.filter(point => point.kind === 'historical'), ...future]
})
const horizonCoverage = computed(() => report.value?.points
  .filter(point => point.kind === 'projected')[Number(chartHorizon.value) - 1]?.coverageMonths
  ?? report.value?.coverageMonths
  ?? 0)
const isFiltering = computed(() => filterLoading.value || (pending.value && Boolean(report.value)))

watch(() => route.fullPath, async () => {
  await nextTick()
  if (filterLoadingTimer) clearTimeout(filterLoadingTimer)
  filterLoadingTimer = setTimeout(() => {
    filterLoading.value = false
  }, 350)
})

onBeforeUnmount(() => {
  if (filterLoadingTimer) clearTimeout(filterLoadingTimer)
})

function toggleAsset(id: number) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(value => value !== id)
    : [...selectedIds.value, id]
  saved.value = false
}

function toggleAll() {
  const clear = allSelected.value
  selectedIds.value = clear ? [] : report.value?.assets.map(asset => asset.id) ?? []
  saved.value = false
}

function coverageLabel(value: number) {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${value === 1 ? 'mês' : 'meses'}`
}

function chartFilterHref(scope = chartScope.value, horizon = chartHorizon.value) {
  const query = new URLSearchParams()
  if (requestedCostMode.value) query.set('costMode', requestedCostMode.value)
  if (scope === 'future') query.set('scope', 'future')
  if (horizon !== '18') query.set('horizon', horizon)
  const suffix = query.toString()
  return `/relatorios/seguranca-financeira${suffix ? `?${suffix}` : ''}`
}

function costModeHref(mode: 'historical' | 'projected') {
  const query = new URLSearchParams({ costMode: mode })
  if (chartScope.value === 'future') query.set('scope', 'future')
  if (chartHorizon.value !== '18') query.set('horizon', chartHorizon.value)
  return `/relatorios/seguranca-financeira?${query.toString()}`
}

function beginFilterUpdate(target: string) {
  if (target === route.fullPath) return
  filterLoading.value = true
}

async function saveConfiguration() {
  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    const updated = await $fetch<FinancialSecurityReport>('/api/reports/financial-security', {
      method: 'POST',
      body: {
        assetIds: selectedIds.value,
        costMode: costMode.value,
      },
    })
    report.value = updated
    saved.value = true
  }
  catch {
    saveError.value = 'Não foi possível salvar a configuração.'
  }
  finally {
    saving.value = false
  }
}

async function handleAssetSaved() {
  await refresh()
  saved.value = false
}
</script>

<template>
  <div class="security-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Segurança financeira"
      description="Entenda por quanto tempo o patrimônio escolhido sustenta seu custo de vida."
    />

    <ReportsReportTabs />

    <UiEmptyState v-if="error" title="Não foi possível carregar a análise" description="Tente novamente em instantes." />

    <template v-else>
      <section class="security-kpis" aria-label="Resumo da segurança financeira">
        <UiCard v-for="index in 4" v-if="pending" :key="index">
          <UiSkeleton width="8rem" height="0.75rem" />
          <UiSkeleton width="9rem" height="1.5rem" class="security-page__gap" />
        </UiCard>
        <template v-else-if="report">
          <UiCard class="security-kpi security-kpi--primary">
            <span>Patrimônio considerado</span>
            <strong><UiMoney :value="report.currentTotal" /></strong>
            <small>saldo projetado em contas + {{ selectedIds.length }} {{ selectedIds.length === 1 ? 'patrimônio externo' : 'patrimônios externos' }}</small>
          </UiCard>
          <UiCard class="security-kpi">
            <span>Custo mensal considerado</span>
            <strong><UiMoney :value="report.monthlyCost" /></strong>
            <small>{{ report.costMode === 'historical' ? 'média dos 3 últimos meses completos' : 'despesas previstas nos próximos 3 meses' }}</small>
          </UiCard>
          <UiCard class="security-kpi security-kpi--coverage">
            <span>Cobertura em 12 meses</span>
            <strong>{{ coverageLabel(coverageInTwelveMonths) }}</strong>
            <small>com a evolução prevista do seu saldo</small>
          </UiCard>
          <UiCard class="security-kpi">
            <span>Cobertura atual</span>
            <strong>{{ coverageLabel(report.coverageMonths) }}</strong>
            <small :class="coverageChange >= 0 ? 'is-positive' : 'is-negative'">
              {{ coverageChange >= 0 ? '+' : '−' }}{{ coverageLabel(Math.abs(coverageChange)) }} em 12 meses
            </small>
          </UiCard>
        </template>
      </section>

      <div v-if="report" class="security-notice">
        <Info aria-hidden="true" />
        <p><strong>A mesma base da Projeção.</strong> O saldo das contas e os lançamentos conhecidos entram automaticamente. Aqui você escolhe apenas quais patrimônios externos podem sustentar seu custo de vida.</p>
      </div>

      <UiCard v-if="report" class="security-chart-card" padding="none">
        <header class="security-section-header security-section-header--chart">
          <div class="security-section-header__icon"><ShieldCheck aria-hidden="true" /></div>
          <div class="security-section-header__copy">
            <h2>Evolução da cobertura do custo de vida</h2>
            <p>Histórico recente; no futuro, os saldos em contas seguem o pior saldo mensal da projeção financeira.</p>
          </div>
          <div class="security-chart-controls">
            <div class="security-segmented" role="group" aria-label="Período inicial do gráfico">
              <NuxtLink :to="chartFilterHref('all')" :aria-current="chartScope === 'all' ? 'true' : undefined" :class="{ 'is-active': chartScope === 'all' }" @click="beginFilterUpdate(chartFilterHref('all'))">Com histórico</NuxtLink>
              <NuxtLink :to="chartFilterHref('future')" :aria-current="chartScope === 'future' ? 'true' : undefined" :class="{ 'is-active': chartScope === 'future' }" @click="beginFilterUpdate(chartFilterHref('future'))">Daqui pra frente</NuxtLink>
            </div>
            <div class="security-segmented" role="group" aria-label="Horizonte do gráfico">
              <NuxtLink v-for="months in chartHorizonValues" :key="months" :to="chartFilterHref(chartScope, months)" :aria-current="chartHorizon === months ? 'true' : undefined" :class="{ 'is-active': chartHorizon === months }" @click="beginFilterUpdate(chartFilterHref(chartScope, months))">{{ months }} meses</NuxtLink>
            </div>
          </div>
        </header>
        <div class="security-chart-stage" :aria-busy="isFiltering">
          <UiSkeleton v-if="isFiltering" height="23rem" radius="md" class="security-chart-stage__skeleton" />
          <ReportsFinancialSecurityChart v-else :points="visiblePoints" />
        </div>
        <footer class="security-chart-card__footer">
          <span>Caixa: <strong>pior saldo mensal da Projeção</strong></span>
          <span>Hoje: <strong>{{ coverageLabel(report.coverageMonths) }}</strong></span>
          <span>Em {{ chartHorizon }} meses: <strong>{{ coverageLabel(horizonCoverage) }}</strong></span>
        </footer>
      </UiCard>

      <div v-if="report" class="security-columns">
        <UiCard padding="none" class="security-cost">
          <header class="security-section-header">
            <div>
              <h2>Custo de vida considerado</h2>
              <p>Compare a média recente com as despesas que já estão na Projeção.</p>
            </div>
          </header>
          <div class="security-cost__body">
            <NuxtLink
              role="radio"
              class="security-cost__choice"
              :class="{ 'is-selected': costMode === 'historical' }"
              :aria-checked="costMode === 'historical'"
              :to="costModeHref('historical')"
              @click="beginFilterUpdate(costModeHref('historical'))"
            >
              <span class="security-cost__choice-dot" aria-hidden="true" />
              <span><strong>Média histórica</strong><small>Últimos três meses completos</small></span>
              <strong class="security-cost__choice-value"><UiMoney :value="report.automaticMonthlyCost" /></strong>
            </NuxtLink>
            <div class="security-cost__months">
              <div v-for="month in report.costMonths" :key="month.month">
                <span>{{ month.label }}</span><strong><UiMoney :value="month.amount" /></strong>
              </div>
            </div>
            <NuxtLink
              role="radio"
              class="security-cost__choice security-cost__choice--manual"
              :class="{ 'is-selected': costMode === 'projected' }"
              :aria-checked="costMode === 'projected'"
              :to="costModeHref('projected')"
              @click="beginFilterUpdate(costModeHref('projected'))"
            >
              <span class="security-cost__choice-dot" aria-hidden="true" />
              <span><strong>Despesas previstas</strong><small>Média móvel dos três meses seguintes em cada ponto do gráfico</small></span>
              <strong class="security-cost__choice-value"><UiMoney :value="report.projectedCostMonths.reduce((sum, month) => sum + month.amount, 0) / 3" /></strong>
            </NuxtLink>
            <div class="security-cost__months">
              <div v-for="month in report.projectedCostMonths" :key="month.month">
                <span>{{ month.label }}</span><strong><UiMoney :value="month.amount" /></strong>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard padding="none" class="security-assets">
          <header class="security-section-header security-section-header--actions">
            <div>
              <h2>Patrimônio considerado</h2>
              <p>Contas já vêm da Projeção. Escolha apenas reservas e bens externos.</p>
            </div>
            <div class="security-assets__actions">
              <button type="button" @click="toggleAll">{{ allSelected ? 'Limpar tudo' : 'Selecionar tudo' }}</button>
              <UiButton size="sm" @click="assetDrawerOpen = true"><Plus aria-hidden="true" />Adicionar</UiButton>
            </div>
          </header>
          <div v-if="report.assets.length" class="security-assets__list">
            <label v-for="asset in report.assets" :key="asset.id" class="security-asset">
              <input type="checkbox" :checked="selectedIds.includes(asset.id)" @change="toggleAsset(asset.id)">
              <span class="security-asset__icon"><component :is="typeMeta[asset.type].icon" aria-hidden="true" /></span>
              <span class="security-asset__identity">
                <strong>{{ asset.name }}</strong>
                <small>{{ typeMeta[asset.type].label }} · aporte de <UiMoney :value="asset.monthlyContribution" /></small>
              </span>
              <strong class="security-asset__value"><UiMoney :value="asset.balance" /></strong>
            </label>

          </div>
          <UiEmptyState v-else title="Nenhum patrimônio cadastrado" description="Adicione uma reserva, investimento ou outro item para começar." />
          <footer class="security-assets__footer">
            <span v-if="saveError" class="security-assets__error">{{ saveError }}</span>
            <span v-else-if="saved" class="security-assets__saved">Configuração salva.</span>
            <UiButton :disabled="saving" @click="saveConfiguration">{{ saving ? 'Salvando…' : 'Salvar análise' }}</UiButton>
          </footer>
        </UiCard>
      </div>
    </template>

    <AssetsAssetFormDrawer v-model:open="assetDrawerOpen" :asset="null" @saved="handleAssetSaved" />
  </div>
</template>

<style scoped>
.security-page { display: flex; flex-direction: column; gap: var(--space-4); }
.security-page__gap { margin-top: var(--space-3); }
.security-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.security-kpi { min-height: 8rem; }
.security-kpi span { color: var(--color-ink-secondary); font-size: var(--text-xs); }
.security-kpi strong { display: block; margin-top: var(--space-4); color: var(--color-ink); font-size: var(--text-xl); font-weight: var(--weight-semibold); line-height: var(--leading-tight); }
.security-kpi small { display: block; margin-top: var(--space-3); color: var(--color-ink-muted); font-size: var(--text-xs); }
.security-kpi--primary strong { color: var(--color-brand); }
.security-kpi--coverage strong { color: var(--color-positive); }
.security-kpi small.is-positive { color: var(--color-positive); }
.security-kpi small.is-negative { color: var(--color-negative); }
.security-notice { display: flex; padding: var(--space-4); align-items: flex-start; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-ink-secondary); font-size: var(--text-xs); line-height: var(--leading-relaxed); }
.security-notice svg { width: 1rem; height: 1rem; margin-top: 0.1rem; flex: 0 0 auto; color: var(--color-brand); }
.security-notice strong { color: var(--color-ink); }
.security-section-header { display: flex; padding: var(--space-5); align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--color-border); }
.security-section-header__icon { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border-radius: var(--radius-sm); background: var(--color-brand-soft); color: var(--color-brand); }
.security-section-header__icon svg { width: 1rem; height: 1rem; }
.security-section-header h2 { color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.security-section-header p { margin-top: var(--space-1); color: var(--color-ink-muted); font-size: var(--text-xs); }
.security-section-header--actions { justify-content: space-between; }
.security-section-header__copy { min-width: 0; }
.security-section-header--chart .security-section-header__copy { margin-right: auto; }
.security-chart-controls { display: flex; align-items: center; gap: var(--space-3); }
.security-chart-stage { min-height: 23rem; }
.security-chart-stage__skeleton { margin: var(--space-4) var(--space-5) var(--space-2); width: auto; }
.security-segmented { display: inline-flex; padding: 0.1875rem; gap: 0.125rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.security-segmented a { min-height: 1.875rem; padding: 0 var(--space-3); border-radius: calc(var(--radius-md) - 0.1875rem); color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-medium); line-height: 1.875rem; text-decoration: none; white-space: nowrap; }
.security-segmented a:hover { color: var(--color-ink); }
.security-segmented a.is-active { background: var(--color-surface); color: var(--color-ink); font-weight: var(--weight-semibold); box-shadow: var(--shadow-xs); }
.security-chart-card__footer { display: flex; padding: var(--space-4) var(--space-5); align-items: center; justify-content: space-between; gap: var(--space-7); border-top: 1px solid var(--color-border); color: var(--color-ink-muted); font-size: var(--text-xs); }
.security-chart-card__footer strong { color: var(--color-ink); }
.security-chart-card__footer strong.is-positive { color: var(--color-positive); }
.security-chart-card__footer strong.is-negative { color: var(--color-negative); }
.security-columns { display: grid; grid-template-columns: minmax(18rem, 0.8fr) minmax(26rem, 1.2fr); gap: var(--space-4); align-items: start; }
.security-cost__body { display: flex; padding: var(--space-5); flex-direction: column; gap: var(--space-4); }
.security-cost__choice { display: grid; width: 100%; padding: 0; align-items: center; grid-template-columns: auto 1fr auto; gap: var(--space-3); color: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.security-cost__choice-dot { width: 0.875rem; height: 0.875rem; border: 1px solid var(--color-border-strong); border-radius: 50%; background: var(--color-surface); box-shadow: inset 0 0 0 0.1875rem var(--color-surface); }
.security-cost__choice.is-selected .security-cost__choice-dot { border-color: var(--color-brand); background: var(--color-brand); }
.security-asset input { accent-color: var(--color-brand); }
.security-cost__choice > span { display: flex; flex-direction: column; gap: var(--space-1); }
.security-cost__choice strong { color: var(--color-ink); font-size: var(--text-xs); }
.security-cost__choice small { color: var(--color-ink-muted); font-size: 0.6875rem; }
.security-cost__choice-value { white-space: nowrap; }
.security-cost__months { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
.security-cost__months div { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-surface-subtle); }
.security-cost__months span, .security-cost__months strong { display: block; font-size: 0.6875rem; }
.security-cost__months span { color: var(--color-ink-muted); }
.security-cost__months strong { margin-top: var(--space-1); color: var(--color-ink); }
.security-cost__choice--manual { padding-top: var(--space-4); border-top: 1px solid var(--color-border); grid-template-columns: auto 1fr; }
.security-cost__money { display: flex; height: 2.5rem; padding: 0 var(--space-3); align-items: center; gap: var(--space-2); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); color: var(--color-ink-muted); }
.security-cost__money:focus-within { border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-soft); }
.security-cost__money.is-disabled { opacity: 0.55; background: var(--color-surface-subtle); }
.security-cost__money input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-ink); }
.security-assets__actions { display: flex; align-items: center; gap: var(--space-3); }
.security-assets__actions > button { border: 0; background: transparent; color: var(--color-brand); font-size: var(--text-xs); font-weight: var(--weight-semibold); cursor: pointer; }
.security-assets__list { padding: 0 var(--space-5); }
.security-asset { display: grid; padding: var(--space-4) 0; align-items: center; grid-template-columns: auto auto minmax(0, 1fr) auto; gap: var(--space-3); border-bottom: 1px solid var(--color-border); cursor: pointer; }
.security-asset__icon { display: grid; width: 2.25rem; height: 2.25rem; place-items: center; border-radius: var(--radius-sm); background: var(--color-brand-soft); color: var(--color-brand); }
.security-asset__icon svg { width: 1rem; height: 1rem; }
.security-asset__icon--income { background: var(--color-positive-soft); color: var(--color-positive); }
.security-asset__identity { display: flex; min-width: 0; flex-direction: column; gap: var(--space-1); }
.security-asset__identity strong { overflow: hidden; color: var(--color-ink); font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.security-asset__identity small { color: var(--color-ink-muted); font-size: 0.6875rem; }
.security-asset__value { color: var(--color-ink-secondary); font-size: var(--text-xs); }
.security-assets__group-label { padding: var(--space-5) 0 var(--space-2); color: var(--color-ink-muted); font-size: 0.6875rem; font-weight: var(--weight-semibold); text-transform: uppercase; letter-spacing: 0.04em; }
.security-assets__footer { display: flex; min-height: 4.5rem; padding: var(--space-4) var(--space-5); align-items: center; justify-content: flex-end; gap: var(--space-3); }
.security-assets__error { color: var(--color-negative); font-size: var(--text-xs); }
.security-assets__saved { color: var(--color-positive); font-size: var(--text-xs); }
@media (max-width: 1000px) { .security-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .security-columns { grid-template-columns: 1fr; } .security-section-header--chart { align-items: flex-start; flex-wrap: wrap; } .security-chart-controls { width: 100%; padding-left: 2.75rem; } }
@media (max-width: 640px) { .security-kpis { grid-template-columns: 1fr; } .security-section-header--actions { align-items: flex-start; flex-direction: column; } .security-chart-card__footer { flex-direction: column; gap: var(--space-2); } .security-cost__months { grid-template-columns: 1fr; } .security-asset { grid-template-columns: auto auto 1fr; } .security-asset__value { grid-column: 3; } }
</style>
