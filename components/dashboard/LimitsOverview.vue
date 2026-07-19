<script setup lang="ts">
import { ArrowRight, BarChart3 } from '@lucide/vue'
import type { LimitRow, LimitScope, LimitsReport } from '~/types/limits'

const props = defineProps<{ month: string }>()

const MAX_ROWS = 6

type OverviewRow = LimitRow & { scope: LimitScope; rowKey: string }

const { data: categoryReport, pending: categoryPending } =
  await useFetch<LimitsReport>(
    () => `/api/limits?month=${props.month}&scope=category`,
    {
      watch: [() => props.month],
      default: () => null,
    },
  )

const { data: superReport, pending: superPending } =
  await useFetch<LimitsReport>(
    () => `/api/limits?month=${props.month}&scope=supercategory`,
    {
      watch: [() => props.month],
      default: () => null,
    },
  )

const pending = computed(() => categoryPending.value || superPending.value)

const limitedRows = computed(() => {
  const rows: OverviewRow[] = []

  for (const row of categoryReport.value?.rows ?? []) {
    if (row.limitAmount === null) continue
    rows.push({
      ...row,
      scope: 'category',
      rowKey: `category-${row.referenceId}`,
    })
  }

  for (const row of superReport.value?.rows ?? []) {
    if (row.limitAmount === null) continue
    rows.push({
      ...row,
      scope: 'supercategory',
      rowKey: `supercategory-${row.referenceId}`,
    })
  }

  return rows
})

const totalLimited = computed(
  () =>
    (categoryReport.value?.totalLimited ?? 0) +
    (superReport.value?.totalLimited ?? 0),
)

const totalSpentLimited = computed(
  () =>
    (categoryReport.value?.totalSpentLimited ?? 0) +
    (superReport.value?.totalSpentLimited ?? 0),
)

const displayRows = computed(() => {
  const rows = [...limitedRows.value]
  rows.sort((a, b) => {
    const aOver = a.spent > (a.limitAmount ?? 0) ? 1 : 0
    const bOver = b.spent > (b.limitAmount ?? 0) ? 1 : 0
    if (aOver !== bOver) return bOver - aOver
    const aPct = a.limitAmount ? a.spent / a.limitAmount : 0
    const bPct = b.limitAmount ? b.spent / b.limitAmount : 0
    return bPct - aPct
  })
  return rows.slice(0, MAX_ROWS)
})

const hiddenCount = computed(() =>
  Math.max(0, limitedRows.value.length - displayRows.value.length),
)

const totalOver = computed(
  () => totalSpentLimited.value > totalLimited.value,
)

const totalPercent = computed(() => {
  if (!totalLimited.value) return 0
  return Math.min(
    100,
    (totalSpentLimited.value / totalLimited.value) * 100,
  )
})

const overCount = computed(
  () =>
    limitedRows.value.filter(
      (row) => row.limitAmount !== null && row.spent > row.limitAmount,
    ).length,
)

function rowPercent(row: LimitRow) {
  if (!row.limitAmount) return 0
  return Math.min(100, (row.spent / row.limitAmount) * 100)
}

function isOver(row: LimitRow) {
  return row.limitAmount !== null && row.spent > row.limitAmount
}
</script>

<template>
  <UiCard class="limits-overview" padding="none">
    <header class="limits-overview__header">
      <div class="limits-overview__title">
        <span class="limits-overview__icon" aria-hidden="true">
          <BarChart3 />
        </span>
        <div>
          <h2>Limites consumidos</h2>
          <p v-if="!pending">
            {{ limitedRows.length }}
            {{
              limitedRows.length === 1
                ? 'limite ativo'
                : 'limites ativos'
            }}
            <template v-if="overCount > 0">
              · {{ overCount }} estourada{{ overCount === 1 ? '' : 's' }}
            </template>
          </p>
        </div>
      </div>
      <NuxtLink class="limits-overview__link" to="/limites">
        Gerenciar
        <ArrowRight aria-hidden="true" />
      </NuxtLink>
    </header>

    <div v-if="pending && !limitedRows.length" class="limits-overview__body">
      <UiSkeleton height="8rem" radius="md" />
    </div>

    <div v-else-if="!limitedRows.length" class="limits-overview__empty">
      <UiEmptyState
        title="Nenhum limite definido"
        description="Defina limites por categoria ou supercategoria para acompanhar o consumo aqui."
      >
        <template #action>
          <NuxtLink to="/limites">
            <UiButton variant="secondary" size="sm">Ir para limites</UiButton>
          </NuxtLink>
        </template>
      </UiEmptyState>
    </div>

    <template v-else>
      <div class="limits-overview__total">
        <div class="limits-overview__total-copy">
          <span>Total limitado</span>
          <strong :class="{ 'is-danger': totalOver }">
            <UiMoney :value="totalSpentLimited" />
            <span>de <UiMoney :value="totalLimited" /></span>
          </strong>
        </div>
        <div
          class="limits-overview__track"
          :class="{ 'is-danger': totalOver }"
        >
          <span :style="{ width: `${totalPercent}%` }" />
        </div>
      </div>

      <ul class="limits-overview__list">
        <li v-for="row in displayRows" :key="row.rowKey">
          <CategoriesCategoryIconChip
            :icon="row.icon"
            :color="row.color"
            size="sm"
          />
          <div class="limits-overview__row-copy">
            <strong>
              {{ row.label }}
              <span class="limits-overview__scope">
                {{ row.scope === 'supercategory' ? 'Super' : 'Cat.' }}
              </span>
            </strong>
            <div
              class="limits-overview__row-track"
              :class="{ 'is-danger': isOver(row) }"
            >
              <span
                :style="{
                  width: `${rowPercent(row)}%`,
                  background: isOver(row) ? undefined : row.color,
                }"
              />
            </div>
          </div>
          <div class="limits-overview__row-amounts">
            <strong :class="{ 'is-danger': isOver(row) }">
              <UiMoney :value="row.spent" />
            </strong>
            <span>de <UiMoney :value="row.limitAmount!" /></span>
          </div>
        </li>
      </ul>

      <footer v-if="hiddenCount > 0" class="limits-overview__footer">
        <NuxtLink :to="`/limites`">
          Ver mais {{ hiddenCount }}
          {{ hiddenCount === 1 ? 'limite' : 'limites' }}
          <ArrowRight aria-hidden="true" />
        </NuxtLink>
      </footer>
    </template>
  </UiCard>
</template>

<style scoped>
.limits-overview__header,
.limits-overview__body,
.limits-overview__empty,
.limits-overview__total,
.limits-overview__list,
.limits-overview__footer {
  padding-right: var(--space-6);
  padding-left: var(--space-6);
}

.limits-overview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.limits-overview__title {
  display: flex;
  gap: var(--space-3);
}

.limits-overview__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.limits-overview__icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.limits-overview__title h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.limits-overview__title p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-overview__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-decoration: none;
}

.limits-overview__link svg {
  width: 0.9rem;
  height: 0.9rem;
}

.limits-overview__link:hover {
  color: var(--color-brand);
}

.limits-overview__body,
.limits-overview__empty {
  padding-top: var(--space-5);
  padding-bottom: var(--space-5);
}

.limits-overview__total {
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.limits-overview__total-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-overview__total-copy strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.limits-overview__total-copy strong span {
  color: var(--color-ink-muted);
  font-weight: var(--weight-medium);
}

.limits-overview__total-copy strong.is-danger {
  color: var(--color-negative-ink);
}

.limits-overview__track {
  overflow: hidden;
  height: 0.5rem;
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.limits-overview__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand);
}

.limits-overview__track.is-danger span {
  background: var(--color-negative);
}

.limits-overview__list {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding-top: var(--space-4);
  padding-bottom: var(--space-4);
  list-style: none;
}

.limits-overview__list li {
  display: grid;
  align-items: start;
  gap: var(--space-3);
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.limits-overview__row-copy strong {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  overflow: hidden;
  font-size: var(--text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.limits-overview__scope {
  flex-shrink: 0;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: 0.625rem;
  font-weight: var(--weight-medium);
  text-transform: uppercase;
}

.limits-overview__row-track {
  overflow: hidden;
  height: 0.35rem;
  margin-top: var(--space-2);
  border-radius: var(--radius-round);
  background: var(--color-surface-subtle);
}

.limits-overview__row-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-brand);
}

.limits-overview__row-track.is-danger span {
  background: var(--color-negative);
}

.limits-overview__row-amounts {
  text-align: right;
}

.limits-overview__row-amounts strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.limits-overview__row-amounts strong.is-danger {
  color: var(--color-negative-ink);
}

.limits-overview__row-amounts span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limits-overview__footer {
  padding-top: 0;
  padding-bottom: var(--space-4);
}

.limits-overview__footer a {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-brand);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-decoration: none;
}

.limits-overview__footer a svg {
  width: 0.9rem;
  height: 0.9rem;
}
</style>
