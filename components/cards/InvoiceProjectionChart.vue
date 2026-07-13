<script setup lang="ts">
import type { CardInvoiceProjectionMonth } from '~/types/cardInvoice'

const props = withDefaults(
  defineProps<{
    items: CardInvoiceProjectionMonth[]
    total: number
    title?: string
    subtitle?: string
  }>(),
  {
    title: 'Projeção de faturas',
    subtitle:
      'Próximos 12 meses — clique numa barra para abrir a fatura do mês.',
  },
)

const emit = defineEmits<{
  select: [month: string]
}>()

const hoveredMonth = ref<string | null>(null)

const axisMax = computed(() =>
  niceCeiling(Math.max(0, ...props.items.map((item) => item.amount))),
)

const ticks = computed(() => {
  const steps = 6
  return Array.from({ length: steps + 1 }, (_, index) => {
    const value = (axisMax.value / steps) * (steps - index)
    return {
      value,
      label: formatAxisMoney(value),
    }
  })
})

function niceCeiling(value: number) {
  if (value <= 0) return 300
  const padded = value * 1.15
  const exp = Math.floor(Math.log10(padded))
  const base = 10 ** exp
  const fraction = padded / base
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * base
}

function formatAxisMoney(value: number) {
  if (value === 0) return 'R$ 0'
  return `R$ ${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })}`
}

function formatTooltipMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatMonthKey(month: string) {
  const [year, value] = month.split('-')
  return `${value}/${year}`
}

function barHeight(amount: number) {
  if (axisMax.value <= 0) return 0
  return Math.max(amount > 0 ? 8 : 0, (amount / axisMax.value) * 100)
}
</script>

<template>
  <div class="projection-chart">
    <div class="projection-chart__heading">
      <div>
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>
      <strong>
        Total:
        <UiMoney :value="total" />
      </strong>
    </div>

    <div class="projection-chart__body">
      <div class="projection-chart__axis" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick.value">{{ tick.label }}</span>
      </div>

      <div class="projection-chart__plot">
        <div class="projection-chart__grid" aria-hidden="true">
          <span v-for="tick in ticks" :key="`grid-${tick.value}`" />
        </div>

        <div class="projection-chart__bars" role="list">
          <button
            v-for="item in items"
            :key="item.month"
            type="button"
            class="projection-chart__col"
            role="listitem"
            :aria-label="`${formatMonthKey(item.month)}: ${formatTooltipMoney(item.amount)}`"
            @mouseenter="hoveredMonth = item.month"
            @mouseleave="hoveredMonth = null"
            @focus="hoveredMonth = item.month"
            @blur="hoveredMonth = null"
            @click="emit('select', item.month)"
          >
            <div class="projection-chart__track">
              <div
                class="projection-chart__stack"
                :style="{
                  height: `${Math.max(barHeight(item.amount), item.amount > 0 ? 8 : 2)}%`,
                }"
              >
                <div
                  v-if="hoveredMonth === item.month"
                  class="projection-chart__tooltip"
                  role="tooltip"
                >
                  <p>{{ formatMonthKey(item.month) }}</p>
                  <div>
                    <span
                      aria-hidden="true"
                      :class="{
                        'projection-chart__swatch--residual': item.residual,
                      }"
                    />
                    {{ formatTooltipMoney(item.amount) }}
                    <em v-if="item.residual">residual</em>
                  </div>
                </div>
                <span
                  class="projection-chart__bar"
                  :class="{
                    'projection-chart__bar--empty': item.amount <= 0,
                    'projection-chart__bar--residual': item.residual,
                    'projection-chart__bar--active': hoveredMonth === item.month,
                  }"
                />
              </div>
            </div>
            <small>{{ item.shortLabel }}</small>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projection-chart__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.projection-chart__heading h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.projection-chart__heading p {
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.projection-chart__heading strong {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.projection-chart__body {
  display: grid;
  grid-template-columns: 3.75rem minmax(0, 1fr);
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.projection-chart__axis {
  display: flex;
  height: 14rem;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 1.5rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.projection-chart__plot {
  position: relative;
  min-width: 0;
}

.projection-chart__grid {
  position: absolute;
  inset: 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.projection-chart__grid span {
  width: 100%;
  border-top: 1px dashed var(--color-border);
}

.projection-chart__bars {
  position: relative;
  z-index: 1;
  display: grid;
  height: 14rem;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.45rem;
  align-items: end;
  padding-bottom: 1.5rem;
}

.projection-chart__col {
  display: flex;
  height: 100%;
  padding: 0;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  border: 0;
  background: transparent;
  cursor: pointer;
}

.projection-chart__track {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: flex-end;
  justify-content: center;
}

.projection-chart__stack {
  position: relative;
  display: flex;
  width: min(100%, 2.4rem);
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}

.projection-chart__bar {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0.65rem 0.65rem 0.2rem 0.2rem;
  background: var(--color-brand);
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.projection-chart__bar--residual {
  background: color-mix(in srgb, var(--color-brand) 38%, white);
}

.projection-chart__bar--empty {
  height: 0.2rem;
  background: var(--color-border-strong);
  border-radius: var(--radius-round);
  opacity: 0.7;
}

.projection-chart__bar--active {
  background: var(--color-brand-hover);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.projection-chart__bar--residual.projection-chart__bar--active {
  background: color-mix(in srgb, var(--color-brand) 55%, white);
}

.projection-chart__col small {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
}

.projection-chart__tooltip {
  position: absolute;
  bottom: calc(100% + 0.45rem);
  left: 50%;
  z-index: 3;
  min-width: 7.5rem;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: #151b24;
  color: white;
  box-shadow: var(--shadow-md);
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
}

.projection-chart__col:first-child .projection-chart__tooltip,
.projection-chart__col:nth-child(2) .projection-chart__tooltip {
  left: 0;
  transform: none;
}

.projection-chart__col:nth-last-child(-n + 2) .projection-chart__tooltip {
  right: 0;
  left: auto;
  transform: none;
}

.projection-chart__tooltip p {
  margin-bottom: var(--space-2);
  color: rgb(255 255 255 / 72%);
  font-size: 0.6875rem;
  font-weight: var(--weight-medium);
}

.projection-chart__tooltip div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.projection-chart__tooltip span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 0.15rem;
  background: var(--color-brand);
  flex-shrink: 0;
}

.projection-chart__tooltip span.projection-chart__swatch--residual {
  background: color-mix(in srgb, var(--color-brand) 45%, white);
}

.projection-chart__tooltip em {
  color: rgb(255 255 255 / 65%);
  font-size: 0.625rem;
  font-style: normal;
  font-weight: var(--weight-medium);
}

@media (max-width: 720px) {
  .projection-chart__body {
    grid-template-columns: 3.1rem minmax(0, 1fr);
  }

  .projection-chart__stack {
    width: min(100%, 1.6rem);
  }
}
</style>
