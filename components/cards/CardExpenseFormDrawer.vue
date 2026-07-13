<script setup lang="ts">
import {
  CalendarDays,
  Check,
  CreditCard,
  Layers,
  Lock,
  Repeat,
} from '@lucide/vue'
import type { Card } from '~/types/card'
import type {
  CardExpensePayload,
} from '~/types/cardExpense'
import type { CardInvoiceEntry } from '~/types/cardInvoice'
import type { Category } from '~/types/category'
import type {
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
import { transacaoFaturaMonth } from '~/utils/cardInvoiceCycle'

const props = withDefaults(
  defineProps<{
    card: Card
    expense?: CardInvoiceEntry | null
    /** Prefill para criar uma cópia (modo criação). */
    duplicateFrom?: CardInvoiceEntry | null
  }>(),
  { expense: null, duplicateFrom: null },
)
const emit = defineEmits<{ saved: [invoiceMonth?: string] }>()
const open = defineModel<boolean>('open', { required: true })

const { data: categories } = await useFetch<Category[]>('/api/categories', {
  default: () => [],
})

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
const errorMessage = ref('')
const saving = ref(false)

const isEditing = computed(() => props.expense !== null)
const isDuplicating = computed(
  () => props.duplicateFrom !== null && props.expense === null,
)
const drawerTitle = computed(() => {
  if (isEditing.value) return 'Editar despesa'
  if (isDuplicating.value) return 'Duplicar despesa'
  return 'Nova despesa'
})
const submitLabel = computed(() => {
  if (isEditing.value) return 'Salvar alterações'
  if (isDuplicating.value) return 'Duplicar'
  return 'Adicionar despesa'
})
const expenseCategories = computed(() =>
  categories.value.filter((category) => category.type === 'expense'),
)
const amountValue = computed(() => parseMoney(amountText.value))
const showScope = computed(
  () => isEditing.value && recurrence.value !== 'single',
)
const amountLabel = computed(() =>
  recurrence.value === 'installment' ? 'Valor da parcela' : 'Valor',
)
const installmentPreview = computed(() => {
  if (recurrence.value !== 'installment') return null
  const date = parseDateBr(dateText.value)
  const amount = amountValue.value
  if (!date || !amount || installmentCount.value < 2) return null

  // Preview do fim deve seguir a competência da fatura (fechamento do cartão),
  // não só o mês civil da última compra.
  let seriesStart = date
  if (
    isEditing.value &&
    props.expense?.installmentIndex &&
    props.expense.installmentIndex > 1
  ) {
    seriesStart = addMonthsLocal(date, -(props.expense.installmentIndex - 1))
  }
  const lastPurchase = addMonthsLocal(
    seriesStart,
    installmentCount.value - 1,
  )
  const lastInvoiceMonth = transacaoFaturaMonth(
    lastPurchase,
    props.card.closingDay,
  )
  return `${installmentCount.value}x de ${formatCurrency(amount)} · até fatura de ${formatInvoiceMonthLabel(lastInvoiceMonth)}`
})
const showInstallmentFields = computed(
  () => recurrence.value === 'installment',
)
const fixedPreview = computed(() => {
  if (recurrence.value !== 'fixed') return null
  const date = parseDateBr(dateText.value)
  if (!date) return null
  if (useMonthEnd.value) return 'Todo mês no último dia'
  return `Todo mês no dia ${Number(date.slice(8, 10))}`
})

const INVOICE_MONTH_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function formatInvoiceMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return `${INVOICE_MONTH_SHORT[month - 1]}/${year}`
}

function todayBr() {
  const now = new Date()
  return formatDateBr(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  )
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseMoney(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
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
  const allSelected =
    input.selectionStart === 0 && input.selectionEnd === input.value.length
  if (/^\d$/.test(event.key)) {
    event.preventDefault()
    const current = allSelected ? '' : amountDigits(amountText.value)
    if (current.length < 17) {
      setMaskedAmount(input, `${current}${event.key}`)
    }
  } else if (event.key === 'Backspace') {
    event.preventDefault()
    const current = allSelected ? '' : amountDigits(amountText.value)
    setMaskedAmount(input, current.slice(0, -1))
  }
}

function resetForm() {
  errorMessage.value = ''
  const current = props.expense
  const draft = props.duplicateFrom

  if (current) {
    description.value = current.description
    amountText.value = maskBrl(String(Math.round(current.amount * 100)))
    categoryId.value = current.categoryId
    statementName.value = current.statementName ?? ''
    notes.value = current.notes ?? ''
    recurrence.value = current.recurrence
    dateText.value = formatDateBr(current.date)
    installmentCount.value = current.installmentCount ?? 2
    useMonthEnd.value = current.useMonthEnd
    editScope.value = 'occurrence'
    endDateText.value = ''
    return
  }

  if (draft) {
    description.value = draft.description
    amountText.value = maskBrl(String(Math.round(draft.amount * 100)))
    categoryId.value = draft.categoryId
    statementName.value = draft.statementName ?? ''
    notes.value = draft.notes ?? ''
    // Cópia avulsa do lançamento da fatura (não recria série/parcelas).
    recurrence.value = 'single'
    dateText.value = formatDateBr(draft.date)
    installmentCount.value = 2
    useMonthEnd.value = false
    editScope.value = 'occurrence'
    endDateText.value = ''
    return
  }

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
  editScope.value = 'occurrence'
}

watch(open, (value) => {
  if (value) resetForm()
})

watch(installmentCount, (value) => {
  if (!open.value || !isEditing.value || !props.expense) return
  if (props.expense.recurrence !== 'installment') return
  if (value === props.expense.installmentCount) return
  if (editScope.value === 'occurrence') editScope.value = 'series'
})

async function save() {
  const amount = amountValue.value
  const date = parseDateBr(dateText.value)
  if (!description.value.trim()) {
    errorMessage.value = 'Informe a descrição.'
    return
  }
  if (amount === null || amount <= 0) {
    errorMessage.value = 'Informe um valor maior que zero.'
    return
  }
  if (!date) {
    errorMessage.value = 'Informe uma data válida.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    const purchaseDate = useMonthEnd.value ? monthEndLocal(date) : date
    let invoiceMonth: string | undefined

    if (isEditing.value && props.expense) {
      if (
        props.expense.recurrence === 'installment' &&
        installmentCount.value < 2
      ) {
        errorMessage.value = 'Informe ao menos duas parcelas.'
        return
      }
      const countChanged =
        props.expense.recurrence === 'installment' &&
        installmentCount.value !== (props.expense.installmentCount ?? null)
      const scope =
        props.expense.recurrence === 'single'
          ? 'series'
          : countChanged
            ? 'series'
            : editScope.value
      await $fetch(
        `/api/cards/${props.card.id}/expenses/${props.expense.parentId}`,
        {
          method: 'PUT',
          body: {
            occurrenceMonth: props.expense.occurrenceMonth,
            scope,
            description: description.value.trim(),
            amount,
            categoryId: categoryId.value,
            statementName: statementName.value.trim() || null,
            notes: notes.value.trim() || null,
            date: purchaseDate,
            installmentCount:
              props.expense.recurrence === 'installment'
                ? installmentCount.value
                : null,
          },
        },
      )
      invoiceMonth = transacaoFaturaMonth(
        purchaseDate,
        props.card.closingDay,
      )
    } else {
      let endDate: string | null = null
      if (recurrence.value === 'fixed' && endDateText.value.trim()) {
        endDate = parseDateBr(endDateText.value)
        if (!endDate) {
          errorMessage.value = 'Data de fim inválida.'
          return
        }
      }
      if (recurrence.value === 'installment' && installmentCount.value < 2) {
        errorMessage.value = 'Informe ao menos duas parcelas.'
        return
      }
      const payload: CardExpensePayload = {
        description: description.value.trim(),
        amount,
        categoryId: categoryId.value,
        statementName: statementName.value.trim() || null,
        notes: notes.value.trim() || null,
        recurrence: recurrence.value,
        date,
        endDate,
        installmentCount:
          recurrence.value === 'installment'
            ? installmentCount.value
            : null,
        useMonthEnd:
          recurrence.value === 'fixed' && useMonthEnd.value,
      }
      const created = await $fetch<{ id: number; invoiceMonth: string }>(
        `/api/cards/${props.card.id}/expenses`,
        {
          method: 'POST',
          body: payload,
        },
      )
      invoiceMonth = created.invoiceMonth
    }
    open.value = false
    emit('saved', invoiceMonth)
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível salvar a despesa.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="drawerTitle">
    <form class="card-expense-form" @submit.prevent="save">
      <div class="card-expense-form__card">
        <AccountsBankMark
          :name="card.bankName"
          :color="card.color"
          :bank-key="card.bankKey"
        />
        <div>
          <p>{{ card.name }}</p>
          <span>Cartão de crédito</span>
        </div>
        <Lock aria-hidden="true" />
      </div>

      <UiTextField
        v-model="description"
        label="Descrição"
        placeholder="Ex: Supermercado, Netflix..."
        required
      />

      <div class="card-expense-form__section">
        <p class="card-expense-form__label">
          {{ amountLabel }} <span>*</span>
        </p>
        <div class="card-expense-form__money">
          <span>R$</span>
          <input
            :value="amountText"
            inputmode="numeric"
            aria-label="Valor"
            @focus="($event.target as HTMLInputElement).select()"
            @keydown="handleAmountKeydown"
            @input="setMaskedAmount($event.target as HTMLInputElement, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="card-expense-form__section">
        <CategoriesCategoryPicker
          v-model="categoryId"
          :categories="expenseCategories"
        />
      </div>

      <div class="card-expense-form__section">
        <UiStatementNameField
          v-model="statementName"
          placeholder="Ex: AMZN*MKTP BR..."
        />
      </div>
      <div class="card-expense-form__section">
        <p class="card-expense-form__label">Notas</p>
        <textarea
          v-model="notes"
          rows="3"
          placeholder="Observações opcionais..."
        />
      </div>

      <div class="card-expense-form__section">
        <p class="card-expense-form__label">Tipo</p>
        <div class="card-expense-form__types">
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'single' }"
            :disabled="isEditing"
            @click="recurrence = 'single'"
          >
            <CalendarDays /><strong>Avulsa</strong><span>Uma vez</span>
          </button>
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'installment' }"
            :disabled="isEditing"
            @click="recurrence = 'installment'"
          >
            <Layers /><strong>Parcelada</strong><span>X vezes</span>
          </button>
          <button
            type="button"
            :class="{ 'is-active': recurrence === 'fixed' }"
            :disabled="isEditing"
            @click="recurrence = 'fixed'"
          >
            <Repeat /><strong>Fixa</strong><span>Todo mês</span>
          </button>
        </div>
      </div>

      <div v-if="showScope" class="card-expense-form__section">
        <p class="card-expense-form__label">Aplicar alteração</p>
        <div class="card-expense-form__scope">
          <button
            v-for="option in [
              { value: 'occurrence', label: 'Só esta' },
              { value: 'future', label: 'Esta e próximas' },
              { value: 'series', label: 'Série inteira' },
            ]"
            :key="option.value"
            type="button"
            :class="{ 'is-active': editScope === option.value }"
            @click="editScope = option.value as EntrySeriesScope"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div
        v-if="showInstallmentFields"
        class="card-expense-form__row"
      >
        <UiDateField
          v-model="dateText"
          :label="isEditing ? 'Data' : 'Data da 1ª parcela'"
          required
        />
        <div class="card-expense-form__section">
          <p class="card-expense-form__label">Nº de parcelas <span>*</span></p>
          <input v-model.number="installmentCount" type="number" min="2" max="60" />
          <p
            v-if="isEditing"
            class="card-expense-form__hint"
          >
            Alterar o total aplica na série inteira.
          </p>
        </div>
      </div>
      <div
        v-else-if="recurrence === 'fixed' && !isEditing"
        class="card-expense-form__row"
      >
        <UiDateField v-model="dateText" label="Data de início" required />
        <UiDateField v-model="endDateText" label="Data de fim" />
      </div>
      <UiDateField v-else v-model="dateText" label="Data" required />

      <label
        v-if="recurrence === 'fixed' && !isEditing"
        class="card-expense-form__month-end"
      >
        <input v-model="useMonthEnd" type="checkbox" />
        Sempre no último dia do mês
      </label>

      <p
        v-if="installmentPreview || fixedPreview"
        class="card-expense-form__summary"
      >
        <Check />
        {{ installmentPreview || fixedPreview }}
      </p>
      <p v-if="errorMessage" class="card-expense-form__error">
        {{ errorMessage }}
      </p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ submitLabel }}
      </UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.card-expense-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.card-expense-form__section {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-2);
}

.card-expense-form__label {
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.card-expense-form__label span,
.card-expense-form__error {
  color: var(--color-negative);
}

.card-expense-form__card {
  display: flex;
  padding: var(--space-4);
  align-items: center;
  gap: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-subtle);
}

.card-expense-form__card div {
  min-width: 0;
  flex: 1;
}

.card-expense-form__card p {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.card-expense-form__card span {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
}

.card-expense-form__card > svg {
  width: 1rem;
  color: var(--color-border-strong);
}

.card-expense-form__money,
.card-expense-form__section > input,
.card-expense-form__section > textarea {
  min-height: 2.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font: inherit;
}

.card-expense-form__money {
  display: flex;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
}

.card-expense-form__money input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
}

.card-expense-form__money span {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
}

.card-expense-form__section > input,
.card-expense-form__section > textarea {
  padding: var(--space-3);
}

.card-expense-form__types,
.card-expense-form__scope {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.card-expense-form__types button {
  display: flex;
  min-height: 4.5rem;
  padding: var(--space-3);
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink-secondary);
}

.card-expense-form__types button.is-active,
.card-expense-form__scope button.is-active {
  border-color: var(--color-negative);
  background: var(--color-negative-soft);
  color: var(--color-negative-ink);
}

.card-expense-form__types svg {
  width: 1rem;
  margin-bottom: var(--space-1);
}

.card-expense-form__types strong {
  font-size: var(--text-xs);
}

.card-expense-form__types span {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
}

.card-expense-form__scope button {
  min-height: 2.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: var(--text-xs);
}

.card-expense-form__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.card-expense-form__month-end {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-ink-secondary);
  font-size: var(--text-xs);
}

.card-expense-form__summary {
  display: flex;
  padding: var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-brand-soft);
  color: var(--color-brand-ink);
  font-size: var(--text-xs);
}

.card-expense-form__summary svg {
  width: 1rem;
}

.card-expense-form__hint {
  margin: var(--space-1) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  line-height: 1.35;
}

.card-expense-form__error {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
}
</style>
