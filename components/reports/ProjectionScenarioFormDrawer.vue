<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue'
import type {
  ProjectionScenario,
  ProjectionScenarioChangeType,
  ProjectionScenarioPayload,
} from '~/types/projection'

const props = defineProps<{
  scenario: ProjectionScenario | null
  minimumMonth: string
}>()
const emit = defineEmits<{ saved: [id: number | null] }>()
const open = defineModel<boolean>('open', { required: true })

type DraftItem = {
  key: number
  type: ProjectionScenarioChangeType
  amount: string
  startMonth: string
  day: string
  durationMonths: string
}

const name = ref('')
const items = ref<DraftItem[]>([])
const saving = ref(false)
const errorMessage = ref('')
let nextKey = 1

const typeOptions: { value: ProjectionScenarioChangeType; label: string }[] = [
  { value: 'income', label: 'Aumento de receita' },
  { value: 'expense', label: 'Nova despesa mensal' },
  { value: 'reduction', label: 'Redução de gastos' },
  { value: 'installment', label: 'Compra parcelada' },
]

function emptyItem(): DraftItem {
  return {
    key: nextKey++,
    type: 'income',
    amount: '',
    startMonth: props.minimumMonth,
    day: '1',
    durationMonths: '',
  }
}

watch(open, (value) => {
  if (!value) return
  name.value = props.scenario?.name ?? ''
  items.value = props.scenario?.items.length
    ? props.scenario.items.map((item) => ({
        key: nextKey++,
        type: item.type,
        amount: String(item.amount),
        startMonth: item.startMonth,
        day: String(item.day),
        durationMonths: item.durationMonths ? String(item.durationMonths) : '',
      }))
    : [emptyItem()]
  errorMessage.value = ''
})

function addItem() {
  if (items.value.length < 8) items.value.push(emptyItem())
}

function removeItem(key: number) {
  if (items.value.length === 1) return
  items.value = items.value.filter((item) => item.key !== key)
}

function typeLabel(type: ProjectionScenarioChangeType) {
  return typeOptions.find((option) => option.value === type)?.label ?? 'Mudança'
}

function amountLabel(item: DraftItem) {
  return item.type === 'installment' ? 'Valor total da compra' : 'Valor por mês'
}

function durationLabel(item: DraftItem) {
  return item.type === 'installment' ? 'Quantidade de parcelas' : 'Duração em meses'
}

async function save() {
  if (!name.value.trim()) {
    errorMessage.value = 'Dê um nome para identificar o cenário.'
    return
  }
  const invalid = items.value.some(
    (item) =>
      !Number.isFinite(Number(item.amount)) ||
      Number(item.amount) <= 0 ||
      !item.startMonth ||
      !Number.isInteger(Number(item.day)) ||
      (item.type === 'installment' && !item.durationMonths),
  )
  if (invalid) {
    errorMessage.value = 'Revise os valores, a data e a duração das mudanças.'
    return
  }

  const payload: ProjectionScenarioPayload = {
    name: name.value.trim(),
    items: items.value.map((item) => ({
      type: item.type,
      amount: Number(item.amount),
      startMonth: item.startMonth,
      day: Number(item.day),
      durationMonths: item.durationMonths ? Number(item.durationMonths) : null,
    })),
  }

  saving.value = true
  errorMessage.value = ''
  try {
    let createdId: number | null = props.scenario?.id ?? null
    if (props.scenario) {
      await $fetch(`/api/reports/projection-scenarios/${props.scenario.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      const result = await $fetch<{ id: number }>('/api/reports/projection-scenarios', {
        method: 'POST',
        body: payload,
      })
      createdId = result.id
    }
    open.value = false
    emit('saved', createdId)
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível salvar o cenário.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="scenario ? 'Editar cenário' : 'Novo cenário de projeção'"
  >
    <form class="scenario-form" @submit.prevent="save">
      <div class="scenario-form__intro">
        <strong>Simule sem alterar seus lançamentos</strong>
        <span>As mudanças afetam somente a curva deste cenário e podem ser removidas a qualquer momento.</span>
      </div>

      <UiTextField
        v-model="name"
        label="Nome do cenário"
        placeholder="Ex: Salário novo, Compra do notebook..."
        required
      />

      <section class="scenario-form__changes">
        <header>
          <div>
            <strong>Mudanças simuladas</strong>
            <span>Combine até oito hipóteses no mesmo cenário.</span>
          </div>
          <UiButton
            variant="secondary"
            size="sm"
            type="button"
            :disabled="items.length >= 8"
            @click="addItem"
          >
            <Plus aria-hidden="true" /> Adicionar
          </UiButton>
        </header>

        <article v-for="(item, index) in items" :key="item.key" class="scenario-change">
          <div class="scenario-change__heading">
            <span>{{ index + 1 }}</span>
            <strong>{{ typeLabel(item.type) }}</strong>
            <button
              type="button"
              :disabled="items.length === 1"
              aria-label="Remover mudança"
              @click="removeItem(item.key)"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>

          <label class="scenario-field scenario-field--wide">
            <span>Tipo de mudança</span>
            <select v-model="item.type">
              <option v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="scenario-field">
            <span>{{ amountLabel(item) }}</span>
            <input v-model="item.amount" type="number" min="0.01" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label class="scenario-field">
            <span>Começa em</span>
            <input v-model="item.startMonth" type="month" :min="minimumMonth" />
          </label>

          <label class="scenario-field">
            <span>Dia do mês</span>
            <input v-model="item.day" type="number" min="1" max="28" step="1" />
          </label>

          <label class="scenario-field">
            <span>{{ durationLabel(item) }}</span>
            <input
              v-model="item.durationMonths"
              type="number"
              min="1"
              max="120"
              step="1"
              :placeholder="item.type === 'installment' ? 'Ex: 12' : 'Até o fim da projeção'"
            />
          </label>
        </article>
      </section>

      <p v-if="errorMessage" class="scenario-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ saving ? 'Salvando…' : scenario ? 'Salvar alterações' : 'Criar cenário' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.scenario-form { display: flex; flex-direction: column; gap: var(--space-6); }
.scenario-form__intro { display: flex; padding: var(--space-4); flex-direction: column; gap: var(--space-1); border-radius: var(--radius-md); background: var(--color-brand-soft); color: var(--color-brand-ink); }
.scenario-form__intro strong, .scenario-form__changes header strong { font-size: var(--text-sm); }
.scenario-form__intro span, .scenario-form__changes header span { font-size: var(--text-xs); line-height: 1.45; }
.scenario-form__changes { display: flex; flex-direction: column; gap: var(--space-3); }
.scenario-form__changes > header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.scenario-form__changes > header > div { display: flex; flex-direction: column; gap: var(--space-1); color: var(--color-ink); }
.scenario-form__changes > header span { color: var(--color-ink-muted); }
.scenario-form__changes svg { width: 1rem; height: 1rem; }
.scenario-change { display: grid; padding: var(--space-4); grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.scenario-change__heading { display: flex; grid-column: 1 / -1; align-items: center; gap: var(--space-2); }
.scenario-change__heading > span { display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: var(--radius-round); background: var(--color-brand-soft); color: var(--color-brand-ink); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.scenario-change__heading strong { flex: 1; color: var(--color-ink); font-size: var(--text-sm); }
.scenario-change__heading button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.scenario-change__heading button:hover:not(:disabled) { color: var(--color-negative-ink); }
.scenario-change__heading button:disabled { opacity: .3; cursor: default; }
.scenario-change__heading svg { width: 1rem; height: 1rem; }
.scenario-field { display: flex; min-width: 0; flex-direction: column; gap: var(--space-2); }
.scenario-field--wide { grid-column: 1 / -1; }
.scenario-field > span { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.scenario-field input, .scenario-field select { width: 100%; min-height: 2.5rem; padding: 0 var(--space-3); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; font-size: var(--text-sm); }
.scenario-field input:focus, .scenario-field select:focus { outline: none; border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-soft); }
.scenario-form__error { color: var(--color-negative-ink); font-size: var(--text-xs); font-weight: var(--weight-medium); }
@media (max-width: 520px) {
  .scenario-form__changes > header { align-items: flex-start; flex-direction: column; }
  .scenario-change { grid-template-columns: 1fr; }
  .scenario-field--wide { grid-column: auto; }
}
</style>
