<script setup lang="ts">
import { Undo2 } from '@lucide/vue'
import type { Card } from '~/types/card'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import { formatDateBr, parseDateBr } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
  invoice: CardInvoiceDetail
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const description = ref('')
const creditedAtText = ref('')
const notes = ref('')
const errorMessage = ref('')
const saving = ref(false)
const {
  amountText,
  amountValue,
  handleAmountKeydown,
  handleAmountInput,
  setFromAmount,
} = useMoneyField()

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function resetForm() {
  description.value = ''
  creditedAtText.value = formatDateBr(todayIso())
  notes.value = ''
  errorMessage.value = ''
  setFromAmount(0)
}

watch(open, (value) => {
  if (value) resetForm()
})

async function save() {
  const creditedAt = parseDateBr(creditedAtText.value)
  const amount = amountValue.value
  const cleanDescription = description.value.trim()

  if (cleanDescription.length < 2) {
    errorMessage.value = 'Informe o que foi estornado.'
    return
  }
  if (!amount || amount <= 0) {
    errorMessage.value = 'Informe um valor de estorno maior que zero.'
    return
  }
  if (amount > props.invoice.total) {
    errorMessage.value = 'O estorno não pode superar o valor atual da fatura.'
    return
  }
  if (!creditedAt) {
    errorMessage.value = 'Informe a data do estorno.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/cards/${props.card.id}/invoice/credits`, {
      method: 'POST',
      body: {
        month: props.invoice.month,
        description: cleanDescription,
        creditAmount: amount,
        creditedAt,
        notes: notes.value.trim() || null,
      },
    })
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível registrar o estorno.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Registrar estorno">
    <form class="invoice-credit" @submit.prevent="save">
      <div class="invoice-credit__notice">
        <Undo2 aria-hidden="true" />
        <p>
          Registre uma devolução ou crédito recebido na fatura sem precisar
          vinculá-lo à compra original.
        </p>
      </div>

      <UiTextField
        v-model="description"
        label="Descrição"
        placeholder="Ex.: Estorno de passagem aérea"
        required
      />

      <div class="invoice-credit__field">
        <label for="invoice-credit-amount">Valor do estorno <span>*</span></label>
        <div class="invoice-credit__money">
          <span>R$</span>
          <input
            id="invoice-credit-amount"
            :value="amountText"
            type="text"
            inputmode="decimal"
            aria-label="Valor do estorno"
            @focus="($event.target as HTMLInputElement).select()"
            @keydown="handleAmountKeydown"
            @input="handleAmountInput"
          />
        </div>
        <small>O valor reduz diretamente o total desta fatura.</small>
      </div>

      <UiDateField
        v-model="creditedAtText"
        label="Data do estorno"
        required
      />

      <div class="invoice-credit__field">
        <label for="invoice-credit-notes">Observação</label>
        <textarea
          id="invoice-credit-notes"
          v-model="notes"
          maxlength="300"
          placeholder="Opcional"
        />
      </div>

      <p v-if="errorMessage" class="invoice-credit__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" :disabled="saving" @click="open = false">
        Cancelar
      </UiButton>
      <UiButton :disabled="saving" @click="save">
        Registrar estorno
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.invoice-credit { display: flex; flex-direction: column; gap: var(--space-5); }
.invoice-credit__notice { display: flex; padding: var(--space-4); align-items: flex-start; gap: var(--space-3); border-radius: var(--radius-md); background: var(--color-positive-soft); color: var(--color-positive-ink); }
.invoice-credit__notice svg { width: 1.15rem; height: 1.15rem; flex-shrink: 0; margin-top: .1rem; }
.invoice-credit__notice p { font-size: var(--text-sm); line-height: 1.5; }
.invoice-credit__field { display: flex; flex-direction: column; gap: var(--space-2); }
.invoice-credit__field label { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.invoice-credit__field label span { color: var(--color-negative); }
.invoice-credit__field small { color: var(--color-ink-muted); font-size: var(--text-xs); }
.invoice-credit__money { display: flex; min-height: 2.75rem; align-items: center; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); }
.invoice-credit__money:focus-within { border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-soft); }
.invoice-credit__money span { padding-left: var(--space-3); color: var(--color-ink-muted); font-size: var(--text-sm); }
.invoice-credit__money input { width: 100%; padding: 0 var(--space-3); border: 0; outline: 0; background: transparent; color: var(--color-ink); font-size: var(--text-md); font-weight: var(--weight-semibold); }
.invoice-credit__field textarea { min-height: 6rem; padding: var(--space-3); resize: vertical; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; font-size: var(--text-sm); }
.invoice-credit__field textarea:focus { outline: none; border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-soft); }
.invoice-credit__error { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-negative-soft); color: var(--color-negative); font-size: var(--text-sm); }
</style>
