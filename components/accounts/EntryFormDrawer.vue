<script setup lang="ts">
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Layers,
  Lock,
  Repeat,
} from '@lucide/vue'
import type { Account } from '~/types/account'
import type { Category } from '~/types/category'
import type {
  EntryOccurrence,
  EntryPayload,
  EntryRecurrence,
  EntrySeriesScope,
} from '~/types/entry'
import {
  addMonthsLocal,
  formatDateBr,
  monthEndLocal,
  parseDateBr,
  roundMoney,
} from '~/utils/dateMoney'

const props = withDefaults(
  defineProps<{
    account: Account
    entry?: EntryOccurrence | null
    initialType?: 'income' | 'expense'
  }>(),
  {
    entry: null,
    initialType: 'income',
  },
)

const emit = defineEmits<{
  saved: []
}>()

const open = defineModel<boolean>('open', { required: true })

const { data: categories } = await useFetch<Category[]>('/api/categories', {
  default: () => [],
})

const entryType = ref<'income' | 'expense' | 'transfer'>('income')
const description = ref('')
const amountText = ref('0,00')
const categoryId = ref<number | null>(null)
const statementName = ref('')
const notes = ref('')
const recurrence = ref<EntryRecurrence>('single')
const dateText = ref('')
const endDateText = ref('')
const installmentCount = ref(2)
const useMonthEnd = ref(false)
const editScope = ref<EntrySeriesScope>('occurrence')
const destinationAccountId = ref<number | null>(null)
const destinationAccounts = ref<Account[]>([])
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.entry !== null)
const isExpense = computed(() => entryType.value === 'expense')
const isTransfer = computed(() => entryType.value === 'transfer')
const drawerTitle = computed(() =>
  isEditing.value ? 'Editar lançamento' : 'Novo lançamento',
)

const typedCategories = computed(() =>
  categories.value.filter((category) => category.type === entryType.value),
)

const amountValue = computed(() => parseBalance(amountText.value))
const startMonth = computed({
  get: () => parseDateBr(dateText.value)?.slice(0, 7) ?? '',
  set: (month: string) => {
    dateText.value = /^\d{4}-\d{2}$/.test(month)
      ? formatDateBr(monthEndLocal(`${month}-01`))
      : ''
  },
})
const endMonth = computed({
  get: () => parseDateBr(endDateText.value)?.slice(0, 7) ?? '',
  set: (month: string) => {
    endDateText.value = /^\d{4}-\d{2}$/.test(month)
      ? formatDateBr(monthEndLocal(`${month}-01`))
      : ''
  },
})

const descriptionPlaceholder = computed(() => {
  if (isTransfer.value) return 'Ex: Reserva de emergência...'
  if (isExpense.value) return 'Ex: Aluguel, Supermercado...'
  return 'Ex: Salário, Freelance...'
})

const accountRoleLabel = computed(() => {
  if (isTransfer.value) return 'Conta de origem'
  return isExpense.value ? 'Conta de débito' : 'Conta de destino'
})

const statusLabel = computed(() => {
  if (isTransfer.value) return 'Transferência liquidada na data'
  return isExpense.value
    ? 'Liquidação automática na data'
    : 'Recebimento automático na data'
})

const submitLabel = computed(() => {
  if (isEditing.value) return 'Salvar alterações'
  if (isTransfer.value) return 'Transferir'
  return isExpense.value ? 'Adicionar despesa' : 'Adicionar receita'
})
const amountLabel = computed(() =>
  recurrence.value === 'installment' ? 'Valor da parcela' : 'Valor',
)
/** Saldo disponível na conta de origem para a transferência. */
const transferAvailable = computed(() => {
  const balance = props.account.balance
  if (
    isEditing.value &&
    props.entry?.type === 'transfer' &&
    props.entry.transferDirection === 'out'
  ) {
    return roundMoney(balance + props.entry.amount)
  }
  return balance
})
const canTransferAll = computed(
  () =>
    isTransfer.value &&
    !isEditing.value &&
    transferAvailable.value > 0,
)
const showScopePicker = computed(
  () => isEditing.value && recurrence.value !== 'single',
)

const installmentPreview = computed(() => {
  if (recurrence.value !== 'installment') return null
  const amount = amountValue.value
  const count = installmentCount.value
  const start = parseDateBr(dateText.value)
  if (amount === null || amount <= 0 || !start || count < 2) return null

  const end = addMonthsLocal(start, count - 1)
  return `${count}x de ${formatCurrency(amount)} • total ${formatCurrency(roundMoney(amount * count))} • até ${formatDateBr(end)}`
})

const fixedPreview = computed(() => {
  if (recurrence.value !== 'fixed') return null
  const start = parseDateBr(dateText.value)
  if (!start) return null
  if (useMonthEnd.value) return 'Todo mês no último dia'
  const day = Number(start.slice(8, 10))
  return `Todo mês no dia ${day}`
})

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseBalance(value: string): number | null {
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

function maskBrl(value: string) {
  const digits = value
    .replace(/\D/g, '')
    .replace(/^0+(?=\d{3})/, '')
    .slice(0, 17)
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

function setMaskedAmount(input: HTMLInputElement, digits: string) {
  const masked = maskBrl(digits)
  amountText.value = masked
  input.value = masked
  input.setSelectionRange(masked.length, masked.length)
}

function handleAmountKeydown(event: KeyboardEvent) {
  const input = event.target as HTMLInputElement
  const isAllSelected =
    input.selectionStart === 0 && input.selectionEnd === input.value.length

  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    const current = isAllSelected ? '' : amountDigits(amountText.value)
    if (current.length >= 17) return
    setMaskedAmount(input, `${current}${event.key}`)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    const current = isAllSelected ? '' : amountDigits(amountText.value)
    setMaskedAmount(input, current.slice(0, -1))
  }
}

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  setMaskedAmount(input, input.value)
}

function selectAmount(event: FocusEvent) {
  const input = event.target as HTMLInputElement
  input.select()
}

function todayBr() {
  return formatDateBr(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  )
}

function resetForm() {
  errorMessage.value = ''
  const current = props.entry

  if (current) {
    entryType.value =
      current.type === 'expense'
        ? 'expense'
        : current.type === 'transfer'
          ? 'transfer'
          : 'income'
    description.value = current.description
    amountText.value = maskBrl(String(Math.round(current.amount * 100)))
    categoryId.value = current.categoryId
    statementName.value = current.statementName ?? ''
    notes.value = current.notes ?? ''
    recurrence.value = current.recurrence
    dateText.value = formatDateBr(current.dueDate)
    endDateText.value = current.endDate ? formatDateBr(current.endDate) : ''
    installmentCount.value = current.installmentCount ?? 2
    useMonthEnd.value = current.useMonthEnd
    destinationAccountId.value = current.destinationAccountId
    editScope.value = 'occurrence'
    return
  }

  entryType.value = props.initialType
  description.value = ''
  amountText.value = '0,00'
  categoryId.value = null
  statementName.value = ''
  notes.value = ''
  recurrence.value = 'single'
  dateText.value = todayBr()
  endDateText.value = ''
  installmentCount.value = 2
  useMonthEnd.value = false
  destinationAccountId.value = null
  editScope.value = 'occurrence'
}

function setEntryType(type: 'income' | 'expense' | 'transfer') {
  if (isEditing.value || entryType.value === type) return
  entryType.value = type
  categoryId.value = null
  if (type === 'transfer') {
    recurrence.value = 'single'
    destinationAccountId.value = null
  }
}

async function loadDestinationAccounts() {
  try {
    const accounts = await $fetch<Account[]>('/api/accounts')
    const originId =
      props.entry?.type === 'transfer'
        ? props.entry.accountId
        : props.account.id
    destinationAccounts.value = accounts.filter((item) => item.id !== originId)
  } catch {
    destinationAccounts.value = []
  }
}

function onDestinationChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  destinationAccountId.value = value ? Number(value) : null
}

function transferAll() {
  if (!canTransferAll.value) return
  const cents = Math.round(transferAvailable.value * 100)
  amountText.value = maskBrl(String(cents))
}

watch(open, async (value) => {
  if (!value) return
  resetForm()
  await loadDestinationAccounts()
})

async function save() {
  const amount = amountValue.value
  const date = parseDateBr(dateText.value)

  if (!isTransfer.value && !description.value.trim()) {
    errorMessage.value = 'Informe a descrição.'
    return
  }
  if (amount === null || amount <= 0) {
    errorMessage.value = 'Informe um valor maior que zero.'
    return
  }
  if (!date) {
    errorMessage.value = 'Informe uma data válida (dd/mm/aaaa).'
    return
  }
  if (isTransfer.value && !destinationAccountId.value) {
    errorMessage.value = 'Selecione a conta de destino.'
    return
  }

  saving.value = true
  errorMessage.value = ''

  try {
    if (isEditing.value && props.entry) {
      await $fetch(`/api/entries/${props.entry.id}`, {
        method: 'PUT',
        body: {
          occurrenceMonth: props.entry.occurrenceMonth,
          scope:
            props.entry.recurrence === 'single' ? 'series' : editScope.value,
          description: description.value.trim() || props.entry.description,
          amount,
          categoryId: categoryId.value,
          statementName: statementName.value.trim() || null,
          notes: notes.value.trim() || null,
          date: useMonthEnd.value ? monthEndLocal(date) : date,
        },
      })
    } else {
      let endDate: string | null = null
      if (
        !isTransfer.value &&
        recurrence.value === 'fixed' &&
        endDateText.value.trim()
      ) {
        endDate = parseDateBr(endDateText.value)
        if (!endDate) {
          errorMessage.value = 'Data de fim inválida.'
          saving.value = false
          return
        }
        if (useMonthEnd.value) endDate = monthEndLocal(endDate)
      }

      if (
        !isTransfer.value &&
        recurrence.value === 'installment' &&
        installmentCount.value < 2
      ) {
        errorMessage.value = 'Parcelas devem ser no mínimo 2.'
        saving.value = false
        return
      }

      const destinationName =
        destinationAccounts.value.find(
          (item) => item.id === destinationAccountId.value,
        )?.name ?? 'outra conta'

      const payload: EntryPayload = {
        type: entryType.value,
        accountId: props.account.id,
        destinationAccountId: isTransfer.value
          ? destinationAccountId.value
          : null,
        description: isTransfer.value
          ? description.value.trim() || `Transferência para ${destinationName}`
          : description.value.trim(),
        amount,
        categoryId: isTransfer.value ? null : categoryId.value,
        statementName: statementName.value.trim() || null,
        notes: notes.value.trim() || null,
        recurrence: isTransfer.value ? 'single' : recurrence.value,
        date,
        endDate: isTransfer.value ? null : endDate,
        installmentCount:
          !isTransfer.value && recurrence.value === 'installment'
            ? installmentCount.value
            : null,
        useMonthEnd:
          !isTransfer.value &&
          recurrence.value === 'fixed' &&
          useMonthEnd.value,
      }

      await $fetch('/api/entries', { method: 'POST', body: payload })
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
  <UiDrawer v-model:open="open" :title="drawerTitle">
    <form
      class="entry-form"
      :class="{
        'entry-form--expense': isExpense,
        'entry-form--transfer': isTransfer,
      }"
      @submit.prevent="save"
    >
      <div class="entry-form__types" role="group" aria-label="Tipo de lançamento">
        <button
          type="button"
          class="entry-form__type entry-form__type--income"
          :class="{ 'entry-form__type--active': entryType === 'income' }"
          :disabled="isEditing"
          @click="setEntryType('income')"
        >
          <ArrowDownLeft aria-hidden="true" />
          Receita
        </button>
        <button
          type="button"
          class="entry-form__type entry-form__type--expense"
          :class="{ 'entry-form__type--active': entryType === 'expense' }"
          :disabled="isEditing"
          @click="setEntryType('expense')"
        >
          <ArrowUpRight aria-hidden="true" />
          Despesa
        </button>
        <button
          type="button"
          class="entry-form__type entry-form__type--transfer"
          :class="{ 'entry-form__type--active': entryType === 'transfer' }"
          :disabled="isEditing"
          @click="setEntryType('transfer')"
        >
          <ArrowLeftRight aria-hidden="true" />
          Transferir
        </button>
      </div>

      <div class="entry-form__account">
        <AccountsBankMark
          :name="account.bankName"
          :color="account.color"
          :bank-key="account.bankKey"
        />
        <div>
          <p>
            {{
              isTransfer && isEditing && entry?.accountName
                ? entry.accountName
                : account.name
            }}
          </p>
          <span>{{ accountRoleLabel }}</span>
          <span
            v-if="isTransfer && !isEditing"
            class="entry-form__account-balance"
          >
            Saldo atual {{ formatCurrency(transferAvailable) }}
          </span>
        </div>
        <Lock aria-hidden="true" />
      </div>

      <div v-if="isTransfer" class="entry-form__section">
        <p class="entry-form__label">
          Conta de destino <span aria-hidden="true">*</span>
        </p>
        <select
          class="entry-form__select"
          aria-label="Conta de destino"
          required
          :value="destinationAccountId ?? ''"
          :disabled="isEditing"
          @change="onDestinationChange"
        >
          <option value="" disabled>Selecione a conta de destino...</option>
          <option
            v-for="item in destinationAccounts"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </select>
      </div>

      <UiTextField
        v-model="description"
        label="Descrição"
        :placeholder="descriptionPlaceholder"
        :required="!isTransfer"
      />

      <div class="entry-form__section">
        <div class="entry-form__amount-header">
          <p class="entry-form__label">
            {{ amountLabel }} <span aria-hidden="true">*</span>
          </p>
          <button
            v-if="canTransferAll"
            type="button"
            class="entry-form__transfer-all"
            @click="transferAll"
          >
            Transferir tudo
          </button>
        </div>
        <div class="entry-form__money">
          <span aria-hidden="true">R$</span>
          <input
            :value="amountText"
            type="text"
            inputmode="numeric"
            aria-label="Valor"
            autocomplete="off"
            @focus="selectAmount"
            @keydown="handleAmountKeydown"
            @input="handleAmountInput"
          />
        </div>
      </div>

      <template v-if="isTransfer">
        <UiDateField v-model="dateText" label="Data" required />
        <div class="entry-form__status">
          <Check aria-hidden="true" />
          {{ statusLabel }}
        </div>
      </template>

      <template v-else>
      <div class="entry-form__section">
        <CategoriesCategoryPicker
          v-model="categoryId"
          :categories="typedCategories"
        />
      </div>

      <div class="entry-form__section">
        <UiStatementNameField
          v-model="statementName"
          placeholder="Ex: AMZN*MKTP BR 7K9QP2..."
        />
      </div>
      <div class="entry-form__section">
        <p class="entry-form__label">Notas</p>
        <textarea
          v-model="notes"
          class="entry-form__notes"
          rows="3"
          placeholder="Observações opcionais..."
        />
      </div>

      <div class="entry-form__section">
        <p class="entry-form__label">Tipo</p>
        <div class="entry-form__recurrence">
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'single' }"
            :disabled="isEditing"
            @click="recurrence = 'single'"
          >
            <CalendarDays aria-hidden="true" />
            <strong>Avulsa</strong>
            <span>Uma vez</span>
          </button>
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'installment' }"
            :disabled="isEditing"
            @click="recurrence = 'installment'"
          >
            <Layers aria-hidden="true" />
            <strong>Parcelada</strong>
            <span>X vezes</span>
          </button>
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'fixed' }"
            :disabled="isEditing"
            @click="recurrence = 'fixed'"
          >
            <Repeat aria-hidden="true" />
            <strong>Fixa</strong>
            <span>Todo mês</span>
          </button>
        </div>
      </div>

      <div v-if="showScopePicker" class="entry-form__section">
        <p class="entry-form__label">Aplicar alteração</p>
        <div class="entry-form__scope" role="group" aria-label="Escopo da edição">
          <button
            type="button"
            :class="{ 'is-active': editScope === 'occurrence' }"
            @click="editScope = 'occurrence'"
          >
            Só esta
          </button>
          <button
            type="button"
            :class="{ 'is-active': editScope === 'future' }"
            @click="editScope = 'future'"
          >
            Esta e próximas
          </button>
          <button
            type="button"
            :class="{ 'is-active': editScope === 'series' }"
            @click="editScope = 'series'"
          >
            Série inteira
          </button>
        </div>
      </div>

      <template v-if="isEditing">
        <div v-if="useMonthEnd" class="entry-form__section">
          <p class="entry-form__label">
            Mês <span aria-hidden="true">*</span>
          </p>
          <input
            v-model="startMonth"
            class="entry-form__month"
            type="month"
            lang="pt-BR"
            aria-label="Mês"
            required
          />
        </div>
        <UiDateField v-else v-model="dateText" label="Data" required />
      </template>

      <template v-else-if="recurrence === 'single'">
        <UiDateField v-model="dateText" label="Data" required />
        <div class="entry-form__status">
          <Check aria-hidden="true" />
          {{ statusLabel }}
        </div>
      </template>

      <template v-else-if="recurrence === 'installment'">
        <div class="entry-form__row">
          <UiDateField
            v-model="dateText"
            label="Data da 1ª parcela"
            required
          />
          <div class="entry-form__section">
            <p class="entry-form__label">
              Nº de parcelas <span aria-hidden="true">*</span>
            </p>
            <input
              v-model.number="installmentCount"
              class="entry-form__number"
              type="number"
              min="2"
              max="60"
            />
          </div>
        </div>
        <p v-if="installmentPreview" class="entry-form__summary">
          <Layers aria-hidden="true" />
          {{ installmentPreview }}
        </p>
      </template>

      <template v-else>
        <div v-if="useMonthEnd" class="entry-form__row">
          <div class="entry-form__section">
            <p class="entry-form__label">
              Mês de início <span aria-hidden="true">*</span>
            </p>
            <input
              v-model="startMonth"
              class="entry-form__month"
              type="month"
              lang="pt-BR"
              aria-label="Mês de início"
              required
            />
          </div>
          <div class="entry-form__section">
            <p class="entry-form__label">Mês de fim</p>
            <input
              v-model="endMonth"
              class="entry-form__month"
              type="month"
              lang="pt-BR"
              aria-label="Mês de fim"
            />
          </div>
        </div>
        <div v-else class="entry-form__row">
          <UiDateField
            v-model="dateText"
            label="Data de início"
            required
          />
          <UiDateField v-model="endDateText" label="Data de fim" />
        </div>
        <label class="entry-form__month-end">
          <input v-model="useMonthEnd" type="checkbox" />
          <span>
            <strong>Sempre no último dia do mês</strong>
            <small>Em fevereiro, usa automaticamente 28 ou 29.</small>
          </span>
        </label>
        <p v-if="fixedPreview" class="entry-form__summary entry-form__summary--fixed">
          <Repeat aria-hidden="true" />
          {{ fixedPreview }}
        </p>
      </template>
      </template>

      <p v-if="errorMessage" class="entry-form__error" role="alert">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton
        class="entry-form__submit"
        :class="{
          'entry-form__submit--expense': isExpense,
          'entry-form__submit--transfer': isTransfer,
        }"
        :disabled="saving"
        @click="save"
      >
        {{ submitLabel }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.entry-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.entry-form__types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.entry-form__type {
  display: flex;
  min-height: 2.75rem;
  padding: 0 var(--space-2);
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.entry-form__type svg {
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
}

.entry-form__type--active {
  font-weight: var(--weight-semibold);
}

.entry-form__type--income.entry-form__type--active {
  border-color: var(--color-positive);
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
}

.entry-form__type--expense.entry-form__type--active {
  border-color: var(--color-negative);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.entry-form__type--transfer.entry-form__type--active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.entry-form__type:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.entry-form__account {
  display: flex;
  padding: var(--space-3) var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.entry-form__account div {
  min-width: 0;
  flex: 1;
}

.entry-form__account p {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.entry-form__account span {
  display: block;
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.entry-form__account-balance {
  margin-top: 0.15rem;
  color: var(--color-ink-secondary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-medium);
}

.entry-form__account svg {
  width: 1rem;
  height: 1rem;
  color: var(--color-ink-muted);
}

.entry-form__amount-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.entry-form__amount-header .entry-form__label {
  margin: 0;
}

.entry-form__transfer-all {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-brand);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.entry-form__transfer-all:hover {
  color: var(--color-brand-hover);
  text-decoration: underline;
}

.entry-form__section {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.entry-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.entry-form__label span {
  color: var(--color-negative);
}

.entry-form__money,
.entry-form__number,
.entry-form__month,
.entry-form__notes,
.entry-form__select {
  min-height: 2.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: var(--text-sm);
}

.entry-form__money {
  display: flex;
  width: 100%;
  min-width: 0;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  box-sizing: border-box;
}

.entry-form__money:focus-within,
.entry-form__number:focus,
.entry-form__month:focus,
.entry-form__notes:focus {
  outline: none;
  border-color: var(--color-brand);
  box-shadow: 0 0 0 3px var(--color-brand-soft);
}

.entry-form__money span {
  color: var(--color-ink-muted);
  font-weight: var(--weight-medium);
}

.entry-form__money input {
  width: 100%;
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  font-variant-numeric: tabular-nums;
}

.entry-form__money input:focus {
  outline: none;
}

.entry-form__number,
.entry-form__month {
  width: 100%;
  padding: 0 var(--space-3);
}

.entry-form__notes {
  padding: var(--space-3);
  resize: vertical;
  font: inherit;
}

.entry-form__recurrence {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.entry-form__recurrence button {
  display: flex;
  min-height: 4.5rem;
  padding: var(--space-3);
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.entry-form__recurrence button svg {
  width: 1rem;
  height: 1rem;
  margin-bottom: var(--space-1);
}

.entry-form__recurrence button strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.entry-form__recurrence button span {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.entry-form__recurrence button.is-active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.entry-form__recurrence button:disabled {
  cursor: default;
  opacity: 0.72;
}

.entry-form--expense .entry-form__recurrence button.is-active {
  border-color: var(--color-negative);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.entry-form__scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.entry-form__scope button {
  min-height: 2.5rem;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  cursor: pointer;
}

.entry-form__scope button.is-active {
  border-color: var(--color-brand);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.entry-form--expense .entry-form__scope button.is-active {
  border-color: var(--color-negative);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.entry-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.entry-form__month-end {
  display: flex;
  padding: var(--space-3) var(--space-4);
  align-items: flex-start;
  gap: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
  color: var(--color-ink-secondary);
  cursor: pointer;
}

.entry-form__month-end input {
  margin-top: 0.15rem;
  accent-color: var(--color-positive);
}

.entry-form__month-end span {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.entry-form__month-end strong {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.entry-form__month-end small {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.entry-form__status,
.entry-form__summary {
  display: flex;
  padding: var(--space-3) var(--space-4);
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.entry-form__status svg,
.entry-form__summary svg {
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
}

.entry-form__status {
  background: var(--color-positive-soft);
  color: var(--color-positive-ink);
}

.entry-form__summary {
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
}

.entry-form--expense .entry-form__summary {
  background: #efe9fb;
  color: #5b3d9a;
}

.entry-form__summary--fixed {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.entry-form--expense .entry-form__summary--fixed {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.entry-form__error {
  color: var(--color-negative);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}

.entry-form__submit--expense {
  background: var(--color-negative) !important;
}

.entry-form__submit--expense:hover:not(:disabled) {
  background: var(--color-negative-ink) !important;
}

.entry-form__submit--transfer {
  background: var(--color-brand) !important;
}

.entry-form__submit--transfer:hover:not(:disabled) {
  background: var(--color-brand-ink) !important;
}

.entry-form__select {
  width: 100%;
  padding: 0 var(--space-3);
  box-sizing: border-box;
}

.entry-form__select:focus {
  outline: 2px solid var(--color-brand);
  outline-offset: 1px;
}

.entry-form__select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

@media (max-width: 480px) {
  .entry-form__recurrence,
  .entry-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
