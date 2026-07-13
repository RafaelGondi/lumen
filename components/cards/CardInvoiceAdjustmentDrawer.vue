<script setup lang="ts">
import type { Card } from '~/types/card'
import type { CardInvoiceDetail } from '~/types/cardInvoice'
import { roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
  invoice: CardInvoiceDetail
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const amountText = ref('0,00')
const errorMessage = ref('')
const saving = ref(false)
const removing = ref(false)

const amountValue = computed(() => parseSignedMoney(amountText.value))
const previewTotal = computed(() => {
  const adjustment = amountValue.value ?? 0
  return roundMoney(props.invoice.entriesSubtotal + adjustment)
})
const hasExisting = computed(() => props.invoice.adjustment !== 0)

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatSignedMoney(value: number) {
  if (value === 0) return formatMoney(0)
  const sign = value > 0 ? '+' : '−'
  return `${sign}${formatMoney(Math.abs(value))}`
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

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskSignedBrl(input.value)
  amountText.value = masked
  input.value = masked
}

function handleAmountKeydown(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  if (event.key === '-') {
    event.preventDefault()
    const withoutSign = amountText.value.replace('-', '')
    const next =
      amountText.value.startsWith('-') || withoutSign === '0,00'
        ? withoutSign
        : `-${withoutSign}`
    amountText.value = next === '-' ? '-0,00' : maskSignedBrl(next)
    input.value = amountText.value
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    const negative = amountText.value.startsWith('-')
    const digits = amountText.value.replace(/\D/g, '').slice(0, -1)
    const next = maskSignedBrl(`${negative ? '-' : ''}${digits}`)
    amountText.value = next
    input.value = next
  }
}

function resetForm() {
  errorMessage.value = ''
  const current = props.invoice.adjustment
  amountText.value =
    current === 0
      ? '0,00'
      : maskSignedBrl(
          `${current < 0 ? '-' : ''}${String(Math.round(Math.abs(current) * 100))}`,
        )
}

watch(open, (value) => {
  if (value) resetForm()
})

async function save() {
  const amount = amountValue.value
  if (amount === null) {
    errorMessage.value = 'Informe um valor de ajuste válido.'
    return
  }
  if (Math.abs(amount) > 10_000) {
    errorMessage.value = 'O ajuste deve ficar entre -R$ 10.000 e R$ 10.000.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/cards/${props.card.id}/invoice/adjustment`, {
      method: 'PUT',
      body: {
        month: props.invoice.month,
        amount,
        notes: null,
      },
    })
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível aplicar o ajuste.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!hasExisting.value) return
  if (!window.confirm('Remover o ajuste desta fatura?')) return

  removing.value = true
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/cards/${props.card.id}/invoice/adjustment?month=${props.invoice.month}`,
      { method: 'DELETE' },
    )
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível remover o ajuste.'
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Ajuste de arredondamento">
    <form class="invoice-adjustment" @submit.prevent="save">
      <p class="invoice-adjustment__lead">
        Use para corrigir pequenas discrepâncias entre o valor calculado e o
        cobrado pela operadora. Valores negativos aparecem como crédito na
        fatura.
      </p>

      <dl class="invoice-adjustment__summary">
        <div>
          <dt>Calculado</dt>
          <dd>{{ formatMoney(invoice.entriesSubtotal) }}</dd>
        </div>
        <div>
          <dt>Ajuste</dt>
          <dd
            :class="{
              'is-credit': (amountValue ?? 0) < 0,
              'is-debit': (amountValue ?? 0) > 0,
            }"
          >
            {{ formatSignedMoney(amountValue ?? 0) }}
          </dd>
        </div>
        <div class="invoice-adjustment__total">
          <dt>Total da fatura</dt>
          <dd>{{ formatMoney(previewTotal) }}</dd>
        </div>
      </dl>

      <p class="invoice-adjustment__hint">
        Negativo = crédito (reduz a fatura) · Positivo = débito adicional
      </p>

      <div class="invoice-adjustment__section">
        <p class="invoice-adjustment__label">Valor do ajuste</p>
        <div class="invoice-adjustment__money">
          <span>R$</span>
          <input
            :value="amountText"
            type="text"
            inputmode="decimal"
            aria-label="Valor do ajuste"
            @focus="($event.target as HTMLInputElement).select()"
            @keydown="handleAmountKeydown"
            @input="handleAmountInput"
          />
        </div>
      </div>

      <p v-if="errorMessage" class="invoice-adjustment__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton
        v-if="hasExisting"
        variant="ghost"
        class="invoice-adjustment__remove"
        :disabled="saving || removing"
        @click="remove"
      >
        Remover
      </UiButton>
      <span v-else class="invoice-adjustment__spacer" />
      <UiButton
        variant="ghost"
        :disabled="saving || removing"
        @click="open = false"
      >
        Cancelar
      </UiButton>
      <UiButton :disabled="saving || removing" @click="save">
        Aplicar
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.invoice-adjustment {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.invoice-adjustment__lead {
  color: var(--color-ink-secondary);
  font-size: var(--text-sm);
  line-height: 1.45;
}

.invoice-adjustment__summary {
  display: flex;
  margin: 0;
  padding: var(--space-4);
  flex-direction: column;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.invoice-adjustment__summary > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.invoice-adjustment__summary dt {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}

.invoice-adjustment__summary dd {
  margin: 0;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.invoice-adjustment__summary dd.is-credit {
  color: var(--color-positive-ink);
}

.invoice-adjustment__summary dd.is-debit {
  color: var(--color-negative-ink);
}

.invoice-adjustment__total {
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.invoice-adjustment__total dt,
.invoice-adjustment__total dd {
  color: var(--color-ink);
  font-weight: var(--weight-semibold);
}

.invoice-adjustment__total dd {
  font-size: var(--text-md);
}

.invoice-adjustment__hint {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  line-height: 1.4;
}

.invoice-adjustment__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.invoice-adjustment__label {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.invoice-adjustment__money {
  display: flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.invoice-adjustment__money:focus-within {
  outline: 2px solid var(--color-brand);
  outline-offset: 1px;
}

.invoice-adjustment__money span {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}

.invoice-adjustment__money input {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
}

.invoice-adjustment__money input:focus {
  outline: none;
}

.invoice-adjustment__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.invoice-adjustment__remove {
  color: var(--color-negative) !important;
  margin-right: auto;
}

.invoice-adjustment__spacer {
  margin-right: auto;
}
</style>
