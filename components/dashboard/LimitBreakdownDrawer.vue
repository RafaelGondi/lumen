<script setup lang="ts">
import type { LimitBreakdownItem, LimitBreakdownReport } from '~/types/limits'
import { formatDateBr } from '~/utils/dateMoney'

const props = defineProps<{
  report: LimitBreakdownReport | null
  pending: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const itemCount = computed(() => props.report?.items.length ?? 0)
const utilizationPercent = computed(() => {
  const report = props.report
  if (!report || report.limitAmount === null || report.limitAmount <= 0) {
    return null
  }
  return Math.round((report.spent / report.limitAmount) * 100)
})
const limitExceeded = computed(
  () =>
    props.report?.limitAmount !== null &&
    props.report !== null &&
    props.report.spent > props.report.limitAmount,
)
const limitDifference = computed(() => {
  const report = props.report
  if (!report || report.limitAmount === null) return null
  return Math.round(Math.abs(report.limitAmount - report.spent) * 100) / 100
})
const limitExceededOnLabel = computed(() => {
  const report = props.report
  if (!report || report.limitAmount === null || !limitExceeded.value) {
    return null
  }

  let accumulated = 0
  const items = [...report.items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.amount - b.amount ||
      a.description.localeCompare(b.description, 'pt-BR'),
  )

  for (const item of items) {
    accumulated = Math.round((accumulated + item.amount) * 100) / 100
    if (accumulated > report.limitAmount) {
      return formatDateGroup(item.date).label
    }
  }

  return null
})

type LimitDateGroup = {
  key: string
  label: string
  weekday: string
  total: number
  items: LimitBreakdownItem[]
}

function formatDateGroup(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return { label: formatDateBr(isoDate), weekday: '' }
  }

  return {
    label: new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
    }).format(date),
    weekday: new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
    })
      .format(date)
      .replace(/^./, (letter) => letter.toUpperCase()),
  }
}

const dateGroups = computed<LimitDateGroup[]>(() => {
  const groups = new Map<string, LimitDateGroup>()
  const items = [...(props.report?.items ?? [])].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.amount - a.amount ||
      a.description.localeCompare(b.description, 'pt-BR'),
  )

  for (const item of items) {
    const current = groups.get(item.date)
    if (current) {
      current.items.push(item)
      current.total = Math.round((current.total + item.amount) * 100) / 100
      continue
    }

    groups.set(item.date, {
      key: item.date,
      ...formatDateGroup(item.date),
      total: item.amount,
      items: [item],
    })
  }

  return [...groups.values()]
})

function itemMeta(item: LimitBreakdownItem) {
  const parts: string[] = []

  if (item.sourceLabel) parts.push(item.sourceLabel)
  parts.push(item.source === 'card' ? 'Cartão' : 'Conta')

  if (item.recurrence === 'installment' && item.installmentCount) {
    parts.push(`${item.installmentCount} parcelas`)
  } else if (item.recurrence === 'fixed') {
    parts.push('Fixo mensal')
  }

  return parts.join(' · ')
}

function itemAmountLabel(item: LimitBreakdownItem) {
  if (item.recurrence !== 'installment' || !item.installmentCount) return null
  return `Parcela de ${item.originalAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })}`
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="report ? `Consumo de ${report.label}` : 'Consumo do limite'"
  >
    <div class="limit-breakdown">
      <UiSkeleton v-if="pending && !report" height="12rem" radius="md" />

      <template v-else-if="report">
        <div class="limit-breakdown__summary">
          <div class="limit-breakdown__summary-primary">
            <div>
              <p>Utilizado no mês</p>
              <strong><UiMoney :value="report.spent" /></strong>
              <span>
                {{ itemCount }} {{ itemCount === 1 ? 'compra' : 'compras' }}
              </span>
            </div>
            <span
              v-if="utilizationPercent !== null"
              class="limit-breakdown__percentage"
              :class="{ 'is-over': limitExceeded }"
            >
              {{ utilizationPercent }}% do limite
            </span>
          </div>

          <template v-if="report.limitAmount !== null">
            <div class="limit-breakdown__progress" aria-hidden="true">
              <span
                :class="{ 'is-over': limitExceeded }"
                :style="{ width: `${Math.min(utilizationPercent ?? 0, 100)}%` }"
              />
            </div>

            <dl class="limit-breakdown__metrics">
              <div>
                <dt>Limite definido</dt>
                <dd><UiMoney :value="report.limitAmount" /></dd>
              </div>
              <div>
                <dt>{{ limitExceeded ? 'Acima do limite' : 'Disponível' }}</dt>
                <dd :class="limitExceeded ? 'is-negative' : 'is-positive'">
                  <UiMoney :value="limitDifference ?? 0" />
                  <span v-if="limitExceededOnLabel">
                    desde {{ limitExceededOnLabel }}
                  </span>
                </dd>
              </div>
            </dl>
          </template>

          <div v-if="report.spent > 0" class="limit-breakdown__sources">
            <span>Origem do consumo</span>
            <div>
              <span v-if="report.sourceTotals.account > 0">
                Conta <strong><UiMoney :value="report.sourceTotals.account" /></strong>
              </span>
              <span v-if="report.sourceTotals.card > 0">
                Cartão <strong><UiMoney :value="report.sourceTotals.card" /></strong>
              </span>
            </div>
          </div>
        </div>

        <UiEmptyState
          v-if="!report.items.length"
          title="Nenhuma compra consumindo este limite"
          description="Quando houver compras neste mês para esta categoria, elas aparecerão aqui."
        />

        <div v-else class="limit-breakdown__groups">
          <section
            v-for="group in dateGroups"
            :key="group.key"
            class="limit-breakdown__group"
          >
            <header class="limit-breakdown__date-header">
              <div>
                <strong>{{ group.label }}</strong>
                <span>
                  <template v-if="group.weekday">{{ group.weekday }} · </template>
                  {{ group.items.length }}
                  {{ group.items.length === 1 ? 'compra' : 'compras' }}
                </span>
              </div>
              <strong class="limit-breakdown__date-total numeric">
                <UiMoney :value="group.total" />
              </strong>
            </header>

            <ul class="limit-breakdown__list">
              <li v-for="item in group.items" :key="item.id">
                <CategoriesCategoryIconChip
                  v-if="item.categoryIcon && item.categoryColor"
                  :icon="item.categoryIcon"
                  :color="item.categoryColor"
                  size="sm"
                />
                <span v-else class="limit-breakdown__fallback" aria-hidden="true">
                  {{ item.description.slice(0, 1).toUpperCase() }}
                </span>

                <div class="limit-breakdown__copy">
                  <strong>{{ item.description }}</strong>
                  <p>{{ itemMeta(item) }}</p>
                  <p v-if="itemAmountLabel(item)" class="limit-breakdown__installment">
                    {{ itemAmountLabel(item) }} · conta no limite pelo total da compra
                  </p>
                </div>

                <span class="limit-breakdown__amount numeric">
                  <UiMoney :value="item.amount" />
                </span>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </div>
  </UiDrawer>
</template>

<style scoped>
.limit-breakdown {
  display: grid;
  gap: var(--space-5);
}

.limit-breakdown__summary {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.limit-breakdown__summary-primary {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-4);
}

.limit-breakdown__summary-primary p,
.limit-breakdown__summary-primary > div > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__summary-primary > div > strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__summary-primary > div > span {
  display: block;
  margin-top: 0.15rem;
}

.limit-breakdown__percentage {
  padding: 0.35rem var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.limit-breakdown__percentage.is-over {
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.limit-breakdown__progress {
  height: 0.35rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-border);
}

.limit-breakdown__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}

.limit-breakdown__progress span.is-over {
  background: var(--color-negative);
}

.limit-breakdown__metrics {
  display: grid;
  margin: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.limit-breakdown__metrics > div {
  display: grid;
  gap: var(--space-1);
}

.limit-breakdown__metrics > div + div {
  padding-left: var(--space-4);
  border-left: 1px solid var(--color-border);
}

.limit-breakdown__metrics dt,
.limit-breakdown__sources > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__metrics dd {
  margin: 0;
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__metrics dd.is-negative {
  color: var(--color-negative-ink);
}

.limit-breakdown__metrics dd.is-positive {
  color: var(--color-positive-ink);
}

.limit-breakdown__metrics dd > span {
  display: block;
  margin-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-regular);
}

.limit-breakdown__sources {
  display: flex;
  padding-top: var(--space-3);
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.limit-breakdown__sources > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.limit-breakdown__sources > div > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__sources strong {
  color: var(--color-ink-secondary);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__groups {
  display: grid;
  gap: var(--space-5);
}

.limit-breakdown__group + .limit-breakdown__group {
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.limit-breakdown__date-header {
  display: flex;
  margin-bottom: var(--space-2);
  padding: 0 var(--space-1);
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
}

.limit-breakdown__date-header > div {
  display: grid;
  gap: 0.1rem;
}

.limit-breakdown__date-header > div > strong {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__date-header span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__date-total {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.limit-breakdown__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.limit-breakdown__list li {
  display: grid;
  align-items: start;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.limit-breakdown__fallback {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.limit-breakdown__copy strong {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.limit-breakdown__copy p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-breakdown__copy .limit-breakdown__installment {
  color: var(--color-ink-secondary);
}

.limit-breakdown__amount {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (max-width: 520px) {
  .limit-breakdown__list li {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .limit-breakdown__amount {
    grid-column: 2;
  }
}
</style>
