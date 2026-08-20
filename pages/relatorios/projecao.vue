<script setup lang="ts">
import { Camera, Clock3, Trash2, TrendingUp } from '@lucide/vue'
import type { ProjectionReport, ProjectionSnapshot } from '~/types/projection'

const horizon = ref<'6' | '12' | '18'>('12')
const selectedSnapshotIds = ref<number[]>([])
const creating = ref(false)
const deletingId = ref<number | null>(null)
const actionError = ref('')

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

const selectedSnapshots = computed(() => {
  const selected = new Set(selectedSnapshotIds.value)
  return (report.value?.snapshots ?? []).filter((item) => selected.has(item.id))
})

const lastPoint = computed(() => report.value?.points.at(-1) ?? null)
const sixMonthPoint = computed(() => {
  const points = report.value?.points ?? []
  return points[Math.min(5, points.length - 1)] ?? null
})

const latestSnapshotDelta = computed(() => {
  const snapshot = selectedSnapshots.value[0]
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

async function removeSnapshot(snapshot: ProjectionSnapshot) {
  if (import.meta.client) {
    const confirmed = window.confirm(`Excluir “${snapshot.label}”?`)
    if (!confirmed) return
  }
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
  }
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
            <p>Em 6 meses</p>
            <strong><UiMoney :value="sixMonthPoint?.balance ?? 0" /></strong>
            <span>{{ sixMonthPoint?.label }}</span>
          </UiCard>
          <UiCard class="projection-kpi">
            <p>Fim da projeção</p>
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
              v-model="horizon"
              :options="horizonOptions"
              aria-label="Horizonte da projeção"
            />
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
                @click="removeSnapshot(snapshot)"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          </div>
          <p v-else class="projection-snapshots__empty">
            O primeiro snapshot automático será criado neste mês.
          </p>
        </section>

        <div class="projection-card__chart">
          <UiSkeleton v-if="pending && !report" height="23rem" radius="md" />
          <ReportsProjectionChart
            v-else-if="report"
            :points="report.points"
            :snapshots="selectedSnapshots"
          />
        </div>

        <footer class="projection-card__footer">
          A projeção usa apenas valores já conhecidos. Gastos e receitas ainda não cadastrados
          alteram a curva real ao longo do tempo, e é justamente essa diferença que os snapshots preservam.
        </footer>
      </UiCard>
    </template>
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
  .projection-snapshots {
    flex-direction: column;
  }

  .projection-card__actions {
    width: 100%;
    justify-content: space-between;
  }

  .projection-snapshots {
    gap: var(--space-2);
  }
}

@media (max-width: 520px) {
  .projection-card__header,
  .projection-snapshots,
  .projection-card__chart {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }

  .projection-card__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .projection-card__footer {
    padding-right: var(--space-4);
    padding-left: var(--space-4);
  }
}
</style>
