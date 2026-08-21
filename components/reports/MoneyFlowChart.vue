<script setup lang="ts">
import type { MoneyFlowItem, MoneyFlowReport } from '~/types/moneyFlow'

const props = defineProps<{
  report: MoneyFlowReport
}>()

const WIDTH = 1080
const TOP = 20
const BOTTOM = 20
const GAP = 34
const NODE_WIDTH = 12
const LEFT_X = 180
const CENTER_X = 500
const RIGHT_X = 820

type FlowNode = MoneyFlowItem & {
  y: number
  height: number
  flowY: number
}

const chartHeight = computed(() =>
  Math.max(380, Math.max(props.report.incomeSources.length, props.report.destinations.length) * 62),
)

const flowHeight = computed(() => {
  const count = Math.max(
    props.report.incomeSources.length,
    props.report.destinations.length,
    1,
  )
  return chartHeight.value - TOP - BOTTOM - GAP * (count - 1)
})

function layout(items: MoneyFlowItem[]): FlowNode[] {
  if (!items.length || props.report.flowTotal <= 0) return []
  const usedHeight = items.reduce(
    (sum, item) => sum + (item.amount / props.report.flowTotal) * flowHeight.value,
    0,
  )
  const contentHeight = usedHeight + GAP * Math.max(items.length - 1, 0)
  let y = (chartHeight.value - contentHeight) / 2
  let flowY = (chartHeight.value - flowHeight.value) / 2

  return items.map((item) => {
    const height = (item.amount / props.report.flowTotal) * flowHeight.value
    const node = { ...item, y, height, flowY }
    y += height + GAP
    flowY += height
    return node
  })
}

const sourceNodes = computed(() => layout(props.report.incomeSources))
const destinationNodes = computed(() => layout(props.report.destinations))
const centerY = computed(() => (chartHeight.value - flowHeight.value) / 2)

function ribbonPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
) {
  const curve = (x2 - x1) * 0.48
  return [
    `M ${x1} ${y1}`,
    `C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
    `L ${x2} ${y2 + height}`,
    `C ${x2 - curve} ${y2 + height}, ${x1 + curve} ${y1 + height}, ${x1} ${y1 + height}`,
    'Z',
  ].join(' ')
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function compactMoney(value: number) {
  if (value >= 10000) {
    return `R$ ${(value / 1000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil`
  }
  return formatMoney(value)
}

function label(item: MoneyFlowItem) {
  return item.label.length > 23 ? `${item.label.slice(0, 22)}…` : item.label
}
</script>

<template>
  <div class="money-flow-chart">
    <div class="money-flow-chart__heading">
      <div>
        <h2>Origem e destino do dinheiro</h2>
        <p>
          Receitas e pagamentos do mês — faturas são detalhadas pelas categorias
          das compras que as compõem.
        </p>
      </div>
      <div class="money-flow-chart__summary" aria-label="Resumo do fluxo mensal">
        <span>
          <small>Receitas</small>
          <strong class="is-income">{{ formatMoney(report.incomeTotal) }}</strong>
        </span>
        <span>
          <small>Saídas</small>
          <strong class="is-expense">{{ formatMoney(report.expenseTotal) }}</strong>
        </span>
        <span>
          <small>{{ report.netAmount >= 0 ? 'Economia' : 'Déficit' }}</small>
          <strong :class="report.netAmount >= 0 ? 'is-income' : 'is-expense'">
            {{ formatMoney(Math.abs(report.netAmount)) }}
          </strong>
        </span>
        <span>
          <small>Taxa de economia</small>
          <strong>{{ report.savingsRate === null ? '—' : `${report.savingsRate.toLocaleString('pt-BR')}%` }}</strong>
        </span>
      </div>
    </div>

    <UiEmptyState
      v-if="report.flowTotal <= 0"
      title="Nenhum fluxo neste mês"
      description="Registre receitas ou gastos para visualizar a distribuição."
    />

    <div v-else class="money-flow-chart__viewport">
      <div class="money-flow-chart__columns" aria-hidden="true">
        <span>Origens</span>
        <span>{{ report.netAmount < 0 ? 'Recursos usados' : 'Receita total' }}</span>
        <span>Destinos</span>
      </div>

      <svg
        class="money-flow-chart__diagram"
        :viewBox.attr="`0 0 ${WIDTH} ${chartHeight}`"
        role="img"
        :aria-label="`Fluxo financeiro de ${report.fullLabel}`"
      >
        <g class="money-flow-chart__ribbons money-flow-chart__ribbons--source">
          <path
            v-for="node in sourceNodes"
            :key="`source-ribbon:${node.key}`"
            :d.attr="ribbonPath(LEFT_X + NODE_WIDTH, node.y, CENTER_X, node.flowY, node.height)"
            :fill.attr="node.color"
          >
            <title>{{ node.label }}: {{ formatMoney(node.amount) }}</title>
          </path>
        </g>

        <g class="money-flow-chart__ribbons money-flow-chart__ribbons--destination">
          <path
            v-for="node in destinationNodes"
            :key="`destination-ribbon:${node.key}`"
            :d.attr="ribbonPath(CENTER_X + NODE_WIDTH, node.flowY, RIGHT_X, node.y, node.height)"
            :fill.attr="node.color"
          >
            <title>{{ node.label }}: {{ formatMoney(node.amount) }}</title>
          </path>
        </g>

        <g v-for="node in sourceNodes" :key="`source:${node.key}`" class="money-flow-chart__node">
          <rect
            :x.attr="LEFT_X"
            :y.attr="node.y"
            :width.attr="NODE_WIDTH"
            :height.attr="Math.max(node.height, 2)"
            :fill.attr="node.color"
            rx="3"
          />
          <text :x.attr="LEFT_X - 12" :y.attr="node.y + node.height / 2 - 3" text-anchor="end">
            <tspan class="money-flow-chart__label">{{ label(node) }}</tspan>
            <tspan :x.attr="LEFT_X - 12" dy="17" class="money-flow-chart__value">
              {{ compactMoney(node.amount) }} · {{ node.percent.toLocaleString('pt-BR') }}%
            </tspan>
          </text>
        </g>

        <g class="money-flow-chart__node money-flow-chart__node--center">
          <rect
            :x.attr="CENTER_X"
            :y.attr="centerY"
            :width.attr="NODE_WIDTH"
            :height.attr="flowHeight"
            fill="var(--money-flow-center)"
            rx="3"
          />
          <text :x.attr="CENTER_X - 12" :y.attr="centerY + flowHeight / 2 - 3" text-anchor="end">
            <tspan class="money-flow-chart__label">
              {{ report.netAmount < 0 ? 'Recursos usados' : 'Receita total' }}
            </tspan>
            <tspan :x.attr="CENTER_X - 12" dy="17" class="money-flow-chart__value">
              {{ compactMoney(report.flowTotal) }}
            </tspan>
          </text>
        </g>

        <g
          v-for="node in destinationNodes"
          :key="`destination:${node.key}`"
          class="money-flow-chart__node"
        >
          <rect
            :x.attr="RIGHT_X"
            :y.attr="node.y"
            :width.attr="NODE_WIDTH"
            :height.attr="Math.max(node.height, 2)"
            :fill.attr="node.color"
            rx="3"
          />
          <text :x.attr="RIGHT_X + NODE_WIDTH + 12" :y.attr="node.y + node.height / 2 - 3">
            <tspan class="money-flow-chart__label">{{ label(node) }}</tspan>
            <tspan :x.attr="RIGHT_X + NODE_WIDTH + 12" dy="17" class="money-flow-chart__value">
              {{ compactMoney(node.amount) }} · {{ node.percent.toLocaleString('pt-BR') }}%
            </tspan>
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.money-flow-chart {
  --money-flow-center: #2f7f78;
}

.money-flow-chart__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}

.money-flow-chart__heading h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.money-flow-chart__heading p {
  max-width: 39rem;
  margin-top: var(--space-1);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.money-flow-chart__summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-4);
}

.money-flow-chart__summary span {
  min-width: 5.5rem;
}

.money-flow-chart__summary small,
.money-flow-chart__summary strong {
  display: block;
  white-space: nowrap;
}

.money-flow-chart__summary small {
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
}

.money-flow-chart__summary strong {
  margin-top: 0.15rem;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.money-flow-chart__summary .is-income { color: var(--color-positive-ink); }
.money-flow-chart__summary .is-expense { color: var(--color-negative-ink); }

.money-flow-chart__viewport {
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.money-flow-chart__columns {
  display: grid;
  min-width: 62rem;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 0 10rem var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.05em;
  text-align: center;
  text-transform: uppercase;
}

.money-flow-chart__diagram {
  display: block;
  min-width: 62rem;
  width: 100%;
  overflow: visible;
}

.money-flow-chart__ribbons path {
  opacity: 0.22;
  transition: opacity var(--transition-fast);
}

.money-flow-chart__ribbons path:hover {
  opacity: 0.42;
}

.money-flow-chart__ribbons--source path {
  opacity: 0.28;
}

.money-flow-chart__node rect {
  stroke: rgb(255 255 255 / 50%);
  stroke-width: 1;
}

.money-flow-chart__node text {
  dominant-baseline: middle;
  pointer-events: none;
}

.money-flow-chart__label {
  fill: var(--color-ink);
  font-size: 12px;
  font-weight: var(--weight-semibold);
}

.money-flow-chart__value {
  fill: var(--color-ink-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 800px) {
  .money-flow-chart__heading {
    flex-direction: column;
  }

  .money-flow-chart__summary {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 520px) {
  .money-flow-chart__summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
