<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type {
  ComparisonReport,
  ComparisonRow,
  ComparisonScope,
} from '~/types/comparison'
import type { SpendingGuardBreakdownItem } from '~/types/spendingGuard'

const now = new Date()
const compareMonth = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
)
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const baseMonth = ref(
  `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`,
)
const scope = ref<ComparisonScope>('supercategory')
const visibility = ref<'all' | 'comparable'>('all')
const expandedKeys = ref<string[]>([])

const scopeOptions = [
  { value: 'category' as const, label: 'Categoria' },
  { value: 'supercategory' as const, label: 'Supercategoria' },
]
const visibilityOptions = [
  { value: 'all' as const, label: 'Todas' },
  { value: 'comparable' as const, label: 'Só comparáveis' },
]
const endpoint = computed(
  () =>
    `/api/reports/comparison?baseMonth=${baseMonth.value}&compareMonth=${compareMonth.value}&scope=${scope.value}`,
)
const { data: report, pending, error } = await useFetch<ComparisonReport>(endpoint, {
  watch: [endpoint],
  default: () => null,
})

const rows = computed(() =>
  (report.value?.rows ?? []).filter(
    (row) => visibility.value === 'all' || row.comparable,
  ),
)

watch([baseMonth, compareMonth, scope, visibility], () => {
  expandedKeys.value = []
})

function isExpanded(key: string) {
  return expandedKeys.value.includes(key)
}

function toggleRow(key: string) {
  expandedKeys.value = isExpanded(key)
    ? expandedKeys.value.filter((item) => item !== key)
    : [...expandedKeys.value, key]
}

function variationTone(value: number) {
  if (value > 0) return 'negative'
  if (value < 0) return 'positive'
  return 'neutral'
}

function formatPercent(value: number | null) {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function trendPoints(row: ComparisonRow) {
  const max = Math.max(row.baseAmount, row.compareAmount, 1)
  const baseY = 16 - (row.baseAmount / max) * 12
  const compareY = 16 - (row.compareAmount / max) * 12
  return `2,${baseY} 38,${compareY}`
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function itemSupport(item: SpendingGuardBreakdownItem) {
  return [formatDate(item.date), item.categoryName, item.sourceLabel]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div class="comparison-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Relatórios"
      description="Análise detalhada das suas finanças"
    />

    <ReportsReportTabs />

    <UiCard class="comparison-controls">
      <div class="comparison-controls__months">
        <label>
          <span>Comparar</span>
          <input v-model="baseMonth" type="month" aria-label="Mês inicial" />
        </label>
        <span>com</span>
        <label>
          <span class="sr-only">Mês comparado</span>
          <input v-model="compareMonth" type="month" aria-label="Mês comparado" />
        </label>
      </div>

      <UiSegmentedControl
        v-model="scope"
        :options="scopeOptions"
        aria-label="Agrupamento da comparação"
      />
    </UiCard>

    <UiEmptyState
      v-if="error"
      title="Não foi possível comparar os meses"
      description="Tente novamente em instantes."
    />

    <template v-else>
      <UiCard class="comparison-summary" padding="none">
        <div>
          <span>{{ report?.baseLabel ?? 'Mês inicial' }}</span>
          <strong><UiMoney :value="report?.baseTotal ?? 0" /></strong>
        </div>
        <div>
          <span>{{ report?.compareLabel ?? 'Mês comparado' }}</span>
          <strong><UiMoney :value="report?.compareTotal ?? 0" /></strong>
        </div>
        <div :class="`is-${variationTone(report?.difference ?? 0)}`">
          <span>Variação</span>
          <strong>
            <template v-if="(report?.difference ?? 0) !== 0">{{ (report?.difference ?? 0) > 0 ? '+' : '−' }}</template><UiMoney :value="Math.abs(report?.difference ?? 0)" />
            <small>{{ formatPercent(report?.percentChange ?? null) }}</small>
          </strong>
        </div>
      </UiCard>

      <UiCard class="comparison-table" padding="none">
        <header class="comparison-table__header">
          <div class="comparison-table__copy">
            <strong>{{ scope === 'category' ? 'Categorias' : 'Supercategorias' }}</strong>
            <span>Clique em uma linha para ver os lançamentos</span>
          </div>
          <UiSegmentedControl v-model="visibility" :options="visibilityOptions" />
        </header>

        <div v-if="pending && !report" class="comparison-table__loading">
          <UiSkeleton v-for="index in 6" :key="index" height="3.5rem" />
        </div>

        <UiEmptyState
          v-else-if="!rows.length"
          title="Nenhum grupo para comparar"
          description="Altere os meses ou mostre todas as categorias."
        />

        <div v-else class="comparison-table__body">
          <div class="comparison-table__labels" aria-hidden="true">
            <span />
            <span>{{ report?.baseLabel }}</span>
            <span>{{ report?.compareLabel }}</span>
            <span>Variação</span>
            <span>%</span>
            <span />
          </div>

          <article v-for="row in rows" :key="row.key" class="comparison-row">
            <button
              type="button"
              class="comparison-row__main"
              :aria-expanded="isExpanded(row.key)"
              @click="toggleRow(row.key)"
            >
              <span class="comparison-row__identity">
                <CategoriesCategoryIconChip :icon="row.icon" :color="row.color" size="sm" />
                <strong>{{ row.label }}</strong>
                <ChevronDown :class="{ 'is-open': isExpanded(row.key) }" />
              </span>
              <span :data-label="report?.baseLabel"><UiMoney :value="row.baseAmount" /></span>
              <span :data-label="report?.compareLabel"><UiMoney :value="row.compareAmount" /></span>
              <span :class="`is-${variationTone(row.difference)}`" data-label="Variação">
                <template v-if="row.difference !== 0">{{ row.difference > 0 ? '+' : '−' }}</template><UiMoney :value="Math.abs(row.difference)" />
              </span>
              <span :class="`is-${variationTone(row.difference)}`" data-label="Percentual">
                {{ formatPercent(row.percentChange) }}
              </span>
              <svg viewBox="0 0 40 20" aria-hidden="true">
                <polyline
                  :points.attr="trendPoints(row)"
                  :class="`is-${variationTone(row.difference)}`"
                />
              </svg>
            </button>

            <div v-if="isExpanded(row.key)" class="comparison-row__details">
              <section v-for="side in ['base', 'compare'] as const" :key="side">
                <header>
                  <strong>{{ side === 'base' ? report?.baseLabel : report?.compareLabel }}</strong>
                  <UiMoney :value="side === 'base' ? row.baseAmount : row.compareAmount" />
                </header>
                <ul v-if="(side === 'base' ? row.baseItems : row.compareItems).length">
                  <li v-for="item in side === 'base' ? row.baseItems : row.compareItems" :key="item.id">
                    <span>
                      <strong>{{ item.description }}</strong>
                      <small>{{ itemSupport(item) }}</small>
                    </span>
                    <UiMoney :value="item.amount" />
                  </li>
                </ul>
                <p v-else>Sem lançamentos neste mês.</p>
              </section>
            </div>
          </article>
        </div>
      </UiCard>
    </template>
  </div>
</template>

<style scoped>
.comparison-page { display: grid; gap: var(--space-4); }
.comparison-controls :deep(.ak-card__body) { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.comparison-controls__months, .comparison-controls__months label { display: flex; align-items: center; gap: var(--space-3); }
.comparison-controls__months span { color: var(--color-ink-muted); font-size: var(--text-sm); }
.comparison-controls input[type='month'] { min-height: 2.25rem; padding: 0 var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); color: var(--color-ink); color-scheme: light; font: inherit; font-size: var(--text-sm); cursor: pointer; }
.comparison-summary :deep(.ak-card__body) { display: grid; padding: 0; grid-template-columns: repeat(3, 1fr); }
.comparison-summary :deep(.ak-card__body > div) { padding: var(--space-4) var(--space-5); }
.comparison-summary :deep(.ak-card__body > div + div) { border-left: 1px solid var(--color-border); }
.comparison-summary span { display: block; color: var(--color-ink-muted); font-size: var(--text-xs); }
.comparison-summary strong { display: flex; align-items: baseline; gap: var(--space-2); margin-top: var(--space-2); color: var(--color-ink); font-size: var(--text-xl); font-weight: var(--weight-semibold); }
.comparison-summary small { font-size: var(--text-sm); font-weight: var(--weight-medium); }
.is-negative { color: var(--color-negative-ink) !important; }
.is-positive { color: var(--color-positive-ink) !important; }
.is-neutral { color: var(--color-ink-muted) !important; }
.comparison-table__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
.comparison-table__copy { display: flex; align-items: baseline; gap: var(--space-4); }
.comparison-table__header strong { color: var(--color-ink); font-size: var(--text-sm); }
.comparison-table__header span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.comparison-table__loading { display: grid; gap: var(--space-2); padding: var(--space-4); }
.comparison-table__labels, .comparison-row__main { display: grid; grid-template-columns: minmax(14rem, 1fr) repeat(2, 8.5rem) 8rem 5.5rem 3rem; align-items: center; column-gap: var(--space-3); }
.comparison-table__labels { min-height: 2.5rem; padding: 0 var(--space-5); color: var(--color-ink-muted); font-size: var(--text-xs); text-align: right; }
.comparison-row { border-top: 1px solid var(--color-border); }
.comparison-row__main { width: 100%; min-height: 3.75rem; padding: var(--space-2) var(--space-5); border: 0; background: transparent; color: var(--color-ink-secondary); font-size: var(--text-sm); font-variant-numeric: tabular-nums; text-align: right; cursor: pointer; }
.comparison-row__main:hover { background: var(--color-surface-subtle); }
.comparison-row__identity { display: flex; align-items: center; gap: var(--space-3); min-width: 0; text-align: left; }
.comparison-row__identity strong { overflow: hidden; color: var(--color-ink); font-weight: var(--weight-medium); text-overflow: ellipsis; white-space: nowrap; }
.comparison-row__identity svg { width: 0.9rem; height: 0.9rem; color: var(--color-ink-muted); transition: transform var(--transition-fast); }
.comparison-row__identity svg.is-open { transform: rotate(180deg); }
.comparison-row__main > svg { width: 2.5rem; height: 1.25rem; justify-self: end; overflow: visible; }
.comparison-row__main polyline { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
.comparison-row__details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background: var(--color-surface-subtle); border-top: 1px solid var(--color-border); }
.comparison-row__details section { padding: var(--space-4) var(--space-5); }
.comparison-row__details section + section { border-left: 1px solid var(--color-border); }
.comparison-row__details header, .comparison-row__details li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.comparison-row__details header { padding-bottom: var(--space-3); color: var(--color-ink); font-size: var(--text-sm); }
.comparison-row__details li { padding: var(--space-3) 0; border-top: 1px solid var(--color-border); color: var(--color-ink-secondary); font-size: var(--text-sm); }
.comparison-row__details li > span { min-width: 0; }
.comparison-row__details li strong { display: block; overflow: hidden; color: var(--color-ink); font-weight: var(--weight-medium); text-overflow: ellipsis; white-space: nowrap; }
.comparison-row__details small, .comparison-row__details p { color: var(--color-ink-muted); font-size: var(--text-xs); }
.comparison-row__details p { padding-top: var(--space-2); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

@media (max-width: 900px) {
  .comparison-table__body { overflow-x: auto; }
  .comparison-table__labels, .comparison-row__main { min-width: 58rem; }
}

@media (max-width: 640px) {
  .comparison-controls :deep(.ak-card__body) { align-items: stretch; flex-direction: column; }
  .comparison-controls__months { align-items: stretch; flex-direction: column; }
  .comparison-controls__months label { align-items: flex-start; flex-direction: column; gap: var(--space-1); }
  .comparison-controls__months > span { display: none; }
  .comparison-controls input[type='month'] { width: 100%; }
  .comparison-summary :deep(.ak-card__body) { grid-template-columns: 1fr; }
  .comparison-summary :deep(.ak-card__body > div + div) { border-top: 1px solid var(--color-border); border-left: 0; }
  .comparison-table__header { align-items: flex-start; flex-direction: column; }
  .comparison-table__copy { align-items: flex-start; flex-direction: column; gap: var(--space-1); }
  .comparison-table__body { overflow: visible; }
  .comparison-table__labels { display: none; }
  .comparison-row__main { min-width: 0; padding: var(--space-4); grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3) var(--space-4); text-align: left; }
  .comparison-row__identity { grid-column: 1 / -1; }
  .comparison-row__main > span:not(.comparison-row__identity)::before { display: block; margin-bottom: var(--space-1); color: var(--color-ink-muted); content: attr(data-label); font-size: var(--text-xs); }
  .comparison-row__main > svg { display: none; }
  .comparison-row__details { grid-template-columns: 1fr; }
  .comparison-row__details section + section { border-top: 1px solid var(--color-border); border-left: 0; }
}
</style>
