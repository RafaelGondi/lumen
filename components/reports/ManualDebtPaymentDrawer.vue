<script setup lang="ts">
import { WalletCards } from '@lucide/vue'
import type { Account } from '~/types/account'
import type { ManualDebt } from '~/types/manualDebt'
import { formatDateBr, parseDateBr } from '~/utils/dateMoney'

const props = defineProps<{ debt: ManualDebt | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })
const accounts = ref<Account[]>([])
const accountId = ref<number | null>(null)
const paymentDateText = ref('')
const notes = ref('')
const saving = ref(false)
const errorMessage = ref('')
const { amountText, amountValue, handleAmountKeydown, handleAmountInput, setFromAmount } = useMoneyField()

function todayIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
watch(open, async (value) => {
  if (!value) return
  accountId.value = null; paymentDateText.value = formatDateBr(todayIso()); notes.value = ''; errorMessage.value = ''; setFromAmount(0)
  if (!accounts.value.length) accounts.value = await $fetch<Account[]>('/api/accounts')
})

async function save() {
  if (!props.debt) return
  const paymentDate = parseDateBr(paymentDateText.value)
  if (!amountValue.value || amountValue.value <= 0) return void (errorMessage.value = 'Informe o valor pago.')
  if (amountValue.value > props.debt.currentBalance) return void (errorMessage.value = 'O valor supera o saldo atual da dívida.')
  if (!paymentDate) return void (errorMessage.value = 'Informe a data do pagamento.')
  saving.value = true; errorMessage.value = ''
  try {
    await $fetch(`/api/debts/${props.debt.id}/payments`, { method:'POST', body:{ amount:amountValue.value, paymentDate, accountId:accountId.value, notes:notes.value.trim() || null } })
    open.value = false; emit('saved')
  }
  catch (error) { errorMessage.value = (error as { statusMessage?: string }).statusMessage ?? 'Não foi possível registrar o pagamento.' }
  finally { saving.value = false }
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="debt ? `Registrar pagamento · ${debt.name}` : 'Registrar pagamento'">
    <form v-if="debt" class="debt-payment" @submit.prevent="save">
      <div class="debt-payment__summary"><span>Saldo atual</span><strong><UiMoney :value="debt.currentBalance" /></strong></div>
      <div class="debt-payment__notice"><WalletCards aria-hidden="true" /><p>Selecionando uma conta, o pagamento também vira uma despesa e reduz o saldo dela. Sem conta, apenas o saldo da dívida é atualizado.</p></div>
      <label class="debt-payment__field"><span>Valor pago <b>*</b></span><div class="debt-payment__money"><span>R$</span><input :value="amountText" inputmode="decimal" @focus="($event.target as HTMLInputElement).select()" @keydown="handleAmountKeydown" @input="handleAmountInput"></div></label>
      <UiDateField v-model="paymentDateText" label="Data do pagamento" required />
      <label class="debt-payment__field"><span>Conta usada (opcional)</span><select v-model="accountId"><option :value="null">Não registrar saída em conta</option><option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }} · {{ account.bankName }}</option></select></label>
      <label class="debt-payment__field"><span>Observação</span><textarea v-model="notes" maxlength="500" placeholder="Opcional" /></label>
      <p v-if="errorMessage" class="debt-payment__error" role="alert">{{ errorMessage }}</p>
    </form>
    <template #footer><UiButton variant="ghost" :disabled="saving" @click="open = false">Cancelar</UiButton><UiButton :disabled="saving || !debt" @click="save">Registrar pagamento</UiButton></template>
  </UiDrawer>
</template>

<style scoped>
.debt-payment { display:flex; flex-direction:column; gap:var(--space-5); }
.debt-payment__summary { display:flex; justify-content:space-between; padding:var(--space-4); border:1px solid var(--color-border); border-radius:var(--radius-md); }
.debt-payment__notice { display:flex; gap:var(--space-3); padding:var(--space-4); border-radius:var(--radius-md); background:var(--color-brand-soft); color:var(--color-brand-ink); font-size:var(--text-sm); line-height:1.5; }
.debt-payment__notice svg { width:1.15rem; flex-shrink:0; margin-top:.1rem; }
.debt-payment__field { display:flex; flex-direction:column; gap:var(--space-2); color:var(--color-ink-secondary); font-size:var(--text-xs); font-weight:var(--weight-semibold); }
.debt-payment__field b { color:var(--color-negative); }
.debt-payment__money { display:flex; min-height:2.75rem; align-items:center; border:1px solid var(--color-border-strong); border-radius:var(--radius-sm); background:var(--color-surface); }
.debt-payment__money > span { padding-left:var(--space-3); color:var(--color-ink-muted); }
.debt-payment__money input { width:100%; padding:0 var(--space-3); border:0; outline:0; background:transparent; font:inherit; font-size:var(--text-md); }
.debt-payment select,.debt-payment textarea { padding:var(--space-3); border:1px solid var(--color-border-strong); border-radius:var(--radius-sm); background:var(--color-surface); color:var(--color-ink); font:inherit; }
.debt-payment textarea { min-height:6rem; resize:vertical; }
.debt-payment__error { padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-negative-soft); color:var(--color-negative); font-size:var(--text-sm); }
</style>
