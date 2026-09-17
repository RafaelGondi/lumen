<script setup lang="ts">
import { Landmark } from '@lucide/vue'
import type { Category } from '~/types/category'
import { formatDateBr, parseDateBr } from '~/utils/dateMoney'

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })
const categories = ref<Category[]>([])
const name = ref('')
const creditor = ref('')
const startDateText = ref('')
const targetDateText = ref('')
const categoryId = ref<number | null>(null)
const notes = ref('')
const saving = ref(false)
const errorMessage = ref('')
const { amountText, amountValue, handleAmountKeydown, handleAmountInput, setFromAmount } = useMoneyField()

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function resetForm() {
  name.value = ''
  creditor.value = ''
  startDateText.value = formatDateBr(todayIso())
  targetDateText.value = ''
  categoryId.value = null
  notes.value = ''
  errorMessage.value = ''
  setFromAmount(0)
  if (!categories.value.length) {
    categories.value = (await $fetch<Category[]>('/api/categories')).filter((item) => item.type === 'expense')
  }
}

watch(open, (value) => { if (value) void resetForm() })

async function save() {
  const startDate = parseDateBr(startDateText.value)
  const targetDate = targetDateText.value ? parseDateBr(targetDateText.value) : null
  if (name.value.trim().length < 2) return void (errorMessage.value = 'Informe um nome para a dívida.')
  if (!amountValue.value || amountValue.value <= 0) return void (errorMessage.value = 'Informe o saldo atual da dívida.')
  if (!startDate) return void (errorMessage.value = 'Informe a data de início.')
  if (targetDateText.value && !targetDate) return void (errorMessage.value = 'Corrija a previsão de pagamento.')
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/debts', {
      method: 'POST',
      body: {
        name: name.value.trim(), creditor: creditor.value.trim() || null,
        currentBalance: amountValue.value, startDate, targetDate,
        categoryId: categoryId.value, notes: notes.value.trim() || null,
      },
    })
    open.value = false
    emit('saved')
  }
  catch (error) {
    errorMessage.value = (error as { statusMessage?: string }).statusMessage ?? 'Não foi possível cadastrar a dívida.'
  }
  finally { saving.value = false }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Adicionar dívida">
    <form class="manual-debt-form" @submit.prevent="save">
      <div class="manual-debt-form__notice">
        <Landmark aria-hidden="true" />
        <p>Use para valores que você deve, mas que não são parcelas mensais. O cadastro não cria uma saída de caixa.</p>
      </div>
      <UiTextField v-model="name" label="Nome da dívida" placeholder="Ex.: Empréstimo do meu pai" required />
      <UiTextField v-model="creditor" label="Para quem devo" placeholder="Opcional" />
      <label class="manual-debt-form__field">
        <span>Saldo atual <b>*</b></span>
        <div class="manual-debt-form__money"><span>R$</span><input :value="amountText" inputmode="decimal" @focus="($event.target as HTMLInputElement).select()" @keydown="handleAmountKeydown" @input="handleAmountInput"></div>
      </label>
      <UiDateField v-model="startDateText" label="Data de início" required />
      <UiDateField v-model="targetDateText" label="Previsão de pagamento (opcional)" />
      <small class="manual-debt-form__hint">Sem previsão, o saldo permanece na curva até você registrar pagamentos.</small>
      <CategoriesCategoryPicker v-model="categoryId" :categories="categories" label="Categoria (opcional)" />
      <label class="manual-debt-form__field"><span>Observação</span><textarea v-model="notes" maxlength="500" placeholder="Opcional" /></label>
      <p v-if="errorMessage" class="manual-debt-form__error" role="alert">{{ errorMessage }}</p>
    </form>
    <template #footer><UiButton variant="ghost" :disabled="saving" @click="open = false">Cancelar</UiButton><UiButton :disabled="saving" @click="save">Adicionar dívida</UiButton></template>
  </UiDrawer>
</template>

<style scoped>
.manual-debt-form { display:flex; flex-direction:column; gap:var(--space-5); }
.manual-debt-form__notice { display:flex; gap:var(--space-3); padding:var(--space-4); border-radius:var(--radius-md); background:var(--color-brand-soft); color:var(--color-brand-ink); font-size:var(--text-sm); line-height:1.5; }
.manual-debt-form__notice svg { width:1.15rem; flex-shrink:0; margin-top:.1rem; }
.manual-debt-form__field { display:flex; flex-direction:column; gap:var(--space-2); color:var(--color-ink-secondary); font-size:var(--text-xs); font-weight:var(--weight-semibold); }
.manual-debt-form__field b { color:var(--color-negative); }
.manual-debt-form__money { display:flex; min-height:2.75rem; align-items:center; border:1px solid var(--color-border-strong); border-radius:var(--radius-sm); background:var(--color-surface); }
.manual-debt-form__money:focus-within { border-color:var(--color-brand); box-shadow:0 0 0 3px var(--color-brand-soft); }
.manual-debt-form__money > span { padding-left:var(--space-3); color:var(--color-ink-muted); }
.manual-debt-form__money input { width:100%; padding:0 var(--space-3); border:0; outline:0; background:transparent; color:var(--color-ink); font:inherit; font-size:var(--text-md); }
.manual-debt-form textarea { min-height:6rem; padding:var(--space-3); resize:vertical; border:1px solid var(--color-border-strong); border-radius:var(--radius-sm); font:inherit; }
.manual-debt-form__hint { margin-top:calc(var(--space-3) * -1); color:var(--color-ink-muted); font-size:var(--text-xs); }
.manual-debt-form__error { padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-negative-soft); color:var(--color-negative); font-size:var(--text-sm); }
</style>
