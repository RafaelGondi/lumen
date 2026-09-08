<script setup lang="ts">
import { Coins, Trash2 } from '@lucide/vue'
import type { Card } from '~/types/card'
import type { CardInvoiceDetail, CardInvoiceReward } from '~/types/cardInvoice'
import { formatDateBr, parseDateBr, roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
  invoice: CardInvoiceDetail
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })
const program = ref('')
const pointsText = ref('')
const amountText = ref('0,00')
const creditedAtText = ref('')
const notes = ref('')
const errorMessage = ref('')
const saving = ref(false)
const removing = ref(false)
const pendingRemoval = ref<CardInvoiceReward | null>(null)
const removeDialogOpen = ref(false)

const pointsValue = computed(() => {
  const digits = pointsText.value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
})
const amountValue = computed(() => {
  const digits = amountText.value.replace(/\D/g, '')
  return digits ? roundMoney(Number(digits) / 100) : 0
})
const valuePerThousand = computed(() =>
  pointsValue.value > 0
    ? roundMoney((amountValue.value / pointsValue.value) * 1000)
    : 0,
)
const previewTotal = computed(() =>
  roundMoney(props.invoice.total - amountValue.value),
)

function todayBr() {
  const now = new Date()
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return formatDateBr(iso)
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function maskBrl(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  const padded = (digits || '0').padStart(3, '0')
  const integer = padded
    .slice(0, -2)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integer},${padded.slice(-2)}`
}

function handleAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskBrl(input.value)
  amountText.value = masked
  input.value = masked
}

function handleAmountKeydown(event: KeyboardEvent) {
  if (event.key !== 'Backspace') return
  event.preventDefault()
  const input = event.target as HTMLInputElement
  const next = maskBrl(amountText.value.replace(/\D/g, '').slice(0, -1))
  amountText.value = next
  input.value = next
}

function handlePointsInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '').slice(0, 10)
  const masked = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  pointsText.value = masked
  input.value = masked
}

function resetForm() {
  program.value = ''
  pointsText.value = ''
  amountText.value = '0,00'
  creditedAtText.value = todayBr()
  notes.value = ''
  errorMessage.value = ''
}

watch(open, (value) => {
  if (value) resetForm()
})

async function save() {
  const creditedAt = parseDateBr(creditedAtText.value)
  if (!program.value.trim()) {
    errorMessage.value = 'Informe o programa de pontos.'
    return
  }
  if (!Number.isInteger(pointsValue.value) || pointsValue.value <= 0) {
    errorMessage.value = 'Informe a quantidade de pontos utilizados.'
    return
  }
  if (amountValue.value <= 0) {
    errorMessage.value = 'Informe o valor creditado na fatura.'
    return
  }
  if (amountValue.value > props.invoice.total) {
    errorMessage.value = 'O crédito não pode superar o valor atual da fatura.'
    return
  }
  if (!creditedAt) {
    errorMessage.value = 'Informe uma data válida para o crédito.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/cards/${props.card.id}/invoice/rewards`, {
      method: 'POST',
      body: {
        month: props.invoice.month,
        program: program.value.trim(),
        pointsUsed: pointsValue.value,
        creditAmount: amountValue.value,
        creditedAt,
        notes: notes.value.trim() || null,
      },
    })
    open.value = false
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível registrar o cashback.'
  } finally {
    saving.value = false
  }
}

function requestRemoval(reward: CardInvoiceReward) {
  pendingRemoval.value = reward
  removeDialogOpen.value = true
}

async function confirmRemoval() {
  const reward = pendingRemoval.value
  if (!reward) return
  removing.value = true
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/cards/${props.card.id}/invoice/rewards/${reward.id}`,
      { method: 'DELETE' },
    )
    removeDialogOpen.value = false
    pendingRemoval.value = null
    emit('saved')
  } catch (error) {
    errorMessage.value =
      (error as { statusMessage?: string }).statusMessage ??
      'Não foi possível remover o cashback.'
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Cashback com pontos">
    <div class="invoice-reward">
      <div class="invoice-reward__intro">
        <span aria-hidden="true"><Coins /></span>
        <p>
          Registre o crédito recebido na fatura sem alterar as compras ou os
          gastos por categoria.
        </p>
      </div>

      <section v-if="invoice.rewards.length" class="invoice-reward__existing">
        <p class="invoice-reward__section-title">Créditos já registrados</p>
        <article v-for="reward in invoice.rewards" :key="reward.id">
          <div>
            <strong>{{ reward.program }}</strong>
            <span>
              {{ reward.pointsUsed.toLocaleString('pt-BR') }} pontos ·
              {{ formatDateBr(reward.creditedAt) }} ·
              {{ formatMoney(roundMoney((reward.creditAmount / reward.pointsUsed) * 1000)) }}/mil
            </span>
          </div>
          <strong class="invoice-reward__credit">
            − {{ formatMoney(reward.creditAmount) }}
          </strong>
          <button
            type="button"
            aria-label="Remover cashback"
            @click="requestRemoval(reward)"
          >
            <Trash2 aria-hidden="true" />
          </button>
        </article>
      </section>

      <form class="invoice-reward__form" @submit.prevent="save">
        <p class="invoice-reward__section-title">Novo crédito</p>
        <UiTextField
          v-model="program"
          label="Programa de pontos"
          placeholder="Ex.: Livelo, Esfera, Átomos..."
          required
        />

        <div class="invoice-reward__grid">
          <div class="invoice-reward__field">
            <label for="reward-points">Pontos utilizados <span>*</span></label>
            <input
              id="reward-points"
              :value="pointsText"
              type="text"
              inputmode="numeric"
              placeholder="Ex.: 5.000"
              required
              @input="handlePointsInput"
            />
          </div>
          <div class="invoice-reward__field">
            <label for="reward-amount">Crédito na fatura <span>*</span></label>
            <div class="invoice-reward__money">
              <span>R$</span>
              <input
                id="reward-amount"
                :value="amountText"
                type="text"
                inputmode="decimal"
                required
                @focus="($event.target as HTMLInputElement).select()"
                @keydown="handleAmountKeydown"
                @input="handleAmountInput"
              />
            </div>
          </div>
        </div>

        <UiDateField
          v-model="creditedAtText"
          label="Data do crédito"
          required
        />

        <div class="invoice-reward__field">
          <label for="reward-notes">Observação</label>
          <textarea
            id="reward-notes"
            v-model="notes"
            maxlength="200"
            placeholder="Opcional"
          />
        </div>

        <dl class="invoice-reward__summary">
          <div>
            <dt>Valor por mil pontos</dt>
            <dd>{{ valuePerThousand ? formatMoney(valuePerThousand) : '—' }}</dd>
          </div>
          <div>
            <dt>Fatura após o crédito</dt>
            <dd>{{ formatMoney(Math.max(0, previewTotal)) }}</dd>
          </div>
        </dl>

        <p v-if="errorMessage" class="invoice-reward__error" role="alert">
          {{ errorMessage }}
        </p>
      </form>
    </div>

    <template #footer>
      <UiButton variant="ghost" :disabled="saving" @click="open = false">
        Cancelar
      </UiButton>
      <UiButton :disabled="saving" @click="save">
        {{ saving ? 'Salvando…' : 'Registrar cashback' }}
      </UiButton>
    </template>
  </UiDrawer>

  <UiConfirmDialog
    v-model:open="removeDialogOpen"
    title="Remover cashback"
    :description="`Remover o crédito de ${pendingRemoval?.program ?? 'pontos'} desta fatura?`"
    confirm-label="Remover"
    :busy="removing"
    @confirm="confirmRemoval"
    @cancel="pendingRemoval = null"
  />
</template>

<style scoped>
.invoice-reward { display: flex; flex-direction: column; gap: var(--space-5); }
.invoice-reward__intro { display: flex; padding: var(--space-4); align-items: flex-start; gap: var(--space-3); border-radius: var(--radius-md); background: var(--color-positive-soft); color: var(--color-positive-ink); }
.invoice-reward__intro > span { display: grid; width: 2rem; height: 2rem; flex-shrink: 0; place-items: center; border-radius: var(--radius-sm); background: var(--color-positive); color: white; }
.invoice-reward__intro svg { width: 1rem; height: 1rem; }
.invoice-reward__intro p { font-size: var(--text-sm); line-height: 1.45; }
.invoice-reward__existing, .invoice-reward__form { display: flex; flex-direction: column; gap: var(--space-3); }
.invoice-reward__section-title { color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.invoice-reward__existing article { display: grid; padding: var(--space-3); grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.invoice-reward__existing article > div { display: flex; min-width: 0; flex-direction: column; gap: .15rem; }
.invoice-reward__existing article strong { color: var(--color-ink); font-size: var(--text-sm); }
.invoice-reward__existing article span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.invoice-reward__existing .invoice-reward__credit { color: var(--color-positive-ink); white-space: nowrap; }
.invoice-reward__existing button { display: grid; width: 2rem; height: 2rem; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.invoice-reward__existing button:hover { background: var(--color-negative-soft); color: var(--color-negative); }
.invoice-reward__existing button svg { width: 1rem; height: 1rem; }
.invoice-reward__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.invoice-reward__field { display: flex; min-width: 0; flex-direction: column; gap: var(--space-2); }
.invoice-reward__field label { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.invoice-reward__field label span { color: var(--color-negative); }
.invoice-reward__field > input, .invoice-reward__field textarea, .invoice-reward__money { min-height: 2.5rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font-size: var(--text-sm); }
.invoice-reward__field > input { padding: 0 var(--space-3); }
.invoice-reward__field textarea { min-height: 5rem; padding: var(--space-3); resize: vertical; }
.invoice-reward__money { display: flex; padding: 0 var(--space-3); align-items: center; gap: var(--space-2); }
.invoice-reward__money span { color: var(--color-ink-muted); }
.invoice-reward__money input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--color-ink); font-size: var(--text-sm); }
.invoice-reward__field > input:focus, .invoice-reward__field textarea:focus, .invoice-reward__money:focus-within { outline: 2px solid var(--color-brand); outline-offset: 1px; }
.invoice-reward__summary { display: flex; margin: 0; padding: var(--space-4); flex-direction: column; gap: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.invoice-reward__summary div { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.invoice-reward__summary dt { color: var(--color-ink-muted); font-size: var(--text-xs); }
.invoice-reward__summary dd { margin: 0; color: var(--color-ink); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
.invoice-reward__error { color: var(--color-negative); font-size: var(--text-xs); font-weight: var(--weight-medium); }
@media (max-width: 480px) { .invoice-reward__grid { grid-template-columns: 1fr; } .invoice-reward__existing article { grid-template-columns: minmax(0, 1fr) auto; } .invoice-reward__existing button { grid-column: 2; } }
</style>
