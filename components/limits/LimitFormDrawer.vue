<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import type { LimitRow, LimitScope } from '~/types/limits'

const props = defineProps<{
  row: LimitRow | null
  scope: LimitScope
  month: string
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  saved: []
}>()

const {
  amountText,
  amountValue,
  handleAmountKeydown,
  handleAmountInput,
  setFromAmount,
} = useMoneyField()

const recurring = ref(false)
const saving = ref(false)
const removing = ref(false)
const errorMessage = ref('')

watch(
  () => [open.value, props.row] as const,
  ([isOpen, row]) => {
    if (!isOpen) return
    setFromAmount(row?.limitAmount)
    recurring.value = row?.recurring ?? false
    errorMessage.value = ''
  },
)

const title = computed(() => {
  if (!props.row) return 'Definir limite'
  return props.row.limitAmount
    ? `Editar limite · ${props.row.label}`
    : `Limite · ${props.row.label}`
})

const canRemove = computed(
  () => props.row?.limitId !== null && props.row?.limitId !== undefined,
)

async function save() {
  if (!props.row) return
  const parsed = amountValue.value
  if (parsed === null || parsed <= 0) return

  saving.value = true
  errorMessage.value = ''
  try {
    if (props.row.limitId) {
      await $fetch(`/api/limits/${props.row.limitId}`, {
        method: 'PUT',
        body: { amount: parsed, recurring: recurring.value },
      })
    } else {
      await $fetch('/api/limits', {
        method: 'POST',
        body: {
          scope: props.scope,
          referenceId: props.row.referenceId,
          month: props.month,
          amount: parsed,
          recurring: recurring.value,
        },
      })
    }
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value = extractFetchError(error)
  } finally {
    saving.value = false
  }
}

function extractFetchError(error: unknown) {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const message = (error as { statusMessage?: string }).statusMessage
    if (message) return message
  }
  return 'Não foi possível salvar o limite.'
}

async function remove() {
  if (!props.row?.limitId) return
  if (!window.confirm(`Remover o limite de "${props.row.label}"?`)) return

  removing.value = true
  try {
    await $fetch(`/api/limits/${props.row.limitId}`, { method: 'DELETE' })
    open.value = false
    emit('saved')
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="title">
    <form class="limit-form" @submit.prevent="save">
      <div v-if="row" class="limit-form__context">
        <CategoriesCategoryIconChip
          :icon="row.icon"
          :color="row.color"
          size="sm"
        />
        <div>
          <strong>{{ row.label }}</strong>
          <p>
            Gasto em {{ month.slice(5, 7) }}/{{ month.slice(0, 4) }}:
            <UiMoney :value="row.spent" />
          </p>
        </div>
      </div>

      <label class="limit-form__money">
        <span>Limite mensal</span>
        <div class="limit-form__money-field">
          <span>R$</span>
          <input
            :value="amountText"
            inputmode="numeric"
            aria-label="Limite mensal"
            required
            @focus="($event.target as HTMLInputElement).select()"
            @keydown="handleAmountKeydown"
            @input="handleAmountInput"
          />
        </div>
      </label>

      <label class="limit-form__check">
        <input v-model="recurring" type="checkbox" />
        <span>Repetir todo mês a partir deste mês</span>
      </label>

      <p v-if="errorMessage" class="limit-form__error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="limit-form__actions">
        <UiButton type="submit" :disabled="saving">
          {{ saving ? 'Salvando…' : 'Salvar' }}
        </UiButton>
        <UiButton
          v-if="canRemove"
          variant="ghost"
          type="button"
          :disabled="removing"
          @click="remove"
        >
          <template #leading>
            <Trash2 aria-hidden="true" />
          </template>
          Remover
        </UiButton>
      </div>
    </form>
  </UiDrawer>
</template>

<style scoped>
.limit-form {
  display: grid;
  gap: var(--space-5);
}

.limit-form__context {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.limit-form__context strong {
  display: block;
  font-size: var(--text-sm);
}

.limit-form__context p {
  margin-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-form__money {
  display: grid;
  gap: var(--space-2);
}

.limit-form__money > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.limit-form__money-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.limit-form__money-field > span {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.limit-form__money-field input {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  outline: none;
}

.limit-form__check {
  display: flex !important;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
}

.limit-form__error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
  font-size: var(--text-xs);
}

.limit-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
