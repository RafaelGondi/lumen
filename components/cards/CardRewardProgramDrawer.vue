<script setup lang="ts">
import { ArrowUpDown, Coins, CreditCard, Landmark, Settings2, Trash2, TrendingUp } from '@lucide/vue'
import type { Account } from '~/types/account'
import type { Card } from '~/types/card'
import type { CardInvoiceDetail, CardInvoiceReward } from '~/types/cardInvoice'
import type {
  CardRewardDestination,
  CardRewardEarningBasis,
  CardRewardProgram,
  CardRewardProjection,
  CardRewardRedemption,
} from '~/types/cardReward'
import { formatDateBr, parseDateBr, roundMoney } from '~/utils/dateMoney'

const props = defineProps<{
  card: Card
  invoice: CardInvoiceDetail
}>()

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { required: true })

const program = ref<CardRewardProgram | null>(null)
const projection = ref<CardRewardProjection | null>(null)
const accounts = ref<Account[]>([])
const loading = ref(false)
const saving = ref(false)
const removing = ref(false)
const editingProgram = ref(false)
const errorMessage = ref('')
const activeSection = ref<'projection' | 'redeem' | 'adjust' | 'history'>(
  'projection',
)

const programName = ref('')
const balanceText = ref('')
const rateText = ref('0,00')
const defaultDestination = ref<CardRewardDestination>('invoice')
const earningBasis = ref<CardRewardEarningBasis>('brl')
const pointsPerUnitText = ref('1')
const projectionRateText = ref('')

const destination = ref<CardRewardDestination>('invoice')
const pointsText = ref('')
const redeemedAtText = ref('')
const accountId = ref<number | null>(null)
const notes = ref('')

const adjustmentDirection = ref<'add' | 'remove'>('add')
const adjustmentPointsText = ref('')
const adjustmentDateText = ref('')
const adjustmentReason = ref('')

type PendingRemoval =
  | { kind: 'redemption'; item: CardRewardRedemption }
  | { kind: 'legacy'; item: CardInvoiceReward }
const pendingRemoval = ref<PendingRemoval | null>(null)
const removeDialogOpen = ref(false)

const pointsValue = computed(() => {
  const digits = pointsText.value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
})
const balanceValue = computed(() => {
  const digits = balanceText.value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
})
const adjustmentPointsValue = computed(() => {
  const digits = adjustmentPointsText.value.replace(/\D/g, '')
  return digits ? Number(digits) : 0
})
const rateValue = computed(() => {
  const digits = rateText.value.replace(/\D/g, '')
  return digits ? roundMoney(Number(digits) / 100) : 0
})
const pointsPerUnitValue = computed(() => {
  const normalized = pointsPerUnitText.value.trim().replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
})
const projectionRateValue = computed(() => {
  const digits = projectionRateText.value.replace(/\D/g, '')
  return digits ? roundMoney(Number(digits) / 100) : null
})
const redemptionValue = computed(() =>
  program.value
    ? roundMoney((pointsValue.value / 1000) * program.value.valuePerThousand)
    : 0,
)
const linkedInvoiceRewardIds = computed(
  () =>
    new Set(
      (program.value?.redemptions ?? [])
        .map((item) => item.invoiceRewardId)
        .filter((id): id is number => id !== null),
    ),
)
const legacyInvoiceRewards = computed(() =>
  props.invoice.rewards.filter(
    (reward) => !linkedInvoiceRewardIds.value.has(reward.id),
  ),
)

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function maskInteger(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function maskMoney(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  const padded = (digits || '0').padStart(3, '0')
  const integer = padded
    .slice(0, -2)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integer},${padded.slice(-2)}`
}

function onIntegerInput(
  target: 'balance' | 'redemption' | 'adjustment',
  event: Event,
) {
  const input = event.target as HTMLInputElement
  const masked = maskInteger(input.value)
  if (target === 'balance') balanceText.value = masked
  else if (target === 'redemption') pointsText.value = masked
  else adjustmentPointsText.value = masked
  input.value = masked
}

function onRateInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskMoney(input.value)
  rateText.value = masked
  input.value = masked
}

function fillProgramForm() {
  programName.value = program.value?.name ?? ''
  balanceText.value = maskInteger(String(program.value?.pointsBalance ?? ''))
  rateText.value = maskMoney(
    String(Math.round((program.value?.valuePerThousand ?? 0) * 100)),
  )
  defaultDestination.value = program.value?.defaultDestination ?? 'invoice'
  earningBasis.value = program.value?.earningBasis ?? 'brl'
  pointsPerUnitText.value = String(program.value?.pointsPerUnit ?? 1).replace(
    '.',
    ',',
  )
  projectionRateText.value = program.value?.projectionCurrencyRate
    ? maskMoney(
        String(Math.round(program.value.projectionCurrencyRate * 100)),
      )
    : ''
}

function resetRedemptionForm() {
  const preferred = program.value?.defaultDestination ?? 'invoice'
  destination.value =
    preferred === 'invoice' && props.invoice.status === 'paid'
      ? 'account'
      : preferred
  pointsText.value = ''
  redeemedAtText.value = formatDateBr(todayIso())
  accountId.value = null
  notes.value = ''
}

function resetAdjustmentForm() {
  adjustmentDirection.value = 'add'
  adjustmentPointsText.value = ''
  adjustmentDateText.value = formatDateBr(todayIso())
  adjustmentReason.value = ''
}

async function loadProjection() {
  if (!program.value) {
    projection.value = null
    return
  }
  try {
    projection.value = await $fetch<CardRewardProjection>(
      `/api/cards/${props.card.id}/reward-program/projection`,
    )
  } catch {
    projection.value = null
  }
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [programData, accountsData] = await Promise.all([
      $fetch<CardRewardProgram | null>(
        `/api/cards/${props.card.id}/reward-program`,
      ),
      $fetch<Account[]>('/api/accounts'),
    ])
    program.value = programData
    accounts.value = accountsData
    editingProgram.value = !programData
    fillProgramForm()
    resetRedemptionForm()
    resetAdjustmentForm()
    await loadProjection()
  } catch (error) {
    errorMessage.value = apiError(error, 'Não foi possível carregar os pontos.')
  } finally {
    loading.value = false
  }
}

function apiError(error: unknown, fallback: string) {
  const value = error as {
    statusMessage?: string
    data?: { statusMessage?: string }
  }
  return value.data?.statusMessage ?? value.statusMessage ?? fallback
}

watch(open, (value) => {
  if (value) {
    activeSection.value = 'projection'
    void loadData()
  }
})

async function saveProgram() {
  if (!programName.value.trim()) {
    errorMessage.value = 'Informe o nome do programa de pontos.'
    return
  }
  if (rateValue.value <= 0) {
    errorMessage.value = 'Informe quanto valem mil pontos.'
    return
  }
  if (pointsPerUnitValue.value <= 0) {
    errorMessage.value = 'Informe quantos pontos o cartão acumula.'
    return
  }
  if (earningBasis.value === 'usd' && !projectionRateValue.value) {
    errorMessage.value = 'Informe uma cotação de referência para a projeção.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    program.value = await $fetch<CardRewardProgram>(
      `/api/cards/${props.card.id}/reward-program`,
      {
        method: 'PUT',
        body: {
          name: programName.value.trim(),
          pointsBalance: balanceValue.value,
          valuePerThousand: rateValue.value,
          earningBasis: earningBasis.value,
          pointsPerUnit: pointsPerUnitValue.value,
          projectionCurrencyRate:
            earningBasis.value === 'usd' ? projectionRateValue.value : null,
          defaultDestination: defaultDestination.value,
        },
      },
    )
    editingProgram.value = false
    resetRedemptionForm()
    await loadProjection()
  } catch (error) {
    errorMessage.value = apiError(
      error,
      'Não foi possível salvar o programa de pontos.',
    )
  } finally {
    saving.value = false
  }
}

function onAccountChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  accountId.value = value ? Number(value) : null
}

async function saveRedemption() {
  if (!program.value) return
  const redeemedAt = parseDateBr(redeemedAtText.value)
  if (pointsValue.value <= 0) {
    errorMessage.value = 'Informe quantos pontos deseja resgatar.'
    return
  }
  if (pointsValue.value > program.value.pointsBalance) {
    errorMessage.value = 'O resgate supera o saldo disponível de pontos.'
    return
  }
  if (!redeemedAt) {
    errorMessage.value = 'Informe uma data válida para o resgate.'
    return
  }
  if (destination.value === 'account' && !accountId.value) {
    errorMessage.value = 'Selecione a conta que receberá o dinheiro.'
    return
  }
  if (destination.value === 'invoice') {
    if (props.invoice.status === 'paid') {
      errorMessage.value = 'Esta fatura já foi paga. Escolha dinheiro em conta.'
      return
    }
    if (redemptionValue.value > props.invoice.total) {
      errorMessage.value = 'O crédito supera o valor atual da fatura.'
      return
    }
  }

  saving.value = true
  errorMessage.value = ''
  try {
    program.value = await $fetch<CardRewardProgram>(
      `/api/cards/${props.card.id}/reward-program/redemptions`,
      {
        method: 'POST',
        body: {
          destination: destination.value,
          pointsUsed: pointsValue.value,
          redeemedAt,
          invoiceMonth:
            destination.value === 'invoice' ? props.invoice.month : null,
          accountId: destination.value === 'account' ? accountId.value : null,
          notes: notes.value.trim() || null,
        },
      },
    )
    resetRedemptionForm()
    await loadProjection()
    emit('saved')
  } catch (error) {
    errorMessage.value = apiError(error, 'Não foi possível registrar o resgate.')
  } finally {
    saving.value = false
  }
}

async function saveAdjustment() {
  if (!program.value) return
  const adjustedAt = parseDateBr(adjustmentDateText.value)
  const points = adjustmentPointsValue.value
  if (points <= 0) {
    errorMessage.value = 'Informe quantos pontos deseja ajustar.'
    return
  }
  if (!adjustedAt) {
    errorMessage.value = 'Informe uma data válida para o ajuste.'
    return
  }
  if (adjustmentReason.value.trim().length < 3) {
    errorMessage.value = 'Informe o motivo da correção.'
    return
  }
  if (
    adjustmentDirection.value === 'remove' &&
    points > program.value.pointsBalance
  ) {
    errorMessage.value = 'A remoção supera o saldo disponível de pontos.'
    return
  }

  saving.value = true
  errorMessage.value = ''
  try {
    program.value = await $fetch<CardRewardProgram>(
      `/api/cards/${props.card.id}/reward-program/adjustments`,
      {
        method: 'POST',
        body: {
          pointsDelta: adjustmentDirection.value === 'add' ? points : -points,
          adjustedAt,
          reason: adjustmentReason.value.trim(),
        },
      },
    )
    resetAdjustmentForm()
    await loadProjection()
  } catch (error) {
    errorMessage.value = apiError(error, 'Não foi possível ajustar os pontos.')
  } finally {
    saving.value = false
  }
}

function requestRemoval(removal: PendingRemoval) {
  pendingRemoval.value = removal
  removeDialogOpen.value = true
}

async function confirmRemoval() {
  const removal = pendingRemoval.value
  if (!removal) return
  removing.value = true
  errorMessage.value = ''
  try {
    if (removal.kind === 'redemption') {
      await $fetch(
        `/api/cards/${props.card.id}/reward-program/redemptions/${removal.item.id}`,
        { method: 'DELETE' },
      )
    } else {
      await $fetch(
        `/api/cards/${props.card.id}/invoice/rewards/${removal.item.id}`,
        { method: 'DELETE' },
      )
    }
    removeDialogOpen.value = false
    pendingRemoval.value = null
    await loadData()
    emit('saved')
  } catch (error) {
    errorMessage.value = apiError(error, 'Não foi possível remover o resgate.')
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UiDrawer v-model:open="open" title="Pontos do cartão">
    <div class="reward-program">
      <div v-if="loading" class="reward-program__loading">
        <UiSkeleton height="7rem" />
        <UiSkeleton height="12rem" />
      </div>

      <template v-else>
        <section v-if="program" class="reward-program__balance">
          <div>
            <p>{{ program.name }}</p>
            <strong>{{ program.pointsBalance.toLocaleString('pt-BR') }} pontos</strong>
            <span>Equivalem hoje a {{ formatMoney(program.equivalentBalance) }}</span>
          </div>
          <div class="reward-program__rate">
            <span>Por mil pontos</span>
            <strong>{{ formatMoney(program.valuePerThousand) }}</strong>
            <button type="button" @click="editingProgram = !editingProgram">
              <Settings2 aria-hidden="true" />
              {{ editingProgram ? 'Fechar edição' : 'Editar programa' }}
            </button>
            <span>
              {{ program.pointsPerUnit.toLocaleString('pt-BR') }} ponto{{ program.pointsPerUnit === 1 ? '' : 's' }}
              por {{ program.earningBasis === 'usd' ? 'US$ 1' : 'R$ 1' }}
            </span>
          </div>
        </section>

        <nav
          v-if="program && !editingProgram"
          class="reward-program__tabs"
          aria-label="Ações do programa de pontos"
        >
          <button
            type="button"
            :class="{ 'is-active': activeSection === 'projection' }"
            @click="activeSection = 'projection'"
          >
            Projeção
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeSection === 'redeem' }"
            @click="activeSection = 'redeem'"
          >
            Resgatar
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeSection === 'adjust' }"
            @click="activeSection = 'adjust'"
          >
            Ajustar
          </button>
          <button
            type="button"
            :class="{ 'is-active': activeSection === 'history' }"
            @click="activeSection = 'history'"
          >
            Histórico
          </button>
        </nav>

        <form
          v-if="editingProgram"
          class="reward-program__section reward-program__config"
          @submit.prevent="saveProgram"
        >
          <div>
            <h3>{{ program ? 'Atualizar programa' : 'Cadastrar programa' }}</h3>
            <p>Use o saldo atual mostrado pelo banco ou pelo programa parceiro.</p>
          </div>
          <UiTextField
            v-model="programName"
            label="Programa de pontos"
            placeholder="Ex.: Livelo, Átomos, Esfera..."
            required
          />
          <div class="reward-program__grid">
            <label>
              <span>Saldo atual de pontos</span>
              <input
                :value="balanceText"
                inputmode="numeric"
                placeholder="0"
                required
                :disabled="Boolean(program)"
                @input="onIntegerInput('balance', $event)"
              />
            </label>
            <label>
              <span>Valor de 1.000 pontos</span>
              <div class="reward-program__money-input">
                <span>R$</span>
                <input
                  :value="rateText"
                  inputmode="decimal"
                  required
                  @input="onRateInput"
                />
              </div>
            </label>
          </div>
          <fieldset>
            <legend>Como os pontos são acumulados</legend>
            <div class="reward-program__destination">
              <button
                type="button"
                :class="{ 'is-active': earningBasis === 'brl' }"
                @click="earningBasis = 'brl'"
              >
                Por real gasto
              </button>
              <button
                type="button"
                :class="{ 'is-active': earningBasis === 'usd' }"
                @click="earningBasis = 'usd'"
              >
                Por dólar gasto
              </button>
            </div>
          </fieldset>
          <label>
            <span>
              Pontos por {{ earningBasis === 'usd' ? 'US$ 1' : 'R$ 1' }}
            </span>
            <input
              v-model="pointsPerUnitText"
              inputmode="decimal"
              placeholder="Ex.: 2,2"
              required
            />
          </label>
          <label v-if="earningBasis === 'usd'">
            <span>Cotação do dólar para projeção</span>
            <div class="reward-program__money-input">
              <span>R$</span>
              <input
                :value="projectionRateText"
                inputmode="decimal"
                placeholder="Ex.: 5,50"
                required
                @input="
                  projectionRateText = maskMoney(
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
            </div>
          </label>
          <fieldset>
            <legend>Destino mais usado</legend>
            <div class="reward-program__destination">
              <button
                type="button"
                :class="{ 'is-active': defaultDestination === 'invoice' }"
                @click="defaultDestination = 'invoice'"
              >
                <CreditCard aria-hidden="true" /> Crédito na fatura
              </button>
              <button
                type="button"
                :class="{ 'is-active': defaultDestination === 'account' }"
                @click="defaultDestination = 'account'"
              >
                <Landmark aria-hidden="true" /> Dinheiro em conta
              </button>
            </div>
          </fieldset>
          <p v-if="program" class="reward-program__hint">
            Para conciliar o saldo, use o ajuste de pontos. Assim a correção
            fica registrada no histórico.
          </p>
          <UiButton type="submit" :disabled="saving">
            {{ saving ? 'Salvando…' : 'Salvar programa' }}
          </UiButton>
        </form>

        <section
          v-if="
            program &&
            !editingProgram &&
            activeSection === 'projection'
          "
          class="reward-program__section reward-program__projection"
        >
          <div>
            <h3>Projeção de pontos</h3>
            <p>Estimativa para as próximas seis faturas já conhecidas.</p>
          </div>
          <div
            v-if="
              projection?.earningBasis === 'usd' && !projection.currencyRate
            "
            class="reward-program__empty"
          >
            <TrendingUp aria-hidden="true" />
            <strong>Defina uma cotação de referência</strong>
            <span>
              Ela é usada somente para estimar os pontos das próximas faturas.
            </span>
            <UiButton variant="secondary" @click="editingProgram = true">
              Configurar cotação
            </UiButton>
          </div>
          <template v-else-if="projection">
            <div class="reward-program__projection-summary">
              <span aria-hidden="true"><TrendingUp /></span>
              <div>
                <p>Saldo ao fim do período</p>
                <strong>
                  {{ projection.projectedBalance.toLocaleString('pt-BR') }}
                  pontos
                </strong>
                <small>
                  + {{ projection.totalProjectedPoints.toLocaleString('pt-BR') }}
                  previstos · aproximadamente
                  {{
                    formatMoney(
                      (projection.projectedBalance / 1000) *
                        program.valuePerThousand,
                    )
                  }}
                </small>
              </div>
            </div>
            <p
              v-if="
                projection.earningBasis === 'usd' &&
                projection.currencyRate
              "
              class="reward-program__projection-assumption"
            >
              Estimativa usando dólar a
              {{ formatMoney(projection.currencyRate) }}. A pontuação real usa
              a cotação informada no pagamento.
            </p>
            <div class="reward-program__projection-list">
              <article
                v-for="point in projection.points"
                :key="point.month"
              >
                <div>
                  <strong>{{ point.monthLabel }}</strong>
                  <span>{{ formatMoney(point.eligibleAmount) }} conhecidos</span>
                </div>
                <div>
                  <strong>
                    + {{ point.projectedPoints.toLocaleString('pt-BR') }} pts
                  </strong>
                  <span>
                    saldo {{ point.projectedBalance.toLocaleString('pt-BR') }}
                  </span>
                </div>
              </article>
            </div>
            <p class="reward-program__projection-note">
              A projeção considera apenas compras e parcelas já lançadas. Novas
              compras aumentarão os valores.
            </p>
          </template>
          <div v-else class="reward-program__empty">
            <TrendingUp aria-hidden="true" />
            <strong>Não foi possível calcular a projeção</strong>
            <span>Revise a configuração do programa de pontos.</span>
          </div>
        </section>

        <form
          v-if="program && !editingProgram && activeSection === 'adjust'"
          class="reward-program__section"
          @submit.prevent="saveAdjustment"
        >
          <div>
            <h3>Ajustar saldo</h3>
            <p>Corrija diferenças entre o cálculo do Lumen e o saldo do programa.</p>
          </div>
          <div class="reward-program__destination">
            <button
              type="button"
              :class="{ 'is-active': adjustmentDirection === 'add' }"
              @click="adjustmentDirection = 'add'"
            >
              Adicionar pontos
            </button>
            <button
              type="button"
              :class="{ 'is-active': adjustmentDirection === 'remove' }"
              @click="adjustmentDirection = 'remove'"
            >
              Remover pontos
            </button>
          </div>
          <label>
            <span>Quantidade de pontos</span>
            <input
              :value="adjustmentPointsText"
              inputmode="numeric"
              placeholder="Ex.: 150"
              required
              @input="onIntegerInput('adjustment', $event)"
            />
          </label>
          <UiDateField
            v-model="adjustmentDateText"
            label="Data do ajuste"
            required
          />
          <label>
            <span>Motivo da correção</span>
            <textarea
              v-model="adjustmentReason"
              maxlength="200"
              placeholder="Ex.: diferença de arredondamento do banco"
              required
            />
          </label>
          <UiButton type="submit" :disabled="saving || !adjustmentPointsValue">
            {{ saving ? 'Ajustando…' : 'Confirmar ajuste' }}
          </UiButton>
        </form>

        <section
          v-if="
            program &&
            !editingProgram &&
            activeSection === 'history' &&
            program.adjustments.length
          "
          class="reward-program__section"
        >
          <div>
            <h3>Histórico de ajustes</h3>
            <p>Correções manuais preservadas para conferência.</p>
          </div>
          <article
            v-for="adjustment in program.adjustments"
            :key="`adjustment-${adjustment.id}`"
            class="reward-program__history-item reward-program__history-item--accrual"
          >
            <span class="reward-program__history-icon" aria-hidden="true"><ArrowUpDown /></span>
            <div>
              <strong>{{ adjustment.reason }}</strong>
              <span>{{ formatDateBr(adjustment.adjustedAt) }}</span>
            </div>
            <strong
              class="reward-program__history-value"
              :class="{ 'is-negative': adjustment.pointsDelta < 0 }"
            >
              {{ adjustment.pointsDelta > 0 ? '+' : '−' }}
              {{ Math.abs(adjustment.pointsDelta).toLocaleString('pt-BR') }} pts
            </strong>
          </article>
        </section>

        <form
          v-if="program && !editingProgram && activeSection === 'redeem'"
          class="reward-program__section"
          @submit.prevent="saveRedemption"
        >
          <div>
            <h3>Novo resgate</h3>
            <p>Escolha onde o valor convertido será recebido.</p>
          </div>
          <div class="reward-program__destination">
            <button
              type="button"
              :class="{ 'is-active': destination === 'invoice' }"
              :disabled="invoice.status === 'paid'"
              @click="destination = 'invoice'"
            >
              <CreditCard aria-hidden="true" /> Crédito na fatura
            </button>
            <button
              type="button"
              :class="{ 'is-active': destination === 'account' }"
              @click="destination = 'account'"
            >
              <Landmark aria-hidden="true" /> Dinheiro em conta
            </button>
          </div>
          <div class="reward-program__grid">
            <label>
              <span>Pontos a resgatar</span>
              <input
                :value="pointsText"
                inputmode="numeric"
                placeholder="Ex.: 5.000"
                required
                @input="onIntegerInput('redemption', $event)"
              />
            </label>
            <div class="reward-program__converted">
              <span>Valor convertido</span>
              <strong>{{ redemptionValue ? formatMoney(redemptionValue) : '—' }}</strong>
            </div>
          </div>
          <div v-if="destination === 'invoice'" class="reward-program__target">
            <CreditCard aria-hidden="true" />
            <div>
              <span>Fatura de {{ invoice.monthLabel }}</span>
              <strong>Saldo atual: {{ formatMoney(invoice.total) }}</strong>
            </div>
          </div>
          <label v-else>
            <span>Conta que receberá o dinheiro</span>
            <select :value="accountId ?? ''" required @change="onAccountChange">
              <option value="" disabled>Selecione a conta...</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">
                {{ account.name }} · {{ account.bankName }}
              </option>
            </select>
          </label>
          <UiDateField v-model="redeemedAtText" label="Data do resgate" required />
          <label>
            <span>Observação</span>
            <textarea v-model="notes" maxlength="300" placeholder="Opcional" />
          </label>
          <UiButton type="submit" :disabled="saving || !pointsValue">
            {{ saving ? 'Registrando…' : 'Confirmar resgate' }}
          </UiButton>
        </form>

        <section
          v-if="
            program &&
            !editingProgram &&
            activeSection === 'history' &&
            program.accruals.length
          "
          class="reward-program__section"
        >
          <div>
            <h3>Pontos acumulados</h3>
            <p>Gerados automaticamente quando a fatura é paga.</p>
          </div>
          <article
            v-for="accrual in program.accruals"
            :key="`accrual-${accrual.id}`"
            class="reward-program__history-item reward-program__history-item--accrual"
          >
            <span class="reward-program__history-icon" aria-hidden="true"><Coins /></span>
            <div>
              <strong>Fatura {{ accrual.invoiceMonth }}</strong>
              <span>
                Base {{ formatMoney(accrual.eligibleAmount) }} ·
                {{ accrual.pointsPerUnit.toLocaleString('pt-BR') }} por
                {{ accrual.earningBasis === 'usd' ? 'US$ 1' : 'R$ 1' }}
              </span>
              <small v-if="accrual.currencyRate">
                Dólar a {{ formatMoney(accrual.currencyRate) }}
              </small>
            </div>
            <strong class="reward-program__history-value">
              + {{ accrual.pointsEarned.toLocaleString('pt-BR') }} pts
            </strong>
          </article>
        </section>

        <section
          v-if="
            program &&
            !editingProgram &&
            activeSection === 'history' &&
            (program.redemptions.length || legacyInvoiceRewards.length)
          "
          class="reward-program__section"
        >
          <div>
            <h3>Histórico de resgates</h3>
            <p>Excluir um resgate devolve os pontos e desfaz o crédito.</p>
          </div>
          <article
            v-for="redemption in program?.redemptions ?? []"
            :key="`redemption-${redemption.id}`"
            class="reward-program__history-item"
          >
            <span class="reward-program__history-icon" aria-hidden="true">
              <CreditCard v-if="redemption.destination === 'invoice'" />
              <Landmark v-else />
            </span>
            <div>
              <strong>
                {{ redemption.destination === 'invoice' ? 'Crédito na fatura' : 'Dinheiro em conta' }}
              </strong>
              <span>
                {{ redemption.pointsUsed.toLocaleString('pt-BR') }} pontos ·
                {{ formatDateBr(redemption.redeemedAt) }}
              </span>
              <small v-if="redemption.destination === 'invoice'">
                Fatura {{ redemption.invoiceMonth }}
              </small>
              <small v-else>{{ redemption.accountName }}</small>
            </div>
            <strong class="reward-program__history-value">
              {{ formatMoney(redemption.cashAmount) }}
            </strong>
            <button
              type="button"
              aria-label="Excluir resgate"
              @click="requestRemoval({ kind: 'redemption', item: redemption })"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </article>
          <article
            v-for="reward in legacyInvoiceRewards"
            :key="`legacy-${reward.id}`"
            class="reward-program__history-item"
          >
            <span class="reward-program__history-icon" aria-hidden="true"><CreditCard /></span>
            <div>
              <strong>Crédito anterior na fatura</strong>
              <span>{{ reward.program }} · {{ reward.pointsUsed.toLocaleString('pt-BR') }} pontos</span>
              <small>{{ formatDateBr(reward.creditedAt) }}</small>
            </div>
            <strong class="reward-program__history-value">{{ formatMoney(reward.creditAmount) }}</strong>
            <button
              type="button"
              aria-label="Excluir crédito anterior"
              @click="requestRemoval({ kind: 'legacy', item: reward })"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </article>
        </section>

        <div
          v-if="
            program &&
            !editingProgram &&
            activeSection === 'history' &&
            !program.adjustments.length &&
            !program.accruals.length &&
            !program.redemptions.length &&
            !legacyInvoiceRewards.length
          "
          class="reward-program__empty"
        >
          <Coins aria-hidden="true" />
          <strong>Nenhuma movimentação de pontos</strong>
          <span>Acúmulos, ajustes e resgates aparecerão aqui.</span>
        </div>

        <p v-if="errorMessage" class="reward-program__error" role="alert">
          {{ errorMessage }}
        </p>
      </template>
    </div>
  </UiDrawer>

  <UiConfirmDialog
    v-model:open="removeDialogOpen"
    title="Excluir resgate"
    description="Os pontos serão devolvidos ao saldo e o crédito correspondente será desfeito."
    confirm-label="Excluir resgate"
    :busy="removing"
    @confirm="confirmRemoval"
    @cancel="pendingRemoval = null"
  />
</template>

<style scoped>
.reward-program { display: flex; flex-direction: column; gap: var(--space-5); }
.reward-program__intro { display: flex; padding: var(--space-4); align-items: flex-start; gap: var(--space-3); border-radius: var(--radius-md); background: var(--color-brand-soft); color: var(--color-brand-ink); }
.reward-program__intro > span, .reward-program__history-icon { display: grid; width: 2.25rem; height: 2.25rem; flex-shrink: 0; place-items: center; border-radius: var(--radius-sm); background: var(--color-brand); color: white; }
.reward-program__intro svg, .reward-program__history-icon svg, .reward-program__destination svg, .reward-program__target svg, .reward-program__balance button svg, .reward-program__history-item > button svg { width: 1rem; height: 1rem; }
.reward-program__intro p, .reward-program__section > div:first-child p { color: inherit; font-size: var(--text-sm); line-height: 1.45; }
.reward-program__loading, .reward-program__section { display: flex; flex-direction: column; gap: var(--space-3); }
.reward-program__tabs { display: grid; padding: .25rem; grid-template-columns: repeat(4, 1fr); gap: .25rem; border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.reward-program__tabs button { min-height: 2.5rem; padding: 0 var(--space-2); border: 0; border-radius: calc(var(--radius-md) - .2rem); background: transparent; color: var(--color-ink-secondary); font-size: var(--text-sm); cursor: pointer; }
.reward-program__tabs button.is-active { background: var(--color-surface); color: var(--color-brand-ink); font-weight: var(--weight-semibold); box-shadow: 0 1px 3px rgb(0 0 0 / .08); }
.reward-program__balance { display: flex; padding: var(--space-5); justify-content: space-between; gap: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface-subtle); }
.reward-program__balance > div { display: flex; flex-direction: column; gap: .25rem; }
.reward-program__balance p, .reward-program__rate span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.reward-program__balance strong { color: var(--color-ink); font-size: var(--text-xl); }
.reward-program__balance > div > span { color: var(--color-positive-ink); font-size: var(--text-sm); }
.reward-program__rate { align-items: flex-end; text-align: right; }
.reward-program__rate > span:last-child { margin-top: .15rem; color: var(--color-ink-secondary); }
.reward-program__rate strong { font-size: var(--text-md); }
.reward-program__balance button { display: inline-flex; padding: .25rem 0; align-items: center; gap: var(--space-1); border: 0; background: transparent; color: var(--color-brand-ink); font-size: var(--text-xs); cursor: pointer; }
.reward-program__section { padding-top: var(--space-5); border-top: 1px solid var(--color-border); }
.reward-program__section h3 { color: var(--color-ink); font-size: var(--text-md); }
.reward-program__section > div:first-child p { margin-top: .2rem; color: var(--color-ink-muted); }
.reward-program__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.reward-program label, .reward-program fieldset { display: flex; min-width: 0; margin: 0; padding: 0; flex-direction: column; gap: var(--space-2); border: 0; }
.reward-program label > span, .reward-program legend { color: var(--color-ink-secondary); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
.reward-program input, .reward-program select, .reward-program textarea, .reward-program__money-input { width: 100%; min-height: 2.5rem; box-sizing: border-box; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font-size: var(--text-sm); }
.reward-program input, .reward-program select { padding: 0 var(--space-3); }
.reward-program input:disabled { background: var(--color-surface-subtle); color: var(--color-ink-muted); cursor: not-allowed; }
.reward-program textarea { min-height: 4.5rem; padding: var(--space-3); resize: vertical; }
.reward-program__money-input { display: flex; padding: 0 var(--space-3); align-items: center; gap: var(--space-2); }
.reward-program__money-input span { color: var(--color-ink-muted); }
.reward-program__money-input input { min-height: 0; padding: 0; border: 0; outline: 0; }
.reward-program input:focus, .reward-program select:focus, .reward-program textarea:focus, .reward-program__money-input:focus-within { outline: 2px solid var(--color-brand); outline-offset: 1px; }
.reward-program__destination { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.reward-program__destination button { display: flex; min-height: 2.75rem; padding: 0 var(--space-3); align-items: center; justify-content: center; gap: var(--space-2); border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink-secondary); font-size: var(--text-sm); cursor: pointer; }
.reward-program__destination button.is-active { border-color: var(--color-brand); background: var(--color-brand-soft); color: var(--color-brand-ink); font-weight: var(--weight-semibold); }
.reward-program__destination button:disabled { opacity: .45; cursor: not-allowed; }
.reward-program__hint { color: var(--color-warning); font-size: var(--text-xs); }
.reward-program__converted { display: flex; padding: var(--space-3); flex-direction: column; justify-content: center; gap: .25rem; border-radius: var(--radius-sm); background: var(--color-positive-soft); }
.reward-program__converted span { color: var(--color-positive-ink); font-size: var(--text-xs); }
.reward-program__converted strong { color: var(--color-positive-ink); font-size: var(--text-lg); }
.reward-program__target { display: flex; padding: var(--space-3); align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface-subtle); color: var(--color-ink-secondary); }
.reward-program__target > div { display: flex; flex-direction: column; gap: .15rem; }
.reward-program__target span { font-size: var(--text-xs); }
.reward-program__target strong { color: var(--color-ink); font-size: var(--text-sm); }
.reward-program__history-item { display: grid; padding: var(--space-3); grid-template-columns: 2.25rem minmax(0, 1fr) auto 2rem; align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.reward-program__history-item > div { display: flex; min-width: 0; flex-direction: column; gap: .15rem; }
.reward-program__history-item > div strong { color: var(--color-ink); font-size: var(--text-sm); }
.reward-program__history-item > div span, .reward-program__history-item small { color: var(--color-ink-muted); font-size: var(--text-xs); }
.reward-program__history-value { color: var(--color-positive-ink); font-size: var(--text-sm); white-space: nowrap; }
.reward-program__history-value.is-negative { color: var(--color-negative); }
.reward-program__history-item > button { display: grid; width: 2rem; height: 2rem; padding: 0; place-items: center; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--color-ink-muted); cursor: pointer; }
.reward-program__history-item > button:hover { background: var(--color-negative-soft); color: var(--color-negative); }
.reward-program__history-item--accrual { grid-template-columns: 2.25rem minmax(0, 1fr) auto; }
.reward-program__projection-summary { display: flex; padding: var(--space-4); align-items: center; gap: var(--space-3); border-radius: var(--radius-md); background: var(--color-positive-soft); }
.reward-program__projection-summary > span { display: grid; width: 2.5rem; height: 2.5rem; flex-shrink: 0; place-items: center; border-radius: var(--radius-sm); background: var(--color-positive); color: white; }
.reward-program__projection-summary svg { width: 1.15rem; height: 1.15rem; }
.reward-program__projection-summary > div { display: flex; min-width: 0; flex-direction: column; gap: .15rem; }
.reward-program__projection-summary p, .reward-program__projection-summary small { color: var(--color-positive-ink); font-size: var(--text-xs); }
.reward-program__projection-summary strong { color: var(--color-positive-ink); font-size: var(--text-xl); }
.reward-program__projection-assumption, .reward-program__projection-note { color: var(--color-ink-muted); font-size: var(--text-xs); line-height: 1.45; }
.reward-program__projection-list { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.reward-program__projection-list article { display: flex; min-height: 3.75rem; padding: var(--space-3); align-items: center; justify-content: space-between; gap: var(--space-3); background: var(--color-surface); }
.reward-program__projection-list article + article { border-top: 1px solid var(--color-border); }
.reward-program__projection-list article > div { display: flex; flex-direction: column; gap: .15rem; }
.reward-program__projection-list article > div:last-child { align-items: flex-end; text-align: right; }
.reward-program__projection-list strong { color: var(--color-ink); font-size: var(--text-sm); }
.reward-program__projection-list article > div:last-child strong { color: var(--color-positive-ink); }
.reward-program__projection-list span { color: var(--color-ink-muted); font-size: var(--text-xs); }
.reward-program__empty { display: flex; min-height: 10rem; padding: var(--space-6); flex-direction: column; align-items: center; justify-content: center; gap: var(--space-2); border: 1px dashed var(--color-border-strong); border-radius: var(--radius-md); color: var(--color-ink-muted); text-align: center; }
.reward-program__empty svg { width: 1.5rem; height: 1.5rem; }
.reward-program__empty strong { color: var(--color-ink); font-size: var(--text-sm); }
.reward-program__empty span { font-size: var(--text-xs); }
.reward-program__error { color: var(--color-negative); font-size: var(--text-xs); font-weight: var(--weight-medium); }
@media (max-width: 540px) {
  .reward-program__balance { flex-direction: column; }
  .reward-program__rate { align-items: flex-start; text-align: left; }
  .reward-program__grid, .reward-program__destination { grid-template-columns: 1fr; }
  .reward-program__history-item { grid-template-columns: 2.25rem minmax(0, 1fr) 2rem; }
  .reward-program__history-value { padding-left: calc(2.25rem + var(--space-3)); grid-column: 1 / 3; grid-row: 2; }
}
</style>
