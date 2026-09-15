<script setup lang="ts">
import { Coins, Pencil } from '@lucide/vue'
import type { CardInvoiceReward } from '~/types/cardInvoice'
import { formatDateBr, roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  reward: CardInvoiceReward
}>()

defineEmits<{ manage: [] }>()

const valuePerThousand = computed(() =>
  roundMoney((props.reward.creditAmount / props.reward.pointsUsed) * 1000),
)
</script>

<template>
  <div class="card-reward-row">
    <span class="card-reward-row__icon" aria-hidden="true"><Coins /></span>
    <div class="card-reward-row__main">
      <div class="card-reward-row__title">
        <strong>Crédito com pontos</strong>
        <span>Crédito</span>
      </div>
      <p>
        {{ reward.program }} · {{ reward.pointsUsed.toLocaleString('pt-BR') }} pontos
      </p>
      <small>
        {{ formatDateBr(reward.creditedAt) }} ·
        <UiMoney :value="valuePerThousand" />/mil
      </small>
      <small v-if="reward.notes">{{ reward.notes }}</small>
    </div>
    <strong class="card-reward-row__amount">
      + <UiMoney :value="reward.creditAmount" />
    </strong>
    <button
      type="button"
      class="card-reward-row__manage"
      aria-label="Gerenciar pontos e resgates"
      title="Gerenciar pontos e resgates"
      @click="$emit('manage')"
    >
      <Pencil aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.card-reward-row { display: flex; padding: var(--space-4) var(--space-5); align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-positive-soft) 28%, var(--color-surface)); }
.card-reward-row__icon { display: grid; width: 2.25rem; height: 2.25rem; flex-shrink: 0; place-items: center; border-radius: var(--radius-sm); background: var(--color-positive); color: white; }
.card-reward-row__icon svg, .card-reward-row__manage svg { width: 1rem; height: 1rem; }
.card-reward-row__main { min-width: 0; flex: 1; }
.card-reward-row__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.card-reward-row__title strong { color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.card-reward-row__title span { padding: .15rem .45rem; border-radius: var(--radius-round); background: var(--color-positive-soft); color: var(--color-positive-ink); font-size: var(--text-2xs); font-weight: var(--weight-semibold); }
.card-reward-row__main p, .card-reward-row__main small { display: block; margin-top: .15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.card-reward-row__amount { color: var(--color-positive-ink); font-size: var(--text-md); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums; white-space: nowrap; }
.card-reward-row__manage { display: grid; width: 1.75rem; height: 1.75rem; padding: 0; place-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink-secondary); cursor: pointer; }
.card-reward-row__manage:hover { border-color: var(--color-positive); color: var(--color-positive-ink); }
@media (max-width: 768px) { .card-reward-row { flex-wrap: wrap; } .card-reward-row__amount { width: 100%; padding-left: calc(2.25rem + var(--space-3)); order: 3; } .card-reward-row__manage { margin-left: auto; } }
</style>
