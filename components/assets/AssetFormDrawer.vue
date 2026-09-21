<script setup lang="ts">
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CarFront,
  ChartNoAxesCombined,
  Landmark,
} from '@lucide/vue'
import type { Asset, AssetPayload, AssetType } from '~/types/asset'
import { formatDateBr, parseDateBr } from '~/utils/dateMoney'

const props = defineProps<{ asset: Asset | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const options: Array<{
  type: AssetType
  label: string
  support: string
  icon: typeof Landmark
}> = [
  { type: 'fgts', label: 'FGTS', support: 'Saldo com uso restrito', icon: Landmark },
  { type: 'investment', label: 'Investimento', support: 'Aplicações financeiras', icon: ChartNoAxesCombined },
  { type: 'reserve', label: 'Reserva', support: 'Valor separado', icon: Banknote },
  { type: 'property', label: 'Imóvel', support: 'Casa ou terreno', icon: Building2 },
  { type: 'vehicle', label: 'Veículo', support: 'Carro ou moto', icon: CarFront },
  { type: 'other', label: 'Outro', support: 'Outro bem ou direito', icon: BriefcaseBusiness },
]

const type = ref<AssetType>('fgts')
const name = ref('FGTS')
const balanceDate = ref('')
const annualYieldRate = ref('3')
const notes = ref('')
const saving = ref(false)
const errorMessage = ref('')

const current = useMoneyField()
const monthly = useMoneyField()

watch(open, (value) => {
  if (!value) return
  const asset = props.asset
  type.value = asset?.type ?? 'fgts'
  name.value = asset?.name ?? 'FGTS'
  balanceDate.value = formatDateBr(asset?.balanceDate ?? new Date().toLocaleDateString('en-CA'))
  annualYieldRate.value = String(asset?.annualYieldRate ?? 3).replace('.', ',')
  notes.value = asset?.notes ?? ''
  current.setFromAmount(asset?.currentBalance ?? 0)
  monthly.setFromAmount(asset?.monthlyContribution ?? 0)
  errorMessage.value = ''
})

function selectType(value: AssetType) {
  type.value = value
  if (!props.asset && (name.value === 'FGTS' || !name.value.trim())) {
    name.value = options.find((item) => item.type === value)?.label ?? ''
  }
  if (!props.asset && value === 'fgts' && annualYieldRate.value === '0') {
    annualYieldRate.value = '3'
  }
}

async function save() {
  const currentBalance = current.amountValue.value
  const monthlyContribution = monthly.amountValue.value
  const parsedDate = parseDateBr(balanceDate.value)
  const rate = Number(annualYieldRate.value.replace(',', '.'))

  if (!name.value.trim()) return void (errorMessage.value = 'Informe o nome do patrimônio.')
  if (currentBalance === null || currentBalance < 0) return void (errorMessage.value = 'Saldo atual inválido.')
  if (monthlyContribution === null || monthlyContribution < 0) return void (errorMessage.value = 'Aporte mensal inválido.')
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return void (errorMessage.value = 'Rendimento anual inválido.')
  if (!parsedDate) return void (errorMessage.value = 'Informe uma data-base válida.')

  const payload: AssetPayload = {
    type: type.value,
    name: name.value.trim(),
    currentBalance,
    monthlyContribution,
    annualYieldRate: rate,
    balanceDate: parsedDate,
    notes: notes.value.trim() || null,
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await $fetch(props.asset ? `/api/assets/${props.asset.id}` : '/api/assets', {
      method: props.asset ? 'PUT' : 'POST',
      body: payload,
    })
    open.value = false
    emit('saved')
  }
  catch (error) {
    const response = error as { data?: { statusMessage?: string }; statusMessage?: string }
    errorMessage.value = response.data?.statusMessage ?? response.statusMessage ?? 'Não foi possível salvar o patrimônio.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" :title="asset ? 'Editar patrimônio' : 'Novo patrimônio'">
    <form class="asset-form" @submit.prevent="save">
      <section class="asset-form__section">
        <p class="asset-form__label">Tipo <span aria-hidden="true">*</span></p>
        <div class="asset-form__types" role="radiogroup" aria-label="Tipo de patrimônio">
          <button
            v-for="option in options"
            :key="option.type"
            type="button"
            role="radio"
            class="asset-form__type"
            :class="{ 'asset-form__type--active': type === option.type }"
            :aria-checked="type === option.type"
            @click="selectType(option.type)"
          >
            <component :is="option.icon" aria-hidden="true" />
            <span><strong>{{ option.label }}</strong><small>{{ option.support }}</small></span>
          </button>
        </div>
      </section>

      <UiTextField v-model="name" label="Nome" placeholder="Ex: FGTS da Caixa" required />

      <section class="asset-form__section">
        <p class="asset-form__label">Saldo inicial confirmado <span aria-hidden="true">*</span></p>
        <div class="asset-form__money">
          <span aria-hidden="true">R$</span>
          <input
            v-model="current.amountText.value"
            type="text"
            inputmode="decimal"
            aria-label="Saldo inicial confirmado"
            :disabled="Boolean(asset?.hasMovements)"
            @keydown="current.handleAmountKeydown"
            @input="current.handleAmountInput"
          >
        </div>
        <p class="asset-form__hint">
          {{ asset?.hasMovements
            ? 'O saldo inicial fica preservado. Faça correções pelo extrato.'
            : 'Use o extrato para corrigir valores depois desta data sem perder o histórico.' }}
        </p>
      </section>

      <UiDateField
        v-model="balanceDate"
        label="Data do saldo inicial"
        required
        :disabled="Boolean(asset?.hasMovements)"
      />

      <section class="asset-form__section">
        <p class="asset-form__label">Aporte mensal</p>
        <div class="asset-form__money">
          <span aria-hidden="true">R$</span>
          <input
            v-model="monthly.amountText.value"
            type="text"
            inputmode="decimal"
            aria-label="Aporte mensal"
            @keydown="monthly.handleAmountKeydown"
            @input="monthly.handleAmountInput"
          >
        </div>
        <p class="asset-form__hint">Quanto costuma entrar neste patrimônio a cada mês.</p>
      </section>

      <label class="asset-form__field">
        <span>Rendimento anual estimado</span>
        <div class="asset-form__rate">
          <input v-model="annualYieldRate" type="text" inputmode="decimal" aria-label="Rendimento anual estimado">
          <span>% ao ano</span>
        </div>
        <small>Use zero se quiser projetar apenas os aportes.</small>
      </label>

      <label class="asset-form__field">
        <span>Observação</span>
        <textarea v-model="notes" rows="4" maxlength="500" placeholder="Opcional" />
      </label>

      <div class="asset-form__notice">
        Este patrimônio fica separado das contas e não altera saldo, fluxo de caixa, projeção financeira ou dívidas.
      </div>

      <p v-if="errorMessage" class="asset-form__error" role="alert">{{ errorMessage }}</p>
    </form>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Cancelar</UiButton>
      <UiButton :disabled="saving" @click="save">{{ asset ? 'Salvar alterações' : 'Adicionar patrimônio' }}</UiButton>
    </template>
  </UiDrawer>
</template>

<style scoped>
.asset-form { display: flex; flex-direction: column; gap: var(--space-6); }
.asset-form__section, .asset-form__field { display: flex; flex-direction: column; gap: var(--space-2); }
.asset-form__label, .asset-form__field > span { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.asset-form__label span { color: var(--color-negative); }
.asset-form__types { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.asset-form__type { display: flex; min-height: 4rem; padding: var(--space-3); align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-ink-secondary); text-align: left; cursor: pointer; }
.asset-form__type svg { width: 1.1rem; height: 1.1rem; flex: 0 0 auto; }
.asset-form__type span { display: flex; min-width: 0; flex-direction: column; gap: var(--space-1); }
.asset-form__type strong { color: var(--color-ink); font-size: var(--text-xs); }
.asset-form__type small { color: var(--color-ink-muted); font-size: 0.6875rem; }
.asset-form__type--active { border-color: var(--color-brand); background: var(--color-brand-soft); }
.asset-form__money, .asset-form__rate { display: flex; min-height: 2.5rem; padding: 0 var(--space-3); align-items: center; gap: var(--space-2); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink-muted); font-size: var(--text-sm); }
.asset-form__money:focus-within, .asset-form__rate:focus-within, .asset-form__field textarea:focus { border-color: var(--color-brand); box-shadow: 0 0 0 3px var(--color-brand-soft); outline: none; }
.asset-form__money input, .asset-form__rate input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-ink); font-variant-numeric: tabular-nums; }
.asset-form__rate span { white-space: nowrap; }
.asset-form__hint, .asset-form__field small { color: var(--color-ink-muted); font-size: 0.6875rem; }
.asset-form__field textarea { padding: var(--space-3); resize: vertical; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; font-size: var(--text-sm); }
.asset-form__notice { padding: var(--space-4); border-radius: var(--radius-md); background: var(--color-brand-soft); color: var(--color-brand-ink); font-size: var(--text-xs); line-height: var(--leading-relaxed); }
.asset-form__error { color: var(--color-negative); font-size: var(--text-xs); font-weight: var(--weight-medium); }
@media (max-width: 420px) { .asset-form__types { grid-template-columns: 1fr; } }
</style>
