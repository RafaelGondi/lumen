<script setup lang="ts">
import { CalendarDays, X } from '@lucide/vue'
import type {
  SpendingCalendarDay,
  SpendingCalendarItem,
  SpendingCalendarReport,
  SpendingRecurrenceFilter,
} from '~/types/spendingCalendar'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)
const selectedDate = ref<string | null>(null)
const filter = ref<SpendingRecurrenceFilter>('all')

const filterOptions = [
  { value: 'all' as const, label: 'Tudo' },
  { value: 'single' as const, label: 'Avulso' },
  { value: 'installment' as const, label: 'Parcelas' },
  { value: 'fixed' as const, label: 'Fixo' },
]

const monthKey = computed(
  () =>
    `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}`,
)

const monthLabel = computed(
  () => `${MONTH_NAMES[selectedMonth.value - 1]} de ${selectedYear.value}`,
)

const isCurrentMonth = computed(() => {
  const today = new Date()
  return (
    selectedYear.value === today.getFullYear() &&
    selectedMonth.value === today.getMonth() + 1
  )
})

const rangeLabel = computed(() => {
  const days = report.value?.days.length ?? 0
  if (!days) return ''
  const monthName = MONTH_NAMES[selectedMonth.value - 1]
  return `1 de ${monthName} — ${days} de ${monthName} ${selectedYear.value}`
})

const {
  data: report,
  pending,
  error,
} = await useFetch<SpendingCalendarReport>(
  () => `/api/calendar?month=${monthKey.value}&filter=${filter.value}`,
  {
    watch: [monthKey, filter],
    default: () => null,
  },
)

watch(
  report,
  (value) => {
    if (!value?.days.length) {
      selectedDate.value = null
      return
    }
    if (
      selectedDate.value &&
      value.days.some((day) => day.date === selectedDate.value)
    ) {
      return
    }
    const today = value.days.find((day) => day.isToday)
    const firstSpend = value.days.find((day) => day.count > 0)
    selectedDate.value = today?.date ?? firstSpend?.date ?? value.days[0]!.date
  },
  { immediate: true },
)

const selectedDay = computed<SpendingCalendarDay | null>(() => {
  if (!report.value || !selectedDate.value) return null
  return (
    report.value.days.find((day) => day.date === selectedDate.value) ?? null
  )
})

const calendarCells = computed(() => {
  const days = report.value?.days ?? []
  if (!days.length) return []

  const [year, month] = monthKey.value.split('-').map(Number)
  // JS: 0=Sun..6=Sat → convert to Mon-first index 0..6
  const firstWeekday = new Date(year!, month! - 1, 1).getDay()
  const leading = (firstWeekday + 6) % 7

  const cells: Array<SpendingCalendarDay | null> = Array.from(
    { length: leading },
    () => null,
  )
  cells.push(...days)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
})

const selectedDayTitle = computed(() => {
  if (!selectedDay.value) return ''
  const date = new Date(
    `${selectedDay.value.date}T12:00:00`,
  )
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' })
  const capitalized =
    weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '')
  const monthName = MONTH_NAMES[selectedMonth.value - 1]
  return `${capitalized}, ${selectedDay.value.day} de ${monthName}`
})

function shiftMonth(delta: number) {
  const date = new Date(selectedYear.value, selectedMonth.value - 1 + delta, 1)
  selectedYear.value = date.getFullYear()
  selectedMonth.value = date.getMonth() + 1
}

function goToCurrentMonth() {
  const today = new Date()
  selectedYear.value = today.getFullYear()
  selectedMonth.value = today.getMonth() + 1
}

function selectDay(day: SpendingCalendarDay | null) {
  if (!day) return
  selectedDate.value = day.date
}

function closeDayPanel() {
  selectedDate.value = null
}

function dayStyle(day: SpendingCalendarDay) {
  if (day.count <= 0) return undefined
  const color = day.dominantColor ?? 'var(--color-negative)'
  const alpha = 0.18 + day.intensity * 0.42
  return {
    background: hexToRgba(color, alpha),
    borderColor: hexToRgba(color, 0.35 + day.intensity * 0.4),
  }
}

function hexToRgba(color: string, alpha: number) {
  if (color.startsWith('var(')) {
    return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
  }
  const hex = color.replace('#', '')
  if (hex.length !== 6) return color
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

function itemMeta(item: SpendingCalendarItem) {
  const parts: string[] = []
  if (item.categoryName) parts.push(item.categoryName)
  else parts.push('Sem categoria')
  if (item.source === 'card' && item.cardName) parts.push(item.cardName)
  if (item.source === 'account' && item.accountName) parts.push(item.accountName)
  if (
    item.recurrence === 'installment' &&
    item.installmentIndex &&
    item.installmentCount
  ) {
    parts.push(`${item.installmentIndex}/${item.installmentCount}`)
  }
  if (item.recurrence === 'fixed') parts.push('Fixa')
  return parts.join(' · ')
}
</script>

<template>
  <div class="calendar-page">
    <PageHeading
      eyebrow="Financeiro / Lançamentos"
      title="Calendário de gastos"
      description="Visualize seus padrões de consumo ao longo do mês."
    >
      <template #actions>
        <UiMonthSwitcher
          :label="monthLabel"
          :can-go-previous="true"
          :can-go-next="true"
          :is-current="isCurrentMonth"
          @previous="shiftMonth(-1)"
          @next="shiftMonth(1)"
          @current="goToCurrentMonth"
        />
      </template>
    </PageHeading>

    <div v-if="error" class="calendar-page__error">
      <UiEmptyState
        title="Não foi possível carregar o calendário"
        description="Tente novamente em instantes."
      />
    </div>

    <div v-else class="calendar-layout" :class="{ 'has-panel': selectedDay }">
      <UiCard class="calendar-board" padding="lg">
        <div class="calendar-board__toolbar">
          <div class="calendar-board__range">
            <span class="calendar-board__icon" aria-hidden="true">
              <CalendarDays />
            </span>
            <div>
              <strong>{{ rangeLabel }}</strong>
              <p>Clique em um dia para ver os detalhes</p>
            </div>
          </div>

          <div class="calendar-board__filters">
            <UiSegmentedControl v-model="filter" :options="filterOptions" />
            <p v-if="report" class="calendar-board__counter">
              Dias com gasto
              <strong
                >{{ report.stats.daysWithSpend }} /
                {{ report.stats.daysInMonth }}</strong
              >
            </p>
          </div>
        </div>

        <div v-if="pending && !report" class="calendar-board__loading">
          <UiSkeleton height="18rem" radius="md" />
        </div>

        <div v-else class="calendar-grid" role="grid" aria-label="Calendário">
          <div class="calendar-grid__head" role="row">
            <span v-for="weekday in WEEKDAYS" :key="weekday" role="columnheader">
              {{ weekday }}
            </span>
          </div>
          <div class="calendar-grid__body" role="rowgroup">
            <button
              v-for="(cell, index) in calendarCells"
              :key="cell?.date ?? `empty-${index}`"
              type="button"
              class="calendar-day"
              :class="{
                'calendar-day--empty': !cell,
                'calendar-day--spend': cell && cell.count > 0,
                'calendar-day--today': cell?.isToday,
                'calendar-day--selected':
                  cell && selectedDate === cell.date,
              }"
              :disabled="!cell"
              :style="cell ? dayStyle(cell) : undefined"
              :aria-label="
                cell
                  ? `${cell.day}: ${cell.count} gasto(s), total ${cell.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : undefined
              "
              :aria-pressed="cell ? selectedDate === cell.date : undefined"
              role="gridcell"
              @click="selectDay(cell)"
            >
              <template v-if="cell">
                <span class="calendar-day__number">
                  {{ cell.day }}
                  <em v-if="cell.isToday">hoje</em>
                </span>
                <span v-if="cell.count > 0" class="calendar-day__amount">
                  <UiMoney :value="cell.total" />
                </span>
              </template>
            </button>
          </div>
        </div>

        <div v-if="report" class="calendar-stats">
          <div>
            <strong>{{ report.stats.currentStreak }}</strong>
            <p>dias sem compra (atual)</p>
          </div>
          <div>
            <strong>{{ report.stats.longestStreak }}</strong>
            <p>maior streak sem compra</p>
          </div>
          <div>
            <strong>
              <template v-if="report.stats.peakDay"
                >Dia {{ report.stats.peakDay }}</template
              >
              <template v-else>—</template>
            </strong>
            <p>dia com mais gasto</p>
          </div>
        </div>
      </UiCard>

      <aside v-if="selectedDay" class="calendar-panel" aria-live="polite">
        <header class="calendar-panel__header">
          <div>
            <strong class="calendar-panel__day">{{ selectedDay.day }}</strong>
            <div>
              <p>{{ selectedDayTitle }}</p>
              <span
                >{{ selectedDay.count }}
                {{
                  selectedDay.count === 1 ? 'transação' : 'transações'
                }}</span
              >
            </div>
          </div>
          <button
            type="button"
            class="calendar-panel__close"
            aria-label="Fechar detalhes do dia"
            @click="closeDayPanel"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div class="calendar-panel__total">
          <p>Total do dia</p>
          <strong><UiMoney :value="selectedDay.total" /></strong>
        </div>

        <UiEmptyState
          v-if="!selectedDay.items.length"
          title="Nenhum gasto neste dia"
          description="Selecione outro dia ou troque o filtro de recorrência."
        >
          <template #icon><CalendarDays /></template>
        </UiEmptyState>

        <ul v-else class="calendar-panel__list">
          <li v-for="item in selectedDay.items" :key="item.id">
            <CategoriesCategoryIconChip
              v-if="item.categoryIcon && item.categoryColor"
              :icon="item.categoryIcon"
              :color="item.categoryColor"
            />
            <span
              v-else
              class="calendar-panel__fallback"
              :style="{
                background: item.cardColor ?? 'var(--color-ink-muted)',
              }"
              aria-hidden="true"
            >
              {{ (item.description || '?').slice(0, 1).toUpperCase() }}
            </span>
            <div class="calendar-panel__copy">
              <strong>{{ item.description }}</strong>
              <p>{{ itemMeta(item) }}</p>
            </div>
            <span class="calendar-panel__amount numeric">
              <UiMoney :value="item.amount" />
            </span>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.calendar-page {
  display: grid;
  gap: var(--space-6);
}

.calendar-layout {
  display: grid;
  gap: var(--space-5);
}

.calendar-layout.has-panel {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
  align-items: start;
}

.calendar-board__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.calendar-board__range {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.calendar-board__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  color: var(--color-brand);
}

.calendar-board__icon :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
}

.calendar-board__range strong {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.calendar-board__range p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calendar-board__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
}

.calendar-board__counter {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calendar-board__counter strong {
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
}

.calendar-grid__head,
.calendar-grid__body {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-2);
}

.calendar-grid__head {
  margin-bottom: var(--space-2);
}

.calendar-grid__head span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-align: center;
}

.calendar-day {
  display: flex;
  min-height: 4.5rem;
  padding: var(--space-2);
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.calendar-day:disabled {
  cursor: default;
  opacity: 0;
  pointer-events: none;
}

.calendar-day:not(:disabled):hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-xs);
}

.calendar-day--spend {
  border-width: 1px;
}

.calendar-day--today {
  box-shadow: inset 0 0 0 1px var(--color-positive);
}

.calendar-day--selected {
  border-color: var(--color-brand-ink);
  box-shadow: inset 0 0 0 1px var(--color-brand-ink), var(--shadow-xs);
  transform: translateY(-1px);
}

.calendar-day__number {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.calendar-day__number em {
  color: var(--color-positive-ink);
  font-size: 0.625rem;
  font-style: normal;
  font-weight: var(--weight-semibold);
  text-transform: lowercase;
}

.calendar-day__amount {
  color: var(--color-ink-secondary);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
}

.calendar-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}

.calendar-stats strong {
  display: block;
  color: var(--color-ink);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  letter-spacing: -0.02em;
}

.calendar-stats p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calendar-panel {
  position: sticky;
  top: var(--space-4);
  display: flex;
  max-height: calc(100vh - 6rem);
  padding: var(--space-5);
  flex-direction: column;
  gap: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.calendar-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.calendar-panel__header > div:first-child {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.calendar-panel__day {
  color: var(--color-ink);
  font-size: 2rem;
  font-weight: var(--weight-semibold);
  letter-spacing: -0.03em;
  line-height: 1;
}

.calendar-panel__header p {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.calendar-panel__header span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calendar-panel__close {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.calendar-panel__close:hover {
  background: var(--color-surface-subtle);
  color: var(--color-ink);
}

.calendar-panel__close :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
}

.calendar-panel__total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.calendar-panel__total p {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.calendar-panel__total strong {
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.calendar-panel__list {
  display: flex;
  margin: 0;
  padding: 0;
  flex-direction: column;
  gap: var(--space-1);
  list-style: none;
  overflow-y: auto;
}

.calendar-panel__list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border-radius: var(--radius-md);
}

.calendar-panel__list li:hover {
  background: var(--color-surface-subtle);
}

.calendar-panel__fallback {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  color: var(--color-white);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.calendar-panel__copy {
  min-width: 0;
}

.calendar-panel__copy strong {
  display: block;
  overflow: hidden;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-panel__copy p {
  margin-top: 0.125rem;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-panel__amount {
  color: var(--color-negative-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

@media (max-width: 1100px) {
  .calendar-layout.has-panel {
    grid-template-columns: 1fr;
  }

  .calendar-panel {
    position: static;
    max-height: none;
  }
}
</style>
