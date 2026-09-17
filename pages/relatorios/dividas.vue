<script setup lang="ts">
import { Info, Landmark, Plus, TrendingDown } from '@lucide/vue'
import type { DebtEvolutionReport, DebtSourceOption } from '~/types/debtEvolution'
import type { ManualDebt } from '~/types/manualDebt'

const {
  data: report,
  pending,
  error,
  refresh,
} = await useFetch<DebtEvolutionReport>('/api/reports/debt-evolution', {
  default: () => null,
})

const selectedIds = ref<number[]>([])
const selectedCardIds = ref<number[]>([])
const selectedManualDebtIds = ref<number[]>([])
const debtDrawerOpen = ref(false)
const paymentDrawerOpen = ref(false)
const paymentDebt = ref<ManualDebt | null>(null)
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

watch(report, (value) => {
  selectedIds.value = value?.sources
    .filter((source) => source.enabled)
    .map((source) => source.entryId) ?? []
  selectedCardIds.value = value?.cards
    .filter((card) => card.enabled)
    .map((card) => card.cardId) ?? []
  selectedManualDebtIds.value = value?.manualDebts
    .filter((debt) => debt.enabled)
    .map((debt) => debt.id) ?? []
}, { immediate: true })

const sourceGroups = computed(() => ({
  suggested: report.value?.sources.filter((source) => source.suggested) ?? [],
  optional: report.value?.sources.filter((source) => !source.suggested) ?? [],
}))
const allCardsSelected = computed(() =>
  Boolean(report.value?.cards.length) &&
  report.value!.cards.every((card) => selectedCardIds.value.includes(card.cardId)),
)
const allSourcesSelected = computed(() =>
  Boolean(report.value?.sources.length) &&
  report.value!.sources.every((source) => selectedIds.value.includes(source.entryId)),
)
const allManualDebtsSelected = computed(() =>
  Boolean(report.value?.manualDebts.length) &&
  report.value!.manualDebts.every((debt) => selectedManualDebtIds.value.includes(debt.id)),
)
const everythingSelected = computed(() =>
  allCardsSelected.value &&
  (report.value?.sources.length ? allSourcesSelected.value : true) &&
  (report.value?.manualDebts.length ? allManualDebtsSelected.value : true),
)

function toggleSource(entryId: number) {
  selectedIds.value = selectedIds.value.includes(entryId)
    ? selectedIds.value.filter((id) => id !== entryId)
    : [...selectedIds.value, entryId]
  saved.value = false
}

function toggleCard(cardId: number) {
  selectedCardIds.value = selectedCardIds.value.includes(cardId)
    ? selectedCardIds.value.filter((id) => id !== cardId)
    : [...selectedCardIds.value, cardId]
  saved.value = false
}

function toggleManualDebt(debtId: number) {
  selectedManualDebtIds.value = selectedManualDebtIds.value.includes(debtId)
    ? selectedManualDebtIds.value.filter((id) => id !== debtId)
    : [...selectedManualDebtIds.value, debtId]
  saved.value = false
}

function toggleAllCards() {
  selectedCardIds.value = allCardsSelected.value
    ? []
    : report.value?.cards.map((card) => card.cardId) ?? []
  saved.value = false
}

function toggleEverything() {
  if (everythingSelected.value) {
    selectedCardIds.value = []
    selectedIds.value = []
    selectedManualDebtIds.value = []
  }
  else {
    selectedCardIds.value = report.value?.cards.map((card) => card.cardId) ?? []
    selectedIds.value = report.value?.sources.map((source) => source.entryId) ?? []
    selectedManualDebtIds.value = report.value?.manualDebts.map((debt) => debt.id) ?? []
  }
  saved.value = false
}

async function saveSources() {
  saving.value = true
  saveError.value = ''
  saved.value = false
  try {
    await $fetch('/api/reports/debt-sources', {
      method: 'POST',
      body: {
        entryIds: selectedIds.value,
        cardIds: selectedCardIds.value,
        manualDebtIds: selectedManualDebtIds.value,
      },
    })
    await refresh()
    saved.value = true
  }
  catch {
    saveError.value = 'Não foi possível salvar as dívidas acompanhadas.'
  }
  finally {
    saving.value = false
  }
}

function openPayment(debt: ManualDebt) {
  paymentDebt.value = debt
  paymentDrawerOpen.value = true
}

async function handleDebtChange() {
  await refresh()
}

function sourceSupport(source: DebtSourceOption) {
  const recurrence = source.recurrence === 'fixed'
    ? 'recorrente'
    : source.recurrence === 'installment'
      ? `${source.installmentCount ?? '—'} parcelas`
      : 'avulsa'
  return [source.categoryName, recurrence].filter(Boolean).join(' · ')
}

function formatMonth(month: string | null) {
  if (!month) return 'Sem data definida'
  if (!/^\d{4}-\d{2}$/.test(month)) return month
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(year!, value! - 1, 1))
    .replace('.', '')
}
</script>

<template>
  <div class="debt-page">
    <PageHeading
      eyebrow="Financeiro / Relatórios"
      title="Evolução das dívidas"
      description="Acompanhe cartões e compromissos parcelados em uma única curva."
    />

    <ReportsReportTabs />

    <UiEmptyState
      v-if="error"
      title="Não foi possível carregar as dívidas"
      description="Tente novamente em instantes."
    />

    <template v-else>
      <section class="debt-kpis" aria-label="Resumo das dívidas">
        <UiCard v-for="index in 4" v-if="pending && !report" :key="index">
          <UiSkeleton width="8rem" height="0.75rem" />
          <UiSkeleton width="9rem" height="1.5rem" class="debt-page__gap" />
          <UiSkeleton width="7rem" height="0.7rem" class="debt-page__gap" />
        </UiCard>

        <template v-else-if="report">
          <UiCard class="debt-kpi debt-kpi--primary">
            <span class="debt-kpi__label">Dívida acompanhada</span>
            <strong class="debt-kpi__value"><UiMoney :value="report.currentTotal" /></strong>
            <small class="debt-kpi__support">saldo conhecido hoje</small>
          </UiCard>
          <UiCard class="debt-kpi debt-kpi--due">
            <span class="debt-kpi__label">A pagar neste mês</span>
            <strong class="debt-kpi__value"><UiMoney :value="report.dueThisMonth" /></strong>
            <small class="debt-kpi__support">parcelas e faturas ainda abertas</small>
          </UiCard>
          <UiCard class="debt-kpi debt-kpi--positive">
            <span class="debt-kpi__label">Redução até o fim do mês</span>
            <strong class="debt-kpi__value"><UiMoney :value="report.reductionThisMonth" /></strong>
            <small class="debt-kpi__support">se os pagamentos ocorrerem como previsto</small>
          </UiCard>
          <UiCard class="debt-kpi debt-kpi--estimate">
            <span class="debt-kpi__label">Quitação estimada</span>
            <strong class="debt-kpi__value debt-kpi__text">{{ report.hasOpenEndedDebt ? 'Sem previsão' : report.estimatedPayoffLabel ?? 'Após o horizonte' }}</strong>
            <small class="debt-kpi__support">considerando apenas compromissos conhecidos</small>
          </UiCard>
        </template>
      </section>

      <div class="debt-notice">
        <Info aria-hidden="true" />
        <p>
          <strong>Leitura gerencial.</strong> Nos cartões selecionados, usamos o saldo aberto das faturas.
          Para empréstimos e financiamentos, o valor representa as parcelas futuras cadastradas,
          não o saldo devedor oficial informado pelo banco.
        </p>
      </div>

      <UiCard class="debt-chart-card" padding="none">
        <header class="debt-section-header">
          <div class="debt-section-header__icon"><TrendingDown aria-hidden="true" /></div>
          <div>
            <h2>Curva de redução</h2>
            <p>Histórico registrado e projeção até o fim dos compromissos conhecidos.</p>
          </div>
        </header>
        <div class="debt-chart-card__body">
          <UiSkeleton v-if="pending && !report" height="20rem" radius="md" />
          <ReportsDebtEvolutionChart
            v-else-if="report"
            :points="report.points"
            :monthly-impacts="report.monthlyImpacts"
            :cash-projection="report.cashProjection"
            :break-even-month="report.breakEvenMonth"
            :break-even-label="report.breakEvenLabel"
          />
        </div>
        <p v-if="report && !report.historyStarted" class="debt-history-note">
          O histórico começa agora. Nos próximos meses, esta linha também mostrará a evolução real registrada.
        </p>
      </UiCard>

      <div v-if="report" class="debt-columns">
        <UiCard padding="none" class="debt-composition">
          <header class="debt-section-header">
            <div class="debt-section-header__icon"><Landmark aria-hidden="true" /></div>
            <div>
              <h2>Composição atual</h2>
              <p>Onde está concentrado o saldo acompanhado.</p>
            </div>
          </header>

          <ul v-if="report.composition.length" class="debt-composition__list">
            <li v-for="item in report.composition" :key="item.id">
              <div class="debt-composition__row">
                <AccountsBankMark
                  v-if="item.type === 'card' && item.bankKey"
                  :name="item.support"
                  :bank-key="item.bankKey"
                  :color="item.color"
                />
                <CategoriesCategoryIconChip
                  v-else-if="item.categoryIcon"
                  :icon="item.categoryIcon"
                  :color="item.color"
                  size="md"
                />
                <span v-else class="debt-composition__type">
                  <Landmark aria-hidden="true" />
                </span>
                <div class="debt-composition__name">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.support }} · {{ item.payoffMonth ? `até ${formatMonth(item.payoffMonth)}` : 'sem previsão' }}</span>
                </div>
                <div class="debt-composition__value">
                  <strong><UiMoney :value="item.balance" /></strong>
                  <span>{{ item.percent.toLocaleString('pt-BR') }}%</span>
                </div>
              </div>
              <div class="debt-composition__bar">
                <span :style="{ width: `${item.percent}%` }" />
              </div>
            </li>
          </ul>
          <UiEmptyState
            v-else
            title="Nenhuma dívida em aberto"
            description="Os compromissos selecionados não possuem saldo futuro."
          />
        </UiCard>

        <UiCard padding="none" class="debt-sources">
          <header class="debt-section-header">
            <div>
              <h2>O que acompanhar</h2>
              <p>Escolha os cartões e demais compromissos que entram no relatório.</p>
            </div>
            <div class="debt-sources__actions">
              <button type="button" class="debt-sources__select-all" @click="toggleEverything">{{ everythingSelected ? 'Limpar tudo' : 'Selecionar tudo' }}</button>
              <UiButton size="sm" @click="debtDrawerOpen = true"><Plus aria-hidden="true" />Adicionar dívida</UiButton>
            </div>
          </header>

          <div v-if="report.cards.length || report.sources.length || report.manualDebts.length" class="debt-sources__options">
            <p v-if="report.manualDebts.length" class="debt-sources__label">Dívidas sem parcelas</p>
            <div v-for="debt in report.manualDebts" :key="`manual:${debt.id}`" class="debt-source debt-source--manual">
              <label>
                <input type="checkbox" :checked="selectedManualDebtIds.includes(debt.id)" @change="toggleManualDebt(debt.id)">
                <CategoriesCategoryIconChip v-if="debt.categoryIcon" :icon="debt.categoryIcon" :color="debt.categoryColor ?? '#647a91'" size="md" />
                <span v-else class="debt-source__fallback"><Landmark aria-hidden="true" /></span>
                <span><strong>{{ debt.name }}</strong><small>{{ debt.creditor || 'Sem credor informado' }} · <UiMoney :value="debt.currentBalance" /></small></span>
              </label>
              <button type="button" class="debt-source__payment" @click="openPayment(debt)">Registrar pagamento</button>
            </div>

            <p v-if="report.cards.length" class="debt-sources__label">Cartões</p>
            <label v-if="report.cards.length" class="debt-source debt-source--all">
              <input
                type="checkbox"
                :checked="allCardsSelected"
                @change="toggleAllCards"
              >
              <span class="debt-source__all-icon" aria-hidden="true">•••</span>
              <span>
                <strong>Todos os cartões</strong>
                <small>{{ report.cards.length }} cartões ativos</small>
              </span>
            </label>
            <label
              v-for="card in report.cards"
              :key="`card:${card.cardId}`"
              class="debt-source"
            >
              <input
                type="checkbox"
                :checked="selectedCardIds.includes(card.cardId)"
                @change="toggleCard(card.cardId)"
              >
              <AccountsBankMark
                :name="card.bankName"
                :bank-key="card.bankKey"
                :color="card.color"
              />
              <span>
                <strong>{{ card.name }}</strong>
                <small>{{ card.bankName }}</small>
              </span>
            </label>

            <p v-if="sourceGroups.suggested.length" class="debt-sources__label">Dívidas acompanhadas</p>
            <label
              v-for="source in sourceGroups.suggested"
              :key="source.entryId"
              class="debt-source"
            >
              <input
                type="checkbox"
                :checked="selectedIds.includes(source.entryId)"
                @change="toggleSource(source.entryId)"
              >
              <CategoriesCategoryIconChip
                v-if="source.categoryIcon"
                :icon="source.categoryIcon"
                :color="source.categoryColor ?? '#647a91'"
                size="md"
              />
              <span v-else class="debt-source__fallback"><Landmark aria-hidden="true" /></span>
              <span>
                <strong>{{ source.description }}</strong>
                <small>{{ sourceSupport(source) }}</small>
              </span>
              <UiMoney :value="source.amount" />
            </label>

            <p v-if="sourceGroups.optional.length" class="debt-sources__label">Outros parcelamentos</p>
            <label
              v-for="source in sourceGroups.optional"
              :key="source.entryId"
              class="debt-source"
            >
              <input
                type="checkbox"
                :checked="selectedIds.includes(source.entryId)"
                @change="toggleSource(source.entryId)"
              >
              <CategoriesCategoryIconChip
                v-if="source.categoryIcon"
                :icon="source.categoryIcon"
                :color="source.categoryColor ?? '#647a91'"
                size="md"
              />
              <span v-else class="debt-source__fallback"><Landmark aria-hidden="true" /></span>
              <span>
                <strong>{{ source.description }}</strong>
                <small>{{ sourceSupport(source) }}</small>
              </span>
              <UiMoney :value="source.amount" />
            </label>
          </div>
          <p v-else class="debt-sources__empty">
            Nenhum compromisso foi marcado como dívida nos lançamentos.
          </p>

          <footer class="debt-sources__footer">
            <span v-if="saveError" class="debt-sources__error">{{ saveError }}</span>
            <span v-else-if="saved" class="debt-sources__saved">Configuração salva.</span>
            <UiButton :disabled="saving" @click="saveSources">
              {{ saving ? 'Salvando…' : 'Salvar seleção' }}
            </UiButton>
          </footer>
        </UiCard>
      </div>
    </template>

    <ReportsManualDebtFormDrawer v-model:open="debtDrawerOpen" @saved="handleDebtChange" />
    <ReportsManualDebtPaymentDrawer v-model:open="paymentDrawerOpen" :debt="paymentDebt" @saved="handleDebtChange" />
  </div>
</template>

<style scoped>
.debt-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.debt-page__gap { margin-top: var(--space-3); }

.debt-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.debt-kpi {
  min-height: 8rem;
}

.debt-kpi :deep(.ak-card__body) {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.debt-kpi__label,
.debt-kpi__support {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.debt-kpi__value {
  display: block;
  color: var(--color-ink);
  font-size: clamp(1.1rem, 1.8vw, var(--text-xl));
  letter-spacing: -0.025em;
}

.debt-kpi--due .debt-kpi__value { color: var(--color-negative); }
.debt-kpi--positive .debt-kpi__value { color: var(--color-positive); }
.debt-kpi .debt-kpi__text { font-size: clamp(1.1rem, 1.8vw, var(--text-xl)); }

.debt-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  line-height: 1.55;
}

.debt-notice svg {
  flex: none;
  width: 1rem;
  height: 1rem;
  margin-top: 0.12rem;
  color: var(--color-brand);
}

.debt-notice strong { color: var(--color-ink); }

.debt-section-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.debt-sources .debt-section-header > div { flex: 1; }
.debt-sources__actions { display: flex; flex: none !important; align-items: center; gap: var(--space-3); }
.debt-sources__actions :deep(.ak-button svg) { width: 0.95rem; height: 0.95rem; }
.debt-sources__select-all {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-brand);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}
.debt-sources__select-all:hover { text-decoration: underline; }

.debt-section-header__icon,
.debt-composition__type {
  display: grid;
  flex: none;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  place-items: center;
}

.debt-section-header svg,
.debt-composition__type svg {
  width: 1rem;
  height: 1rem;
}

.debt-section-header h2 {
  color: var(--color-ink);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.debt-section-header p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.debt-chart-card__body { padding: var(--space-5); }
.debt-history-note {
  padding: 0 var(--space-5) var(--space-4);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.debt-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(22rem, 0.9fr);
  gap: var(--space-4);
  align-items: start;
}

.debt-composition__list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.debt-composition__list li {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.debt-composition__list li:last-child { border-bottom: 0; }
.debt-composition__row { display: flex; align-items: center; gap: var(--space-3); }
.debt-composition__name { min-width: 0; flex: 1; }
.debt-composition__name strong,
.debt-composition__name span { display: block; }
.debt-composition__name strong { color: var(--color-ink); font-size: var(--text-sm); }
.debt-composition__name span { margin-top: 0.15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.debt-composition__value { flex: none; text-align: right; }
.debt-composition__value strong,
.debt-composition__value span { display: block; }
.debt-composition__value strong { color: var(--color-ink); font-size: var(--text-sm); }
.debt-composition__value span { margin-top: 0.15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.debt-composition__bar { height: 0.22rem; margin: var(--space-3) 0 0 2.75rem; overflow: hidden; border-radius: 999px; background: var(--color-surface-subtle); }
.debt-composition__bar span { display: block; height: 100%; border-radius: inherit; background: var(--color-brand); }

.debt-sources__options { overflow: visible; }
.debt-sources__label {
  padding: var(--space-3) var(--space-5) var(--space-2);
  color: var(--color-ink-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.debt-source {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--color-border);
  cursor: pointer;
}

.debt-source:hover { background: var(--color-surface-subtle); }
.debt-source--all { background: var(--color-surface-subtle); }
.debt-source--manual {
  display: flex;
  justify-content: space-between;
  cursor: default;
}
.debt-source--manual > label {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}
.debt-source--manual label > span strong,
.debt-source--manual label > span small { display: block; }
.debt-source--manual label > span strong { color: var(--color-ink); font-size: var(--text-sm); }
.debt-source--manual label > span small { margin-top: .15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.debt-source__payment {
  flex: none;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-brand);
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}
.debt-source__payment:hover { background: var(--color-brand-soft); }
.debt-source input { width: 1rem; height: 1rem; accent-color: var(--color-brand); }
.debt-source > span strong,
.debt-source > span small { display: block; }
.debt-source > span strong { color: var(--color-ink); font-size: var(--text-sm); }
.debt-source > span small { margin-top: 0.15rem; color: var(--color-ink-muted); font-size: var(--text-xs); }
.debt-source > :last-child:not(span) { color: var(--color-ink); font-size: var(--text-xs); }
.debt-source__fallback {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  place-items: center;
}
.debt-source__all-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-sm);
  background: var(--color-brand-soft);
  color: var(--color-brand);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.08em;
  place-items: center;
}
.debt-source__fallback svg { width: 1rem; height: 1rem; }
.debt-sources__empty { padding: var(--space-5); color: var(--color-ink-muted); font-size: var(--text-sm); }
.debt-sources__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 4rem;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--color-border);
}
.debt-sources__error { color: var(--color-negative); font-size: var(--text-xs); }
.debt-sources__saved { color: var(--color-positive); font-size: var(--text-xs); }

@media (max-width: 1050px) {
  .debt-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .debt-columns { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .debt-kpis { grid-template-columns: 1fr; }
  .debt-sources__actions { align-items: flex-end; flex-direction: column; }
  .debt-source--manual { align-items: stretch; flex-direction: column; }
  .debt-source__payment { align-self: flex-start; margin-left: 4.75rem; }
  .debt-section-header,
  .debt-chart-card__body,
  .debt-composition__list li,
  .debt-source { padding-right: var(--space-4); padding-left: var(--space-4); }
  .debt-composition__name span { white-space: normal; }
}
</style>
