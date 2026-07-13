<script setup lang="ts">
import { Calendar } from '@lucide/vue'
import type { Account } from '~/types/account'
import type { Card } from '~/types/card'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import {
  formatDateBr,
  parseDateBr,
  roundMoney,
} from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
  invoice: CardInvoiceDetail
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const accounts = ref<Account[]>([])
const accountId = ref<number | null>(null)
const paymentDateText = ref('')
const adjustmentText = ref('0,00')
const errorMessage = ref('')
const saving = ref(false)

const adjustmentValue = computed(() => parseSignedMoney(adjustmentText.value))
const previewTotal = computed(() =>
  roundMoney(props.invoice.entriesSubtotal + (adjustmentValue.value ?? 0)),
)

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseSignedMoney(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, '').replace(/R\$/i, '')
  if (!trimmed || trimmed === '-' || trimmed === ',') return 0
  const negative = trimmed.startsWith('-')
  const digits = trimmed.replace(/[^\d,]/g, '')
  if (!digits) return null
  const normalized = digits.replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)
  if (!Number.isFinite(amount)) return null
  return roundMoney(negative ? -amount : amount)
}

function maskSignedBrl(raw: string) {
  const negative = raw.includes('-')
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  const padded = (digits || '0').padStart(3, '0')
  const integer = padded
    .slice(0, -2)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const masked = `${integer},${padded.slice(-2)}`
  return negative && masked !== '0,00' ? `-${masked}` : masked
}

function handleAdjustmentInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskSignedBrl(input.value)
  adjustmentText.value = masked
  input.value = masked
}

function handleAdjustmentKeydown(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  if (event.key === '-') {
    event.preventDefault()
    const withoutSign = adjustmentText.value.replace('-', '')
    const next =
      adjustmentText.value.startsWith('-') || withoutSign === '0,00'
        ? withoutSign
        : `-${withoutSign}`
    adjustmentText.value = next === '-' ? '-0,00' : maskSignedBrl(next)
    input.value = adjustmentText.value
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    const negative = adjustmentText.value.startsWith('-')
    const digits = adjustmentText.value.replace(/\D/g, '').slice(0, -1)
    const next = maskSignedBrl(`${negative ? '-' : ''}${digits}`)
    adjustmentText.value = next
    input.value = next
  }
}

async function loadAccounts() {
  try {
    accounts.value = await $fetch<Account[]>('/api/accounts')
  } catch {
    accounts.value = []
  }
}

function resetForm() {
  errorMessage.value = ''
  accountId.value = null
  paymentDateText.value = formatDateBr(todayIso())
  const current = props.invoice.adjustment
  adjustmentText.value =
    current === 0
      ? '0,00'
      : maskSignedBrl(
          `${current < 0 ? '-' : ''}${String(Math.round(Math.abs(current) * 100))}`,
        )
}

watch(open, async (value) => {
  if (!value) return
  resetForm()
  await loadAccounts()
})

function onAccountChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  accountId.value = value ? Number(value) : null
}

async function save() {
  const paymentDate = parseDateBr(paymentDateText.value)
  const adjustment = adjustmentValue.value

  if (!accountId.value) {
    errorMessage.value = 'Selecione a conta debitada.'
    return
  }
  if (!paymentDate) {
    errorMessage.value = 'Informe a data do pagamento.'
    return
  }
  if (adjustment === null) {
    errorMessage.value = 'Informe um ajuste válido.'
    return
  }
  if (previewTotal.value <= 0) {
    errorMessage.value = 'O total da fatura deve ser maior que zero.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/cards/${props.card.id}/invoice/payment`, {
      method: 'POST',
      body: {
        month: props.invoice.month,
        accountId: accountId.value,
        paymentDate,
        adjustment,
        notes: null,
      },
    })
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível pagar a fatura.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Pagar fatura">
    <form class="invoice-pay" @submit.prevent="save">
      <div class="invoice-pay__summary">
        <p class="invoice-pay__label">Fatura de {{ invoice.monthLabel }}</p>
        <p class="invoice-pay__total">{{ formatMoney(previewTotal) }}</p>
        <p
          v-if="(adjustmentValue ?? 0) !== 0"
          class="invoice-pay__breakdown"
        >
          Calculado {{ formatMoney(invoice.entriesSubtotal) }}
          ·
          <span
            :class="{
              'is-credit': (adjustmentValue ?? 0) < 0,
              'is-debit': (adjustmentValue ?? 0) > 0,
            }"
          >
            {{ formatMoney(Math.abs(adjustmentValue ?? 0)) }} de ajuste
          </span>
        </p>
      </div>

      <div class="invoice-pay__section">
        <p class="invoice-pay__field-label">
          Conta debitada <span>*</span>
        </p>
        <select
          class="invoice-pay__select"
          required
          :value="accountId ?? ''"
          @change="onAccountChange"
        >
          <option value="" disabled>Selecione a conta...</option>
          <option
            v-for="account in accounts"
            :key="account.id"
            :value="account.id"
          >
            {{ account.name }}
          </option>
        </select>
      </div>

      <div class="invoice-pay__section">
        <p class="invoice-pay__field-label">
          Data do pagamento <span>*</span>
        </p>
        <div class="invoice-pay__date">
          <input
            v-model="paymentDateText"
            type="text"
            placeholder="dd / mm / aaaa"
            aria-label="Data do pagamento"
          />
          <Calendar aria-hidden="true" />
        </div>
      </div>

      <div class="invoice-pay__section">
        <div class="invoice-pay__field-head">
          <p class="invoice-pay__field-label">Ajuste (opcional)</p>
          <span>
            Use para corrigir diferenças de arredondamento. Pode ser negativo.
          </span>
        </div>
        <div class="invoice-pay__money">
          <span>R$</span>
          <input
            :value="adjustmentText"
            type="text"
            inputmode="decimal"
            aria-label="Valor do ajuste"
            @focus="($event.target as HTMLInputElement).select()"
            @keydown="handleAdjustmentKeydown"
            @input="handleAdjustmentInput"
          />
        </div>
      </div>

      <p v-if="errorMessage" class="invoice-pay__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" :disabled="saving" @click="open = false">
        Cancelar
      </UiButton>
      <UiButton :disabled="saving" @click="save">
        Confirmar pagamento
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.invoice-pay {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.invoice-pay__summary {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.invoice-pay__label {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}

.invoice-pay__total {
  margin-top: var(--space-1);
  color: var(--color-ink);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.invoice-pay__breakdown {
  margin-top: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.invoice-pay__breakdown .is-credit {
  color: var(--color-positive-ink);
  font-weight: var(--weight-semibold);
}

.invoice-pay__breakdown .is-debit {
  color: var(--color-negative-ink);
  font-weight: var(--weight-semibold);
}

.invoice-pay__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.invoice-pay__field-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.invoice-pay__field-head > span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  line-height: 1.35;
}

.invoice-pay__field-label {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.invoice-pay__field-label span {
  color: var(--color-negative);
}

.invoice-pay__select,
.invoice-pay__date,
.invoice-pay__money {
  min-height: 2.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.invoice-pay__select {
  width: 100%;
  padding: 0 var(--space-3);
  box-sizing: border-box;
}

.invoice-pay__date,
.invoice-pay__money {
  display: flex;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
}

.invoice-pay__date:focus-within,
.invoice-pay__money:focus-within,
.invoice-pay__select:focus {
  outline: 2px solid var(--color-brand);
  outline-offset: 1px;
}

.invoice-pay__date input,
.invoice-pay__money input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.invoice-pay__date input:focus,
.invoice-pay__money input:focus {
  outline: none;
}

.invoice-pay__date svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.invoice-pay__money span {
  color: var(--color-ink-muted);
}

.invoice-pay__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
