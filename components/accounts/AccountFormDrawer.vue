<script setup lang="ts">
import type { Account, AccountPayload, BankKey } from '~/types/account'

const props = defineProps<{
  account: Account | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const bankKey = ref<BankKey>('itau')
const customBankName = ref('')
const name = ref('')
const initialBalanceText = ref('0,00')
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.account !== null)

const selectedBankName = computed(() => {
  if (bankKey.value === 'custom') return customBankName.value.trim()
  return bankByKey(bankKey.value)?.name ?? ''
})

function formatBalanceInput(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseBalanceInput(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')

  if (!normalized) return 0

  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null
}

watch(open, (value) => {
  if (!value) return

  errorMessage.value = ''
  bankKey.value = props.account?.bankKey ?? 'itau'
  customBankName.value =
    props.account?.bankKey === 'custom' ? (props.account.bankName ?? '') : ''
  name.value = props.account?.name ?? ''
  initialBalanceText.value = formatBalanceInput(
    props.account?.initialBalance ?? 0,
  )
})

function selectBank(key: BankKey) {
  bankKey.value = key

  if (key !== 'custom' && !name.value.trim()) {
    name.value = bankByKey(key)?.name ?? ''
  }
}

async function save() {
  const bankName = selectedBankName.value

  if (!bankName) {
    errorMessage.value = 'Selecione ou informe o banco.'
    return
  }

  if (!name.value.trim()) {
    errorMessage.value = 'Informe o nome da conta.'
    return
  }

  const initialBalance = parseBalanceInput(initialBalanceText.value)

  if (initialBalance === null) {
    errorMessage.value = 'Saldo inicial inválido.'
    return
  }

  const payload: AccountPayload = {
    bankKey: bankKey.value,
    bankName,
    name: name.value.trim(),
    initialBalance,
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value) {
      await $fetch(`/api/accounts/${props.account!.id}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/accounts', { method: 'POST', body: payload })
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
    :title="isEditing ? 'Editar conta' : 'Nova conta'"
  >
    <form class="account-form" @submit.prevent="save">
      <div class="account-form__section">
        <p class="account-form__label">
          Banco <span aria-hidden="true">*</span>
        </p>
        <div class="account-form__banks" role="radiogroup" aria-label="Banco">
          <button
            v-for="bank in bankCatalog"
            :key="bank.key"
            type="button"
            role="radio"
            class="account-form__bank"
            :class="{ 'account-form__bank--active': bankKey === bank.key }"
            :aria-checked="bankKey === bank.key"
            @click="selectBank(bank.key)"
          >
            <AccountsBankMark
              :name="bank.name"
              :color="bank.color"
              :bank-key="bank.key"
              size="lg"
            />
            <span>{{ bank.name }}</span>
          </button>
        </div>

        <div class="account-form__custom">
          <button
            type="button"
            class="account-form__custom-toggle"
            :class="{
              'account-form__custom-toggle--active': bankKey === 'custom',
            }"
            @click="selectBank('custom')"
          >
            Outro banco
          </button>
          <UiTextField
            v-if="bankKey === 'custom'"
            v-model="customBankName"
            placeholder="Nome do banco..."
          />
        </div>
      </div>

      <UiTextField
        v-model="name"
        label="Nome da conta"
        placeholder="Ex: Conta corrente, Conta salário..."
        required
      />

      <div class="account-form__section">
        <p class="account-form__label">
          Saldo inicial <span aria-hidden="true">*</span>
        </p>
        <div class="account-form__money">
          <span aria-hidden="true">R$</span>
          <input
            v-model="initialBalanceText"
            type="text"
            inputmode="decimal"
            aria-label="Saldo inicial"
          />
        </div>
        <p class="account-form__hint">
          O saldo inicial entra no saldo da conta. Receitas recebidas também somam ao saldo.
        </p>
      </div>

      <div class="account-form__preview">
        <AccountsBankMark
          :name="selectedBankName || 'Banco'"
          :color="resolveBankColor(bankKey, selectedBankName || 'Banco')"
          :bank-key="bankKey"
        />
        <div>
          <p>{{ name.trim() || 'Nome da conta' }}</p>
          <span>{{ selectedBankName || 'Banco' }}</span>
        </div>
      </div>

      <p v-if="errorMessage" class="account-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ isEditing ? 'Salvar alterações' : 'Adicionar conta' }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.account-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.account-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.account-form__label span {
  color: var(--color-negative);
}

.account-form__banks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.account-form__bank {
  display: flex;
  min-height: 3.5rem;
  padding: var(--space-2) var(--space-3);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.account-form__bank:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}

.account-form__bank--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-weight: var(--weight-semibold);
}

.account-form__custom {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-form__custom-toggle {
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

.account-form__custom-toggle--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-weight: var(--weight-semibold);
}

.account-form__money {
  display: flex;
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.account-form__money:focus-within {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.account-form__money input {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}

.account-form__money input:focus {
  outline: none;
}

.account-form__hint {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.account-form__preview {
  display: flex;
  padding: var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.account-form__preview p {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.account-form__preview span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.account-form__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
