<script setup lang="ts">
import { CreditCard, Plus } from '@lucide/vue'
import type { Card } from '~/types/card'
import type { CardsProjectionSummary } from '~/types/cardInvoice'
import { roundMoney } from '~/utils/dateMoney'

const {
  data: cards,
  pending,
  refresh,
} = await useFetch<Card[]>('/api/cards', { default: () => [] })

const {
  data: projection,
  pending: projectionPending,
  refresh: refreshProjection,
} = await useFetch<CardsProjectionSummary>('/api/cards/projection', {
  default: () => null,
})

const drawerOpen = ref(false)
const editingCard = ref<Card | null>(null)

const totalLimit = computed(() =>
  roundMoney(cards.value.reduce((sum, card) => sum + card.creditLimit, 0)),
)

const totalUsed = computed(() =>
  roundMoney(cards.value.reduce((sum, card) => sum + card.usedAmount, 0)),
)

const totalAvailable = computed(() =>
  roundMoney(Math.max(0, totalLimit.value - totalUsed.value)),
)

const usedPercent = computed(() => {
  if (totalLimit.value <= 0) return 0
  return Math.min(100, Math.round((totalUsed.value / totalLimit.value) * 100))
})

const estimatedPayoffLabel = computed(
  () => projection.value?.estimatedPayoffLabel ?? null,
)

const residualInvoicesFrom = computed(
  () => projection.value?.residualInvoicesFrom ?? null,
)

function openDrawer(card: Card | null) {
  editingCard.value = card
  drawerOpen.value = true
}

watch(drawerOpen, (value) => {
  if (!value) editingCard.value = null
})

async function refreshAll() {
  await Promise.all([refresh(), refreshProjection()])
}

async function removeCard(card: Card) {
  if (!window.confirm(`Excluir o cartão "${card.name}"?`)) return
  await $fetch(`/api/cards/${card.id}`, { method: 'DELETE' })
  await refreshAll()
}
</script>

<template>
  <div class="cards-page">
    <PageHeading
      eyebrow="Financeiro / Cartões"
      title="Meus cartões"
      description="Gerencie seus cartões de crédito."
    >
      <template #actions>
        <UiButton @click="openDrawer(null)">
          <template #leading><Plus /></template>
          Novo cartão
        </UiButton>
      </template>
    </PageHeading>

    <section
      v-if="cards.length || pending"
      class="cards-summary"
      aria-label="Resumo dos cartões"
    >
      <div class="cards-summary__stats">
        <div>
          <p>Limite total</p>
          <strong><UiMoney :value="totalLimit" /></strong>
        </div>
        <div>
          <p>Utilizado</p>
          <strong><UiMoney :value="totalUsed" /></strong>
        </div>
        <div>
          <p>Disponível</p>
          <strong class="cards-summary__available">
            <UiMoney :value="totalAvailable" />
          </strong>
        </div>
        <p class="cards-summary__percent">{{ usedPercent }}% utilizado</p>
      </div>
      <div class="cards-summary__bar" aria-hidden="true">
        <span :style="{ width: `${usedPercent}%` }" />
      </div>
      <p class="cards-summary__note">
        Utilização = faturas do mês corrente em diante (parcelas futuras
        incluídas).
      </p>
    </section>

    <div v-if="cards.length" class="cards-insights">
      <UiCard>
        <p class="cards-insights__label">Quitação estimada</p>
        <p class="cards-insights__value">
          {{ estimatedPayoffLabel ?? 'Sem previsão' }}
        </p>
        <p class="cards-insights__hint">Mês da última fatura</p>
      </UiCard>
      <UiCard>
        <p class="cards-insights__label">Faturas residuais a partir de</p>
        <p class="cards-insights__value">
          {{ residualInvoicesFrom ?? '—' }}
        </p>
        <p class="cards-insights__hint">≤ 15% da média ou &lt; R$ 150</p>
      </UiCard>
    </div>

    <div v-if="pending" class="cards-grid" aria-hidden="true">
      <UiSkeleton v-for="index in 3" :key="index" height="16rem" radius="md" />
    </div>

    <div v-else-if="cards.length" class="cards-grid">
      <CardsCreditCardTile
        v-for="card in cards"
        :key="card.id"
        :card="card"
        @edit="openDrawer(card)"
        @remove="removeCard(card)"
      />
    </div>

    <UiCard
      v-if="cards.length || projectionPending"
      class="cards-projection"
      padding="md"
    >
      <UiSkeleton
        v-if="projectionPending && !projection"
        height="16rem"
        radius="md"
      />
      <CardsInvoiceProjectionChart
        v-else-if="projection"
        title="Projeção consolidada de faturas"
        subtitle="Próximos 12 meses • todos os cartões • barras claras = residuais"
        :items="projection.months"
        :total="projection.total"
      />
    </UiCard>

    <UiCard v-else-if="!pending" padding="none" class="cards-empty">
      <UiEmptyState
        title="Nenhum cartão cadastrado"
        description="Cadastre o primeiro cartão para acompanhar limites e datas de fatura."
      >
        <template #icon><CreditCard /></template>
        <template #action>
          <UiButton @click="openDrawer(null)">
            <template #leading><Plus /></template>
            Novo cartão
          </UiButton>
        </template>
      </UiEmptyState>
    </UiCard>

    <CardsCardFormDrawer
      v-model:open="drawerOpen"
      :card="editingCard"
      @saved="refreshAll"
    />
  </div>
</template>

<style scoped>
.cards-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.cards-summary {
  padding: var(--space-5) var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.cards-summary__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: var(--space-4);
  align-items: end;
}

.cards-summary__stats p {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.cards-summary__stats strong {
  display: block;
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.cards-summary__available {
  color: var(--color-positive-ink) !important;
}

.cards-summary__percent {
  text-align: right;
  font-weight: var(--weight-medium);
}

.cards-summary__bar {
  overflow: hidden;
  height: 0.4rem;
  margin-top: var(--space-4);
  border-radius: var(--radius-round);
  background: var(--color-border);
}

.cards-summary__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-positive);
}

.cards-summary__note {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.cards-insights {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.cards-insights__label {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.cards-insights__value {
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
}

.cards-insights__hint {
  margin-top: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.cards-empty {
  min-height: 18rem;
}

@media (max-width: 960px) {
  .cards-summary__stats,
  .cards-insights,
  .cards-grid {
    grid-template-columns: 1fr;
  }

  .cards-summary__percent {
    text-align: left;
  }
}

@media (max-width: 560px) {
  .cards-summary__stats {
    gap: var(--space-3);
  }
}
</style>
