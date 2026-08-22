<script setup lang="ts">
import {
  Camera,
  Clock3,
  FlaskConical,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from '@lucide/vue'
import type {
  ProjectionBalanceMode,
  ProjectionPoint,
  ProjectionReport,
  ProjectionScenario,
  ProjectionSnapshot,
} from '~/types/projection'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'

const horizon = ref<'6' | '12' | '18'>('12')
const balanceMode = ref<ProjectionBalanceMode>('worst')
const selectedSnapshotIds = ref<number[]>([])
const creating = ref(false)
const deletingId = ref<number | null>(null)
const snapshotDeleteDialogOpen = ref(false)
const pendingSnapshotDelete = ref<ProjectionSnapshot | null>(null)
const actionError = ref('')
const selectedScenarioId = ref<number | null>(null)
const scenarioDrawerOpen = ref(false)
const editingScenario = ref<ProjectionScenario | null>(null)
const deletingScenarioId = ref<number | null>(null)
const scenarioDeleteDialogOpen = ref(false)
const pendingScenarioDelete = ref<ProjectionScenario | null>(null)

const {
  data: report,
  pending,
  error,
  refresh,
} = await useFetch<ProjectionReport>(
  () => `/api/reports/projection?horizon=${horizon.value}`,
  { watch: [horizon], default: () => null },
)

watch(
  () => report.value?.snapshots,
  (snapshots) => {
    if (!snapshots?.length) return
    const available = new Set(snapshots.map((item) => item.id))
    selectedSnapshotIds.value = selectedSnapshotIds.value.filter((id) =>
      available.has(id),
    )
    if (!selectedSnapshotIds.value.length) {
      selectedSnapshotIds.value = snapshots
        .filter((item) => item.kind === 'auto')
        .slice(0, 3)
        .map((item) => item.id)
    }
  },
  { immediate: true },
)

watch(
  () => report.value?.scenarios,
  (scenarios) => {
    if (
      selectedScenarioId.value !== null &&
      !scenarios?.some((scenario) => scenario.id === selectedScenarioId.value)
    ) {
      selectedScenarioId.value = null
    }
  },
  { immediate: true },
)

const selectedSnapshots = computed(() => {
  const selected = new Set(selectedSnapshotIds.value)
  return (report.value?.snapshots ?? []).filter((item) => selected.has(item.id))
})

function currentPointForMode(point: ProjectionPoint): ProjectionPoint {
  const balance =
    balanceMode.value === 'best'
      ? (point.bestBalance ?? point.balance)
      : (point.worstBalance ?? point.balance)
  return { ...point, balance }
}

const displayedPoints = computed(() =>
  (report.value?.points ?? []).map(currentPointForMode),
)

const selectedScenario = computed(() =>
  (report.value?.scenarios ?? []).find(
    (scenario) => scenario.id === selectedScenarioId.value,
  ) ?? null,
)

const displayedScenarios = computed<ProjectionScenario[]>(() => {
  if (!selectedScenario.value) return []
  return [
    {
      ...selectedScenario.value,
      points: selectedScenario.value.points.map(currentPointForMode),
    },
  ]
})

function snapshotPointForMode(point: ProjectionPoint): ProjectionPoint {
  const exactBalance =
    balanceMode.value === 'best' ? point.bestBalance : point.worstBalance
  if (Number.isFinite(exactBalance)) {
    return { ...point, balance: exactBalance! }
  }

  // Snapshots antigos preservam apenas o fechamento. Para compará-los na
  // mesma métrica, transportamos a amplitude intramês da projeção atual sem
  // alterar o fechamento histórico salvo no snapshot.
  const currentPoint = report.value?.points.find(
    (item) => item.month === point.month,
  )
  if (!currentPoint) return point
  const currentExtreme =
    balanceMode.value === 'best'
      ? currentPoint.bestBalance
      : currentPoint.worstBalance
  if (!Number.isFinite(currentExtreme)) return point

  return {
    ...point,
    balance: roundMoney(
      point.balance + currentExtreme! - currentPoint.balance,
    ),
  }
}

const displayedSnapshots = computed(() =>
  selectedSnapshots.value.map((snapshot) => ({
    ...snapshot,
    label: `${snapshot.label} · ${balanceModeLabel.value}`,
    points: snapshot.points.map(snapshotPointForMode),
  })),
)
const hasLegacyComparison = computed(() =>
  selectedSnapshots.value.some((snapshot) => !snapshot.hasMonthlyExtremes),
)

const lastPoint = computed(() => displayedPoints.value.at(-1) ?? null)
const sixMonthPoint = computed(() => {
  const points = displayedPoints.value
  return points[Math.min(5, points.length - 1)] ?? null
})

const scenarioLastPoint = computed(() =>
  displayedScenarios.value[0]?.points.at(-1) ?? null,
)
const scenarioImpactAtEnd = computed(() => {
  if (!scenarioLastPoint.value || !lastPoint.value) return null
  return roundMoney(scenarioLastPoint.value.balance - lastPoint.value.balance)
})
const minimumScenarioMonth = computed(() => {
  const today = report.value?.generatedAt
  return today ? addMonthsLocal(today, 1).slice(0, 7) : ''
})

const latestSnapshotDelta = computed(() => {
  const snapshot = displayedSnapshots.value[0]
  const current = lastPoint.value
  if (!snapshot || !current) return null
  const oldPoint = snapshot.points.find((point) => point.month === current.month)
  if (!oldPoint) return null
  return current.balance - oldPoint.balance
})

const horizonOptions = [
  { value: '6' as const, label: '6 meses' },
  { value: '12' as const, label: '12 meses' },
  { value: '18' as const, label: '18 meses' },
]

const balanceModeOptions = [
  { value: 'worst' as const, label: 'Pior saldo' },
  { value: 'best' as const, label: 'Melhor saldo' },
]

const balanceModeLabel = computed(() =>
  balanceMode.value === 'best' ? 'Melhor saldo' : 'Pior saldo',
)

function toggleSnapshot(id: number) {
  if (selectedSnapshotIds.value.includes(id)) {
    selectedSnapshotIds.value = selectedSnapshotIds.value.filter(
      (item) => item !== id,
    )
    return
  }
  if (selectedSnapshotIds.value.length >= 3) {
    selectedSnapshotIds.value = [...selectedSnapshotIds.value.slice(1), id]
    return
  }
  selectedSnapshotIds.value = [...selectedSnapshotIds.value, id]
}

async function createSnapshot() {
  creating.value = true
  actionError.value = ''
  try {
    const created = await $fetch<ProjectionSnapshot>(
      '/api/reports/projection-snapshots',
      { method: 'POST' },
    )
    await refresh()
    selectedSnapshotIds.value = [
      ...selectedSnapshotIds.value.slice(-2),
      created.id,
    ]
  } catch (caught) {
    actionError.value =
      (caught as { statusMessage?: string }).statusMessage ??
      'Não foi possível criar o snapshot.'
  } finally {
    creating.value = false
  }
}

function requestSnapshotDelete(snapshot: ProjectionSnapshot) {
  pendingSnapshotDelete.value = snapshot
  snapshotDeleteDialogOpen.value = true
}

async function confirmSnapshotDelete() {
  const snapshot = pendingSnapshotDelete.value
  if (!snapshot) return
  deletingId.value = snapshot.id
  actionError.value = ''
  try {
    await $fetch(`/api/reports/projection-snapshots/${snapshot.id}`, {
      method: 'DELETE',
    })
    selectedSnapshotIds.value = selectedSnapshotIds.value.filter(
      (id) => id !== snapshot.id,
    )
    await refresh()
  } catch (caught) {
    actionError.value =
      (caught as { statusMessage?: string }).statusMessage ??
      'Não foi possível excluir o snapshot.'
  } finally {
    deletingId.value = null
    snapshotDeleteDialogOpen.value = false
    pendingSnapshotDelete.value = null
  }
}

function openNewScenario() {
  editingScenario.value = null
  scenarioDrawerOpen.value = true
}

function openScenarioForEdit(scenario: ProjectionScenario) {
  editingScenario.value = scenario
  scenarioDrawerOpen.value = true
}

function toggleScenario(id: number) {
  selectedScenarioId.value = selectedScenarioId.value === id ? null : id
}

async function scenarioSaved(id: number | null) {
  await refresh()
  if (id !== null) selectedScenarioId.value = id
}

function requestScenarioDelete(scenario: ProjectionScenario) {
  pendingScenarioDelete.value = scenario
  scenarioDeleteDialogOpen.value = true
}

async function confirmScenarioDelete() {
  const scenario = pendingScenarioDelete.value
  if (!scenario) return
  deletingScenarioId.value = scenario.id
  actionError.value = ''
  try {
    await $fetch(`/api/reports/projection-scenarios/${scenario.id}`, {
      method: 'DELETE',
    })
    if (selectedScenarioId.value === scenario.id) selectedScenarioId.value = null
    await refresh()
  } catch (caught) {
    actionError.value =
      (caught as { statusMessage?: string }).statusMessage ??
      'Não foi possível excluir o cenário.'
  } finally {
    deletingScenarioId.value = null
    scenarioDeleteDialogOpen.value = false
    pendingScenarioDelete.value = null
  }
}

function scenarioItemLabel(item: ProjectionScenario['items'][number]) {
  const labels = {
    income: 'Receita',
    expense: 'Despesa',
    reduction: 'Redução',
    installment: 'Compra parcelada',
  }
  return labels[item.type]
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
</script>

<template>
  <div class="projection-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Relatórios"
      description="Análise detalhada das suas finanças"
    />

    <ReportsReportTabs />

    <div v-if="error" class="projection-page__error">
      <UiEmptyState
        title="Não foi possível calcular a projeção"
        description="Tente novamente em instantes."
      />
    </div>

    <template v-else>
      <section class="projection-kpis" aria-label="Resumo da projeção">
        <UiCard v-if="pending && !report" v-for="index in 3" :key="index">
          <UiSkeleton width="6rem" height="0.75rem" />
          <UiSkeleton width="9rem" height="1.5rem" class="projection-page__gap" />
        </UiCard>

        <template v-else-if="report">
          <UiCard class="projection-kpi">
            <p>Saldo hoje</p>
            <strong><UiMoney :value="report.currentBalance" /></strong>
            <span>Contas bancárias</span>
          </UiCard>
          <UiCard class="projection-kpi">
            <p>{{ balanceModeLabel }} em 6 meses</p>
            <strong><UiMoney :value="sixMonthPoint?.balance ?? 0" /></strong>
            <span>{{ sixMonthPoint?.label }}</span>
          </UiCard>
          <UiCard class="projection-kpi">
            <p>{{ balanceModeLabel }} no fim da projeção</p>
            <strong><UiMoney :value="lastPoint?.balance ?? 0" /></strong>
            <span v-if="latestSnapshotDelta !== null">
              {{ latestSnapshotDelta >= 0 ? '+' : '' }}{{ formatMoney(latestSnapshotDelta) }}
              vs {{ selectedSnapshots[0]?.label }}
            </span>
            <span v-else>{{ lastPoint?.label }}</span>
          </UiCard>
        </template>
      </section>

      <UiCard class="projection-card" padding="none">
        <header class="projection-card__header">
          <div class="projection-card__title">
            <span aria-hidden="true"><TrendingUp /></span>
            <div>
              <h2>Projeção do saldo</h2>
              <p>
                Saldo bancário, lançamentos recorrentes, parcelas e faturas conhecidas.
              </p>
            </div>
          </div>

          <div class="projection-card__actions">
            <UiSegmentedControl
              v-model="balanceMode"
              :options="balanceModeOptions"
              aria-label="Saldo mensal exibido"
            />
            <UiSegmentedControl
              v-model="horizon"
              :options="horizonOptions"
              aria-label="Horizonte da projeção"
            />
            <UiButton variant="secondary" @click="openNewScenario">
              <FlaskConical aria-hidden="true" />
              Cenário
            </UiButton>
            <UiButton variant="secondary" :disabled="creating" @click="createSnapshot">
              <Camera aria-hidden="true" />
              {{ creating ? 'Salvando…' : 'Snapshot' }}
            </UiButton>
          </div>
        </header>

        <div v-if="actionError" class="projection-card__error" role="alert">
          {{ actionError }}
        </div>

        <section class="projection-snapshots" aria-label="Snapshots para comparação">
          <div class="projection-snapshots__label">
            <Clock3 aria-hidden="true" />
            <span>Comparar com</span>
          </div>

          <div class="projection-snapshots__content">
            <div v-if="report?.snapshots.length" class="projection-snapshots__list">
              <div
                v-for="snapshot in report.snapshots"
                :key="snapshot.id"
                class="projection-snapshot"
                :class="{ 'is-active': selectedSnapshotIds.includes(snapshot.id) }"
              >
                <button
                  type="button"
                  :title="`Criado em ${formatDate(snapshot.createdAt)}`"
                  @click="toggleSnapshot(snapshot.id)"
                >
                  <span class="projection-snapshot__dot" />
                  <strong>{{ snapshot.label }}</strong>
                </button>
                <button
                  v-if="snapshot.kind === 'manual'"
                  type="button"
                  class="projection-snapshot__delete"
                  :disabled="deletingId === snapshot.id"
                  :aria-label="`Excluir ${snapshot.label}`"
                  @click="requestSnapshotDelete(snapshot)"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>
            <p v-else class="projection-snapshots__empty">
              O primeiro snapshot automático será criado neste mês.
            </p>

            <p v-if="hasLegacyComparison" class="projection-snapshots__legacy">
              Nos snapshots antigos, o extremo mensal é estimado a partir do fechamento preservado.
            </p>
          </div>
        </section>

        <section class="projection-scenarios" aria-label="Cenários para simulação">
          <div class="projection-scenarios__label">
            <FlaskConical aria-hidden="true" />
            <span>Simular</span>
          </div>

          <div class="projection-scenarios__content">
            <div v-if="report?.scenarios.length" class="projection-scenarios__list">
              <button
                v-for="scenario in report.scenarios"
                :key="scenario.id"
                type="button"
                class="projection-scenario"
                :class="{ 'is-active': selectedScenarioId === scenario.id }"
                @click="toggleScenario(scenario.id)"
              >
                <span class="projection-scenario__dot" />
                <strong>{{ scenario.name }}</strong>
                <small>{{ scenario.items.length }} {{ scenario.items.length === 1 ? 'mudança' : 'mudanças' }}</small>
              </button>
              <button type="button" class="projection-scenario-add" @click="openNewScenario">
                <Plus aria-hidden="true" /> Novo cenário
              </button>
            </div>
            <button v-else type="button" class="projection-scenarios__empty" @click="openNewScenario">
              <Plus aria-hidden="true" /> Crie um cenário para testar uma decisão sem alterar seus dados.
            </button>

            <div v-if="selectedScenario" class="projection-scenario-detail">
              <div class="projection-scenario-detail__summary">
                <span>Impacto no fim da projeção</span>
                <strong :class="{ 'is-negative': (scenarioImpactAtEnd ?? 0) < 0 }">
                  {{ (scenarioImpactAtEnd ?? 0) >= 0 ? '+' : '' }}{{ formatMoney(scenarioImpactAtEnd ?? 0) }}
                </strong>
              </div>
              <div class="projection-scenario-detail__items">
                <span v-for="item in selectedScenario.items" :key="item.id">
                  {{ scenarioItemLabel(item) }} · {{ formatMoney(item.amount) }}
                </span>
              </div>
              <div class="projection-scenario-detail__actions">
                <button type="button" @click="openScenarioForEdit(selectedScenario)">
                  <Pencil aria-hidden="true" /> Editar
                </button>
                <button
                  type="button"
                  :disabled="deletingScenarioId === selectedScenario.id"
                  @click="requestScenarioDelete(selectedScenario)"
                >
                  <Trash2 aria-hidden="true" /> Excluir
                </button>
              </div>
            </div>
          </div>
        </section>

        <div class="projection-card__chart">
          <UiSkeleton v-if="pending && !report" height="23rem" radius="md" />
          <ReportsProjectionChart
            v-else-if="report"
            :points="displayedPoints"
            :snapshots="displayedSnapshots"
            :scenarios="displayedScenarios"
            :current-label="`Projeção atual · ${balanceModeLabel}`"
          />
        </div>

        <footer class="projection-card__footer">
          Cada ponto mostra o {{ balanceModeLabel.toLowerCase() }} registrado no mês.
          A projeção usa apenas valores já conhecidos; gastos e receitas ainda não cadastrados
          alteram a curva real ao longo do tempo, e é justamente essa diferença que os snapshots preservam.
        </footer>
      </UiCard>
    </template>

    <ReportsProjectionScenarioFormDrawer
      v-if="minimumScenarioMonth"
      v-model:open="scenarioDrawerOpen"
      :scenario="editingScenario"
      :minimum-month="minimumScenarioMonth"
      @saved="scenarioSaved"
    />

    <UiConfirmDialog
      v-model:open="scenarioDeleteDialogOpen"
      title="Excluir cenário?"
      :description="`O cenário “${pendingScenarioDelete?.name ?? ''}” será removido. Seus lançamentos e projeções reais não serão alterados.`"
      confirm-label="Excluir cenário"
      :busy="deletingScenarioId !== null"
      @confirm="confirmScenarioDelete"
      @cancel="pendingScenarioDelete = null"
    />

    <UiConfirmDialog
      v-model:open="snapshotDeleteDialogOpen"
      title="Excluir snapshot?"
      :description="`O snapshot “${pendingSnapshotDelete?.label ?? ''}” deixará de aparecer nas comparações. A projeção atual não será alterada.`"
      confirm-label="Excluir snapshot"
      :busy="deletingId !== null"
      @confirm="confirmSnapshotDelete"
      @cancel="pendingSnapshotDelete = null"
    />
  </div>
</template>

<style scoped>
.projection-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.projection-page__gap {
  margin-top: var(--space-3);
}

.projection-kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.projection-kpi p,
.projection-kpi span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-kpi strong {
  display: block;
  margin: var(--space-2) 0;
  color: var(--color-positive-ink);
  font-size: clamp(1.125rem, 1.6vw, var(--text-lg));
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.projection-card__header {
  display: flex;
  padding: var(--space-5) var(--space-6);
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.projection-card__title,
.projection-card__actions,
.projection-snapshots,
.projection-snapshots__label,
.projection-snapshot,
.projection-snapshot button {
  display: flex;
  align-items: center;
}

.projection-card__title {
  gap: var(--space-3);
}

.projection-card__title > span {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.projection-card__title svg,
.projection-snapshots__label svg {
  width: 1rem;
  height: 1rem;
}

.projection-card__title h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.projection-card__title p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-card__actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.projection-card__actions svg {
  width: 1rem;
  height: 1rem;
}

.projection-card__error {
  padding: var(--space-3) var(--space-6);
  border-bottom: 1px solid var(--color-negative-ink);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
  font-size: var(--text-xs);
}

.projection-snapshots {
  min-height: 4.25rem;
  padding: var(--space-3) var(--space-6);
  align-items: flex-start;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.projection-snapshots__label {
  min-height: 2.25rem;
  flex-shrink: 0;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-snapshots__list {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.projection-snapshot {
  overflow: hidden;
  min-height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-round);
  background: var(--color-surface);
}

.projection-snapshot.is-active {
  border-color: var(--color-brand-ink);
  background: var(--color-brand-soft);
}

.projection-snapshot button {
  padding: 0.35rem 0.4rem 0.35rem 0.65rem;
  gap: var(--space-2);
  border: 0;
  background: transparent;
  color: var(--color-ink);
  cursor: pointer;
  text-align: left;
}

.projection-snapshot__dot {
  width: 0.45rem;
  height: 0.45rem;
  flex-shrink: 0;
  border-radius: var(--radius-round);
  background: var(--color-ink-muted);
}

.projection-snapshot.is-active .projection-snapshot__dot {
  background: var(--color-brand);
}

.projection-snapshot strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.projection-snapshots__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
}

.projection-snapshot .projection-snapshot__delete {
  padding: 0.5rem;
  color: var(--color-ink-muted);
}

.projection-snapshot__delete:hover {
  color: var(--color-negative-ink);
}

.projection-snapshot__delete svg {
  width: 0.8rem;
  height: 0.8rem;
}

.projection-snapshots__empty {
  padding-top: 0.55rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-snapshots__legacy {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-scenarios {
  display: flex;
  min-height: 4.25rem;
  padding: var(--space-3) var(--space-6);
  align-items: flex-start;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-subtle);
}

.projection-scenarios__label {
  display: flex;
  min-height: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-scenarios__label svg,
.projection-scenario-add svg,
.projection-scenarios__empty svg,
.projection-scenario-detail__actions svg {
  width: 1rem;
  height: 1rem;
}

.projection-scenarios__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
}

.projection-scenarios__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.projection-scenario,
.projection-scenario-add,
.projection-scenarios__empty {
  display: inline-flex;
  min-height: 2.25rem;
  padding: 0.4rem 0.75rem;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-round);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.projection-scenario.is-active {
  border-color: var(--color-brand-ink);
  background: var(--color-brand-soft);
}

.projection-scenario__dot {
  width: 0.45rem;
  height: 0.45rem;
  flex-shrink: 0;
  border-radius: var(--radius-round);
  background: var(--color-ink-muted);
}

.projection-scenario.is-active .projection-scenario__dot {
  background: var(--color-brand);
}

.projection-scenario strong,
.projection-scenario-add,
.projection-scenarios__empty {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.projection-scenario small {
  color: var(--color-ink-muted);
  font-size: 0.65rem;
}

.projection-scenario-add,
.projection-scenarios__empty {
  color: var(--color-brand-ink);
}

.projection-scenarios__empty {
  width: fit-content;
}

.projection-scenario-detail {
  display: grid;
  padding: var(--space-3) var(--space-4);
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.projection-scenario-detail__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.projection-scenario-detail__summary span,
.projection-scenario-detail__items span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-scenario-detail__summary strong {
  color: var(--color-positive-ink);
  font-size: var(--text-sm);
}

.projection-scenario-detail__summary strong.is-negative {
  color: var(--color-negative-ink);
}

.projection-scenario-detail__items {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.projection-scenario-detail__actions {
  display: flex;
  gap: var(--space-1);
}

.projection-scenario-detail__actions button {
  display: inline-flex;
  min-height: 2rem;
  padding: 0 var(--space-2);
  align-items: center;
  gap: var(--space-1);
  border: 0;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  cursor: pointer;
}

.projection-scenario-detail__actions button:hover:not(:disabled) {
  color: var(--color-ink);
}

.projection-card__chart {
  padding: var(--space-5) var(--space-6) var(--space-3);
}

.projection-card__footer {
  padding: 0 var(--space-6) var(--space-5);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  line-height: 1.55;
}

@media (max-width: 800px) {
  .projection-kpis {
    grid-template-columns: 1fr;
  }

  .projection-card__header,
  .projection-snapshots,
  .projection-scenarios {
    flex-direction: column;
  }

  .projection-card__actions {
    width: 100%;
    justify-content: space-between;
  }

  .projection-snapshots {
    gap: var(--space-2);
  }

  .projection-scenarios {
    gap: var(--space-2);
  }

  .projection-scenario-detail {
    grid-template-columns: 1fr auto;
  }

  .projection-scenario-detail__items {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (max-width: 520px) {
  .projection-card__header,
  .projection-snapshots,
  .projection-scenarios,
  .projection-card__chart {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }

  .projection-card__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .projection-scenario-detail {
    grid-template-columns: 1fr;
  }

  .projection-scenario-detail__items,
  .projection-scenario-detail__actions {
    grid-column: auto;
    grid-row: auto;
  }

  .projection-card__footer {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }
}
</style>
