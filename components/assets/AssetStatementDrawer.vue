<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, Check, Pencil, Plus, RefreshCw, Trash2 } from '@lucide/vue'
import type { Asset, AssetMovementKind, AssetMovementPayload, AssetStatement, AssetStatementEntry } from '~/types/asset'
import { formatDateBr, parseDateBr } from '~/utils/dateMoney'

const props = defineProps<{ asset: Asset | null }>()
const emit = defineEmits<{ changed: [] }>()
const open = defineModel<boolean>('open', { required: true })

const statement = ref<AssetStatement | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const scheduledDate = ref<string | null>(null)
const removeDialogOpen = ref(false)
const pendingRemoval = ref<AssetStatementEntry | null>(null)
const removing = ref(false)
const kind = ref<AssetMovementKind>('contribution')
const movementDate = ref('')
const notes = ref('')
const amount = useMoneyField()

const kindOptions: Array<{ value: AssetMovementKind; label: string }> = [
  { value: 'contribution', label: 'Aporte' },
  { value: 'yield', label: 'Rendimento' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'adjustment_credit', label: 'Ajuste positivo' },
  { value: 'adjustment_debit', label: 'Ajuste negativo' },
  { value: 'balance_confirmation', label: 'Confirmar saldo' },
]

const editingProjection = computed(() => Boolean(scheduledDate.value) && editingId.value === null)

watch(open, async (value) => {
  if (!value || !props.asset) return
  closeForm()
  await loadStatement()
})

async function loadStatement() {
  if (!props.asset) return
  loading.value = true
  errorMessage.value = ''
  try {
    statement.value = await $fetch<AssetStatement>(`/api/assets/${props.asset.id}/statement`)
  }
  catch {
    errorMessage.value = 'Não foi possível carregar o extrato.'
  }
  finally {
    loading.value = false
  }
}

function todayBr() {
  return new Date().toLocaleDateString('pt-BR')
}

function openNewMovement() {
  editingId.value = null
  scheduledDate.value = null
  kind.value = 'contribution'
  movementDate.value = todayBr()
  notes.value = ''
  amount.setFromAmount(0)
  errorMessage.value = ''
  formOpen.value = true
}

function openBalanceConfirmation() {
  editingId.value = null
  scheduledDate.value = null
  kind.value = 'balance_confirmation'
  movementDate.value = todayBr()
  notes.value = ''
  amount.setFromAmount(statement.value?.asset.estimatedCurrentBalance ?? 0)
  errorMessage.value = ''
  formOpen.value = true
}

function editEntry(entry: AssetStatementEntry) {
  if (entry.source === 'initial') return
  editingId.value = entry.id
  scheduledDate.value = entry.scheduledDate
  kind.value = entry.kind as AssetMovementKind
  movementDate.value = formatDateBr(entry.movementDate)
  notes.value = entry.notes ?? ''
  amount.setFromAmount(entry.amount)
  errorMessage.value = ''
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
  scheduledDate.value = null
  errorMessage.value = ''
}

async function saveMovement() {
  if (!props.asset) return
  const parsedDate = parseDateBr(movementDate.value)
  const amountValue = amount.amountValue.value
  if (!parsedDate) return void (errorMessage.value = 'Informe uma data válida.')
  if (amountValue === null || amountValue < 0 || (amountValue === 0 && kind.value !== 'balance_confirmation')) {
    return void (errorMessage.value = 'Informe um valor válido.')
  }

  const payload: AssetMovementPayload = {
    kind: kind.value,
    amount: amountValue,
    movementDate: parsedDate,
    scheduledDate: scheduledDate.value,
    notes: notes.value.trim() || null,
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const url = editingId.value
      ? `/api/assets/${props.asset.id}/movements/${editingId.value}`
      : `/api/assets/${props.asset.id}/movements`
    await $fetch(url, { method: editingId.value ? 'PUT' : 'POST', body: payload })
    closeForm()
    await loadStatement()
    emit('changed')
  }
  catch (error) {
    const response = error as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value = response.data?.statusMessage ?? response.statusMessage ?? 'Não foi possível salvar a movimentação.'
  }
  finally {
    saving.value = false
  }
}

function requestMovementRemoval(entry: AssetStatementEntry) {
  pendingRemoval.value = entry
  removeDialogOpen.value = true
}

async function confirmMovementRemoval() {
  if (!props.asset || !pendingRemoval.value?.id) return
  removing.value = true
  try {
    await $fetch(`/api/assets/${props.asset.id}/movements/${pendingRemoval.value.id}`, { method: 'DELETE' })
    removeDialogOpen.value = false
    pendingRemoval.value = null
    await loadStatement()
    emit('changed')
  }
  finally {
    removing.value = false
  }
}

function entryIcon(entry: AssetStatementEntry) {
  if (entry.kind === 'withdrawal' || entry.kind === 'adjustment_debit') return ArrowDownLeft
  if (entry.kind === 'balance_confirmation' || entry.kind === 'initial_balance') return Check
  return ArrowUpRight
}

function signedValue(entry: AssetStatementEntry) {
  if (entry.kind === 'balance_confirmation' || entry.kind === 'initial_balance') {
    return `= ${formatMoney(entry.amount)}`
  }
  return `${entry.effect >= 0 ? '+' : '−'} ${formatMoney(Math.abs(entry.effect))}`
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="asset ? `Extrato · ${asset.name}` : 'Extrato do patrimônio'">
    <div class="statement">
      <section v-if="statement" class="statement__summary">
        <span>Saldo estimado hoje</span>
        <strong><UiMoney :value="statement.asset.estimatedCurrentBalance" /></strong>
        <small>Automático até {{ formatDateBr(statement.asOf) }}</small>
        <button type="button" @click="openBalanceConfirmation">
          <Pencil aria-hidden="true" />
          Corrigir saldo de hoje
        </button>
      </section>

      <div class="statement__toolbar">
        <div>
          <strong>Histórico</strong>
          <span>Estimativas podem ser corrigidas individualmente.</span>
        </div>
        <UiButton size="sm" @click="openNewMovement">
          <template #leading><Plus /></template>
          Adicionar lançamento
        </UiButton>
      </div>

      <form v-if="formOpen" class="statement-form" @submit.prevent="saveMovement">
        <header>
          <div>
            <strong>{{ editingProjection ? 'Corrigir previsão' : editingId ? 'Editar movimento' : kind === 'balance_confirmation' ? 'Corrigir saldo' : 'Novo lançamento' }}</strong>
            <span v-if="editingProjection">A correção ficará confirmada no extrato.</span>
            <span v-else-if="kind === 'balance_confirmation'">Informe o saldo correto e a data da conferência.</span>
          </div>
          <button type="button" @click="closeForm">Cancelar</button>
        </header>

        <label class="statement-form__field">
          <span>Tipo</span>
          <select v-model="kind" :disabled="editingProjection">
            <option v-for="option in kindOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <section class="statement-form__field">
          <span>Valor</span>
          <div class="statement-form__money">
            <span aria-hidden="true">R$</span>
            <input
              v-model="amount.amountText.value"
              type="text"
              inputmode="decimal"
              aria-label="Valor da movimentação"
              @keydown="amount.handleAmountKeydown"
              @input="amount.handleAmountInput"
            >
          </div>
        </section>

        <UiDateField v-model="movementDate" label="Data" required />

        <label class="statement-form__field">
          <span>Observação</span>
          <textarea v-model="notes" rows="2" maxlength="500" placeholder="Opcional" />
        </label>

        <p v-if="errorMessage" class="statement-form__error" role="alert">{{ errorMessage }}</p>
        <UiButton :disabled="saving" @click="saveMovement">Salvar no extrato</UiButton>
      </form>

      <div v-if="loading" class="statement__loading">
        <UiSkeleton v-for="index in 4" :key="index" height="4.5rem" radius="md" />
      </div>
      <UiEmptyState
        v-else-if="errorMessage && !statement"
        title="Não foi possível carregar o extrato"
        description="Tente novamente em instantes."
      />
      <ol v-else-if="statement" class="statement-list">
        <li v-for="entry in statement.entries" :key="entry.key" class="statement-entry">
          <div class="statement-entry__icon" :class="{ 'is-negative': entry.effect < 0 }">
            <component :is="entryIcon(entry)" aria-hidden="true" />
          </div>
          <div class="statement-entry__content">
            <div class="statement-entry__title">
              <strong>{{ entry.label }}</strong>
              <span :class="{ 'is-negative': entry.effect < 0 }">{{ signedValue(entry) }}</span>
            </div>
            <div class="statement-entry__meta">
              <span>{{ formatDateBr(entry.movementDate) }}</span>
              <span class="statement-entry__status" :class="`is-${entry.status}`">{{ entry.status === 'estimated' ? 'Estimado' : 'Confirmado' }}</span>
            </div>
            <small>Saldo após o movimento: {{ formatMoney(entry.balance) }}</small>
            <small v-if="entry.notes">{{ entry.notes }}</small>
          </div>
          <div v-if="entry.source !== 'initial'" class="statement-entry__actions">
            <button type="button" class="statement-entry__edit" :aria-label="`Editar ${entry.label}`" @click="editEntry(entry)"><Pencil /><span>Editar</span></button>
            <button v-if="entry.id" type="button" :aria-label="`Excluir ${entry.label}`" @click="requestMovementRemoval(entry)"><Trash2 /></button>
          </div>
        </li>
      </ol>
    </div>
  </UiDrawer>

  <UiConfirmDialog
    v-model:open="removeDialogOpen"
    title="Excluir movimentação"
    :description="`Excluir ${pendingRemoval?.label?.toLocaleLowerCase('pt-BR') ?? 'esta movimentação'} do extrato? O saldo e as projeções serão recalculados.`"
    confirm-label="Excluir movimentação"
    :busy="removing"
    @confirm="confirmMovementRemoval"
    @cancel="pendingRemoval = null"
  />
</template>

<style scoped>
.statement { display: flex; flex-direction: column; gap: var(--space-5); }
.statement__summary { padding: var(--space-5); border-radius: var(--radius-md); background: var(--color-brand-soft); }
.statement__summary span, .statement__summary small { display: block; color: var(--color-brand-ink); font-size: var(--text-xs); }
.statement__summary strong { display: block; margin: var(--space-2) 0; color: var(--color-brand); font-size: var(--text-2xl); }
.statement__summary button { display: flex; width: 100%; padding: var(--space-3) 0 0; margin-top: var(--space-3); align-items: center; justify-content: flex-start; gap: var(--space-2); border: 0; border-top: 1px solid color-mix(in srgb, var(--color-brand) 20%, transparent); background: transparent; color: var(--color-brand); font-size: var(--text-xs); font-weight: var(--weight-semibold); line-height: 1.25; cursor: pointer; }
.statement__summary button svg { display: block; width: 0.9rem; height: 0.9rem; flex: 0 0 auto; }
.statement__toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.statement__toolbar div { display: flex; min-width: 0; flex-direction: column; gap: var(--space-1); }
.statement__toolbar strong { color: var(--color-ink); font-size: var(--text-sm); }
.statement__toolbar span { color: var(--color-ink-muted); font-size: 0.6875rem; }
.statement-form { display: flex; padding: var(--space-4); flex-direction: column; gap: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.statement-form header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.statement-form header div { display: flex; flex-direction: column; gap: var(--space-1); }
.statement-form header strong { color: var(--color-ink); font-size: var(--text-sm); }
.statement-form header span { color: var(--color-ink-muted); font-size: 0.6875rem; }
.statement-form header button { padding: 0; border: 0; background: transparent; color: var(--color-ink-muted); font-size: var(--text-xs); cursor: pointer; }
.statement-form__field { display: flex; flex-direction: column; gap: var(--space-2); color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.statement-form__field select, .statement-form__field textarea, .statement-form__money { min-height: 2.5rem; padding: 0 var(--space-3); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; font-weight: var(--weight-regular); }
.statement-form__field textarea { padding-block: var(--space-3); resize: vertical; }
.statement-form__money { display: flex; align-items: center; gap: var(--space-2); color: var(--color-ink-muted); }
.statement-form__money input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-ink); }
.statement-form__error { color: var(--color-negative); font-size: var(--text-xs); }
.statement__loading { display: grid; gap: var(--space-3); }
.statement-list { display: flex; padding: 0; margin: 0; flex-direction: column; list-style: none; }
.statement-entry { display: flex; padding: var(--space-4) 0; align-items: flex-start; gap: var(--space-3); border-bottom: 1px solid var(--color-border); }
.statement-entry__icon { display: grid; width: 2rem; height: 2rem; flex: 0 0 auto; place-items: center; border-radius: var(--radius-sm); background: var(--color-positive-soft); color: var(--color-positive-ink); }
.statement-entry__icon.is-negative { background: var(--color-negative-soft); color: var(--color-negative); }
.statement-entry__icon svg { width: 1rem; height: 1rem; }
.statement-entry__content { min-width: 0; flex: 1; }
.statement-entry__title, .statement-entry__meta { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.statement-entry__title strong { color: var(--color-ink); font-size: var(--text-xs); }
.statement-entry__title > span { color: var(--color-positive-ink); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.statement-entry__title > span.is-negative { color: var(--color-negative); }
.statement-entry__meta { margin-top: var(--space-1); justify-content: flex-start; color: var(--color-ink-muted); font-size: 0.6875rem; }
.statement-entry__status { padding: 0.1rem var(--space-2); border-radius: var(--radius-pill); }
.statement-entry__status.is-estimated { background: var(--color-warning-soft); color: var(--color-warning); }
.statement-entry__status.is-confirmed { background: var(--color-positive-soft); color: var(--color-positive-ink); }
.statement-entry__content small { display: block; margin-top: var(--space-1); color: var(--color-ink-muted); font-size: 0.6875rem; }
.statement-entry__actions { display: flex; gap: var(--space-1); }
.statement-entry__actions button { display: grid; width: 1.8rem; height: 1.8rem; padding: 0; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.statement-entry__actions .statement-entry__edit { display: inline-flex; width: auto; padding: 0 var(--space-2); gap: var(--space-1); font-size: 0.6875rem; }
.statement-entry__actions button:hover { background: var(--color-surface-subtle); color: var(--color-ink); }
.statement-entry__actions svg { width: 0.9rem; height: 0.9rem; }
</style>
