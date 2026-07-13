<script setup lang="ts">
import { Check, CreditCard } from '@lucide/vue'
import type { BankKey } from '~/types/account'
import type { Card, CardPayload } from '~/types/card'
import { bankByKey, bankCatalog, resolveBankColor } from '~/utils/bankCatalog'
import { cardColorOptions, resolveCardColor } from '~/utils/cardColors'
import { roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const bankKey = ref<BankKey>('itau')
const customBankName = ref('')
const colorKey = ref('bank')
const name = ref('')
const lastFour = ref('')
const limitText = ref('0,00')
const closingDay = ref(1)
const dueDay = ref(1)
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.card !== null)

const selectedBankName = computed(() => {
  if (bankKey.value === 'custom') return customBankName.value.trim()
  return bankByKey(bankKey.value)?.name ?? ''
})

const bankColor = computed(() =>
  resolveBankColor(bankKey.value, selectedBankName.value || 'Banco'),
)

const previewColor = computed(() =>
  resolveCardColor(
    colorKey.value === 'bank'
      ? ''
      : (cardColorOptions.find((item) => item.key === colorKey.value)?.value ??
          colorKey.value),
    bankColor.value,
  ),
)

const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)

function maskBrl(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d{3})/, '').slice(0, 17)
  const padded = (digits || '0').padStart(3, '0')
  const integer = padded
    .slice(0, -2)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integer},${padded.slice(-2)}`
}

function amountDigits(value: string) {
  return value.replace(/\D/g, '').replace(/^0+/, '')
}

function setMaskedLimit(input: HTMLInputElement, digits: string) {
  const masked = maskBrl(digits)
  limitText.value = masked
  input.value = masked
  input.setSelectionRange(masked.length, masked.length)
}

function handleLimitKeydown(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  const isAllSelected =
    input.selectionStart === 0 && input.selectionEnd === input.value.length

  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    const current = isAllSelected ? '' : amountDigits(limitText.value)
    if (current.length >= 17) return
    setMaskedLimit(input, `${current}${event.key}`)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    const current = isAllSelected ? '' : amountDigits(limitText.value)
    setMaskedLimit(input, current.slice(0, -1))
  }
}

function handleLimitInput(event: Event) {
  const input = event.target as HTMLInputElement
  setMaskedLimit(input, input.value)
}

function parseLimit(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!normalized) return 0
  const amount = Number(normalized)
  return Number.isFinite(amount) ? roundMoney(amount) : null
}

function colorKeyFromValue(color: string, bank: string) {
  if (!color || color === bank) return 'bank'
  const match = cardColorOptions.find((option) => option.value === color)
  return match?.key ?? 'bank'
}

watch(open, (value) => {
  if (!value) return
  errorMessage.value = ''
  const current = props.card
  bankKey.value = current?.bankKey ?? 'itau'
  customBankName.value =
    current?.bankKey === 'custom' ? (current.bankName ?? '') : ''
  name.value = current?.name ?? ''
  lastFour.value = current?.lastFour ?? ''
  limitText.value = maskBrl(
    String(Math.round((current?.creditLimit ?? 0) * 100)),
  )
  closingDay.value = current?.closingDay ?? 1
  dueDay.value = current?.dueDay ?? 1
  colorKey.value = current
    ? colorKeyFromValue(
        current.color,
        resolveBankColor(current.bankKey, current.bankName),
      )
    : 'bank'
})

function selectBank(key: BankKey) {
  bankKey.value = key
}

async function save() {
  const bankName = selectedBankName.value
  if (!bankName) {
    errorMessage.value = 'Selecione ou informe o banco / emissor.'
    return
  }
  if (!name.value.trim()) {
    errorMessage.value = 'Informe o nome do cartão.'
    return
  }

  const creditLimit = parseLimit(limitText.value)
  if (creditLimit === null || creditLimit < 0) {
    errorMessage.value = 'Informe um limite válido.'
    return
  }

  const digits = lastFour.value.replace(/\D/g, '')
  if (lastFour.value.trim() && digits.length !== 4) {
    errorMessage.value = 'Informe exatamente 4 dígitos finais.'
    return
  }

  const payload: CardPayload = {
    name: name.value.trim(),
    bankKey: bankKey.value,
    bankName,
    color: previewColor.value,
    lastFour: digits || null,
    creditLimit,
    closingDay: closingDay.value,
    dueDay: dueDay.value,
    active: true,
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value) {
      await $fetch(`/api/cards/${props.card!.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/cards', { method: 'POST', body: payload })
    }
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível salvar. Tente novamente.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer
    v-model:open="open"
    :title="isEditing ? 'Editar cartão' : 'Novo cartão'"
  >
    <form class="card-form" @submit.prevent="save">
      <div class="card-form__section">
        <p class="card-form__label">
          Banco / emissor <span aria-hidden="true">*</span>
        </p>
        <div class="card-form__banks" role="radiogroup" aria-label="Banco">
          <button
            v-for="bank in bankCatalog"
            :key="bank.key"
            type="button"
            role="radio"
            class="card-form__bank"
            :class="{ 'card-form__bank--active': bankKey === bank.key }"
            :aria-checked="bankKey === bank.key"
            :title="bank.name"
            @click="selectBank(bank.key)"
          >
            <AccountsBankMark
              :name="bank.name"
              :color="bank.color"
              :bank-key="bank.key"
            />
          </button>
        </div>
        <div class="card-form__custom">
          <button
            type="button"
            class="card-form__custom-toggle"
            :class="{
              'card-form__custom-toggle--active': bankKey === 'custom',
            }"
            @click="selectBank('custom')"
          >
            Outro banco
          </button>
          <UiTextField
            v-if="bankKey === 'custom'"
            v-model="customBankName"
            placeholder="Nome do banco / emissor..."
          />
        </div>
      </div>

      <div class="card-form__section">
        <p class="card-form__label">Cor do cartão</p>
        <div class="card-form__colors" role="radiogroup" aria-label="Cor">
          <button
            v-for="option in cardColorOptions"
            :key="option.key"
            type="button"
            role="radio"
            class="card-form__color"
            :class="{ 'card-form__color--active': colorKey === option.key }"
            :aria-checked="colorKey === option.key"
            :title="option.label"
            :style="{
              background:
                option.key === 'bank' ? bankColor : option.value,
            }"
            @click="colorKey = option.key"
          >
            <Check v-if="colorKey === option.key" aria-hidden="true" />
          </button>
        </div>
        <div class="card-form__color-labels">
          <span
            v-for="option in cardColorOptions"
            :key="`${option.key}-label`"
          >
            {{ option.label }}
          </span>
        </div>
      </div>

      <div
        class="card-form__preview"
        :style="{
          background: `linear-gradient(135deg, ${previewColor} 0%, ${previewColor}cc 100%)`,
        }"
      >
        <div class="card-form__preview-top">
          <div>
            <p>{{ selectedBankName || 'Banco' }}</p>
            <strong>{{ name.trim() || 'Nome do cartão' }}</strong>
          </div>
          <AccountsBankMark
            :name="selectedBankName || 'Banco'"
            :color="bankColor"
            :bank-key="bankKey"
          />
        </div>
        <div class="card-form__preview-bottom">
          <span v-if="lastFour.replace(/\D/g, '').length === 4">
            •••• {{ lastFour.replace(/\D/g, '') }}
          </span>
          <span v-else class="card-form__preview-muted">
            <CreditCard aria-hidden="true" />
            Cartão
          </span>
        </div>
      </div>

      <UiTextField
        v-model="name"
        label="Nome do cartão"
        placeholder="Ex: Uniclass, Visa Infinity, Platinum..."
        required
      />

      <div class="card-form__row">
        <div class="card-form__section">
          <p class="card-form__label">Últimos 4 dígitos</p>
          <input
            v-model="lastFour"
            class="card-form__select"
            type="text"
            inputmode="numeric"
            maxlength="4"
            placeholder="Ex: 1234"
            aria-label="Últimos 4 dígitos"
            @input="lastFour = lastFour.replace(/\D/g, '').slice(0, 4)"
          />
        </div>
        <div class="card-form__section">
          <p class="card-form__label">
            Limite <span aria-hidden="true">*</span>
          </p>
          <div class="card-form__money">
            <span aria-hidden="true">R$</span>
            <input
              :value="limitText"
              type="text"
              inputmode="numeric"
              aria-label="Limite"
              autocomplete="off"
              @keydown="handleLimitKeydown"
              @input="handleLimitInput"
            />
          </div>
        </div>
      </div>

      <div class="card-form__row">
        <div class="card-form__section">
          <p class="card-form__label">
            Fechamento <span aria-hidden="true">*</span>
          </p>
          <select v-model.number="closingDay" class="card-form__select" aria-label="Dia de fechamento">
            <option v-for="day in dayOptions" :key="`close-${day}`" :value="day">
              Dia {{ day }}
            </option>
          </select>
          <p class="card-form__hint">
            Dia de fechamento da fatura (não início de ciclo).
          </p>
        </div>
        <div class="card-form__section">
          <p class="card-form__label">
            Vencimento <span aria-hidden="true">*</span>
          </p>
          <select v-model.number="dueDay" class="card-form__select" aria-label="Dia de vencimento">
            <option v-for="day in dayOptions" :key="`due-${day}`" :value="day">
              Dia {{ day }}
            </option>
          </select>
          <p class="card-form__hint">Dia de vencimento do boleto.</p>
        </div>
      </div>

      <p v-if="errorMessage" class="card-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ isEditing ? 'Salvar alterações' : 'Adicionar cartão' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.card-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.card-form__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.card-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.card-form__label span {
  color: var(--color-negative);
}

.card-form__banks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.card-form__bank {
  display: grid;
  min-height: 3.25rem;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
}

.card-form__bank--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  box-shadow: 0 0 0 2px var(--color-brand-soft);
}

.card-form__custom {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.card-form__custom-toggle {
  align-self: flex-start;
  min-height: 2rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-round);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.card-form__custom-toggle--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-weight: var(--weight-semibold);
}

.card-form__colors {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: var(--space-2);
}

.card-form__color {
  display: grid;
  width: 100%;
  aspect-ratio: 1;
  place-items: center;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
}

.card-form__color--active {
  border-color: var(--color-ink);
}

.card-form__color svg {
  width: 0.85rem;
  height: 0.85rem;
}

.card-form__color-labels {
  display: none;
}

.card-form__preview {
  display: flex;
  min-height: 7.5rem;
  padding: var(--space-5);
  flex-direction: column;
  justify-content: space-between;
  border-radius: var(--radius-lg);
  color: white;
  box-shadow: var(--shadow-sm);
}

.card-form__preview-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card-form__preview-top p {
  font-size: var(--text-xs);
  opacity: 0.85;
}

.card-form__preview-top strong {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.card-form__preview-bottom {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.card-form__preview-muted {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  opacity: 0.8;
}

.card-form__preview-muted svg {
  width: 1rem;
  height: 1rem;
}

.card-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.card-form__money,
.card-form__select {
  min-height: 2.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.card-form__money {
  display: flex;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
}

.card-form__money:focus-within,
.card-form__select:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.card-form__money span {
  color: var(--color-ink-muted);
  font-weight: var(--weight-medium);
}

.card-form__money input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  font-variant-numeric: tabular-nums;
}

.card-form__money input:focus {
  outline: none;
}

.card-form__select {
  width: 100%;
  padding: 0 var(--space-3);
}

.card-form__hint {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.card-form__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
