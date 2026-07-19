<script setup lang="ts">
import { ChevronDown, ChevronUp, Flag, Trash2 } from '@lucide/vue'
import type { GlobalLimitReport } from '~/types/limits'

const props = defineProps<{
  month: string
  report: GlobalLimitReport | null
  pending?: boolean
}>()

const emit = defineEmits<{
  saved: []
}>()

const { formatCurrency } = useCurrency()

const editing = ref(false)
const showHistory = ref(false)
const saving = ref(false)

const kindOptions = [
  { value: 'percentage' as const, label: '% da receita' },
  { value: 'fixed' as const, label: 'Valor fixo' },
]

const form = reactive({
  kind: 'percentage' as 'fixed' | 'percentage',
  value: '25',
  effectiveFrom: props.month,
})

watch(
  () => props.report?.active,
  (active) => {
    if (!active || editing.value) return
    form.kind = active.kind
    form.value = String(active.value)
    form.effectiveFrom = active.effectiveFrom
  },
  { immediate: true },
)

watch(
  () => props.month,
  (month) => {
    if (!editing.value) form.effectiveFrom = month
  },
)

const monthOptions = computed(() => {
  const [year, month] = props.month.split('-').map(Number)
  const options: { value: string; label: string }[] = []
  for (let offset = -6; offset <= 6; offset += 1) {
    const index = year! * 12 + month! - 1 + offset
    const y = Math.floor(index / 12)
    const m = (index % 12) + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    })
    options.push({
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    })
  }
  return options
})

const activeLabel = computed(() => {
  const active = props.report?.active
  if (!active) return null
  if (active.kind === 'fixed') {
    return formatCurrency(active.value)
  }
  return `${active.value}% da receita`
})

const activeHint = computed(() => {
  const active = props.report?.active
  if (!active) return null
  if (active.kind === 'percentage') {
    const spendPct = 100 - active.value
    return `Limite de gastos = ${spendPct}% da receita do mês`
  }
  return 'Teto fixo de gastos mensais'
})

const previewLimit = computed(() => {
  if (form.kind === 'fixed') return null
  const pct = Number(form.value)
  if (!Number.isFinite(pct)) return null
  return `Receitas × ${100 - pct}%`
})

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function startEdit() {
  const active = props.report?.active
  if (active) {
    form.kind = active.kind
    form.value = String(active.value)
    form.effectiveFrom = active.effectiveFrom
  } else {
    form.kind = 'percentage'
    form.value = '25'
    form.effectiveFrom = props.month
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

async function saveGlobal() {
  saving.value = true
  try {
    await $fetch('/api/limits/global', {
      method: 'POST',
      body: {
        kind: form.kind,
        value: Number(form.value),
        effectiveFrom: form.effectiveFrom,
      },
    })
    editing.value = false
    emit('saved')
  } finally {
    saving.value = false
  }
}

async function removeGlobal(id: number) {
  if (!window.confirm('Remover este limite global?')) return
  await $fetch(`/api/limits/global/${id}`, { method: 'DELETE' })
  emit('saved')
}
</script>

<template>
  <UiCard class="global-limit" padding="none">
    <header class="global-limit__header">
      <div class="global-limit__title">
        <span class="global-limit__icon" aria-hidden="true">
          <Flag />
        </span>
        <div>
          <h2>Limite global</h2>
          <p>Teto mensal ou meta de poupança da receita</p>
        </div>
      </div>
      <UiButton
        v-if="!editing"
        variant="ghost"
        size="sm"
        @click="startEdit"
      >
        {{ report?.active ? 'Alterar' : 'Definir' }}
      </UiButton>
    </header>

    <div v-if="pending && !report" class="global-limit__body">
      <UiSkeleton height="4rem" />
    </div>

    <div v-else-if="!editing" class="global-limit__body">
      <template v-if="report?.active">
        <div class="global-limit__active">
          <div>
            <p class="global-limit__label">
              {{ report.active.kind === 'fixed' ? 'Valor fixo mensal' : 'Meta de poupança' }}
            </p>
            <strong>{{ activeLabel }}</strong>
            <p class="global-limit__hint">{{ activeHint }}</p>
            <p class="global-limit__hint">
              Vigente desde {{ formatMonth(report.active.effectiveFrom) }}
            </p>
            <p
              v-if="report.computedLimit !== null"
              class="global-limit__computed"
            >
              Limite em {{ formatMonth(month) }}:
              <UiMoney :value="report.computedLimit" />
            </p>
            <p v-else class="global-limit__computed is-muted">
              Sem receita prevista neste mês para calcular o limite percentual.
            </p>
          </div>
          <button
            type="button"
            class="global-limit__delete"
            aria-label="Remover limite global"
            @click="removeGlobal(report.active.id)"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>

        <button
          v-if="report.history.length > 1"
          type="button"
          class="global-limit__history-toggle"
          @click="showHistory = !showHistory"
        >
          <ChevronUp v-if="showHistory" aria-hidden="true" />
          <ChevronDown v-else aria-hidden="true" />
          {{ showHistory ? 'Ocultar histórico' : 'Ver histórico' }}
        </button>

        <ul v-if="showHistory" class="global-limit__history">
          <li v-for="entry in report.history" :key="entry.id">
            <div>
              <span>{{ formatMonth(entry.effectiveFrom) }}</span>
              <strong>
                {{
                  entry.kind === 'fixed'
                    ? formatCurrency(entry.value)
                    : `${entry.value}% da receita`
                }}
              </strong>
            </div>
            <button
              type="button"
              aria-label="Remover entrada do histórico"
              @click="removeGlobal(entry.id)"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        </ul>
      </template>

      <UiEmptyState
        v-else
        title="Nenhum limite global"
        description="Defina um teto fixo ou uma meta de poupança percentual."
      />
    </div>

    <form v-else class="global-limit__form" @submit.prevent="saveGlobal">
      <UiSegmentedControl v-model="form.kind" :options="kindOptions" />

      <div class="global-limit__fields">
        <label>
          <span>
            {{
              form.kind === 'fixed'
                ? 'Teto de gastos mensais'
                : 'Percentual a poupar'
            }}
          </span>
          <input
            v-model="form.value"
            type="number"
            :step="form.kind === 'fixed' ? '0.01' : '1'"
            :min="form.kind === 'fixed' ? '0.01' : '1'"
            :max="form.kind === 'percentage' ? '99' : undefined"
            required
          />
          <small v-if="previewLimit">Limite de gastos = {{ previewLimit }}</small>
        </label>

        <label>
          <span>Vigente a partir de</span>
          <select v-model="form.effectiveFrom">
            <option
              v-for="option in monthOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="global-limit__actions">
        <UiButton type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </UiButton>
        <UiButton variant="ghost" type="button" @click="cancelEdit">
          Cancelar
        </UiButton>
      </div>
    </form>
  </UiCard>
</template>

<style scoped>
.global-limit__header,
.global-limit__body,
.global-limit__form {
  padding: var(--space-5) var(--space-6);
}

.global-limit__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.global-limit__title {
  display: flex;
  gap: var(--space-3);
}

.global-limit__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
}

.global-limit__icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.global-limit__title h2 {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.global-limit__title p,
.global-limit__label,
.global-limit__hint,
.global-limit__computed,
.global-limit__history-toggle,
.global-limit__history span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.global-limit__active {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.global-limit__active strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.global-limit__hint,
.global-limit__computed {
  margin-top: var(--space-1);
}

.global-limit__computed.is-muted {
  color: var(--color-warning);
}

.global-limit__delete,
.global-limit__history button {
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

.global-limit__delete:hover,
.global-limit__history button:hover {
  color: var(--color-negative);
  background: var(--color-negative-soft);
}

.global-limit__history-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-4);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  cursor: pointer;
}

.global-limit__history {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.global-limit__history li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.global-limit__history strong {
  display: block;
  margin-top: 0.1rem;
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.global-limit__form {
  display: grid;
  gap: var(--space-4);
}

.global-limit__fields {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.global-limit__fields label {
  display: grid;
  gap: var(--space-2);
}

.global-limit__fields span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.global-limit__fields input,
.global-limit__fields select {
  width: 100%;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
}

.global-limit__fields small {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.global-limit__actions {
  display: flex;
  gap: var(--space-2);
}

@media (max-width: 640px) {
  .global-limit__fields {
    grid-template-columns: 1fr;
  }
}
</style>
