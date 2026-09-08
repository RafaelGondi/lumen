import type Database from 'better-sqlite3'
import type { Card } from '~/types/card'
import type {
  CardInvoiceCategorySpend,
  CardInvoiceDetail,
  CardInvoiceEntry,
  CardInvoiceProjectionMonth,
  CardsProjectionSummary,
} from '~/types/cardInvoice'
import { addMonthsLocal, roundMoney } from '~/utils/dateMoney'
import { cardExpensesForInvoice } from './cardExpenses'
import {
  loadAdjustmentsForCards,
  loadCardInvoiceAdjustment,
  loadCardInvoiceAdjustmentsMap,
} from './cardInvoiceAdjustment'
import {
  loadCardInvoicePayment,
  loadCardInvoicePaymentsMap,
  loadPaidTotalsForCards,
} from './cardInvoicePayment'
import {
  loadCardInvoiceRewards,
  loadCardInvoiceRewardsMap,
  loadRewardsForCards,
} from './cardInvoiceReward'

const MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]
const MONTH_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function monthParts(month: string) {
  const [year, value] = month.split('-').map(Number)
  return { year: year!, month: value! }
}

function shiftMonth(month: string, delta: number) {
  return addMonthsLocal(`${month}-01`, delta).slice(0, 7)
}

function monthLabel(month: string) {
  const { year, month: value } = monthParts(month)
  return `${MONTH_SHORT[value - 1]}/${year}`
}

function fullMonthLabel(month: string) {
  const { year, month: value } = monthParts(month)
  return `${MONTH_FULL[value - 1]} de ${year}`
}

function invoiceEntries(
  db: Database.Database,
  card: Card,
  month: string,
): CardInvoiceEntry[] {
  return cardExpensesForInvoice(db, card.id, month, card.closingDay).map(
    (occurrence) => ({
      id: occurrence.occurrenceKey,
      parentId: occurrence.parentId,
      occurrenceMonth: occurrence.occurrenceMonth,
      occurrenceIndex: occurrence.occurrenceIndex,
      description: occurrence.description,
      notes: occurrence.notes,
      date: occurrence.date,
      purchaseDate: occurrence.purchaseDate,
      amount: occurrence.amount,
      statementName: occurrence.statementName,
      recurrence: occurrence.recurrence,
      endDate: occurrence.endDate,
      installmentCount: occurrence.installmentCount,
      installmentIndex: occurrence.installmentIndex,
      useMonthEnd: occurrence.useMonthEnd,
      categoryId: occurrence.categoryId,
      categoryName: occurrence.categoryName,
      categoryColor: occurrence.categoryColor,
      categoryIcon: occurrence.categoryIcon,
      supercategoryId: occurrence.supercategoryId,
      supercategoryName: occurrence.supercategoryName,
      supercategoryColor: occurrence.supercategoryColor,
      supercategoryIcon: occurrence.supercategoryIcon,
    }),
  )
}

function buildSpendGroups(
  entries: CardInvoiceEntry[],
  pick: (entry: CardInvoiceEntry) => {
    id: string
    name: string
    color: string
  },
): CardInvoiceCategorySpend[] {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0)
  if (total <= 0) return []

  const map = new Map<string, CardInvoiceCategorySpend>()
  for (const entry of entries) {
    const group = pick(entry)
    const current = map.get(group.id)
    map.set(group.id, {
      id: group.id,
      name: group.name,
      color: group.color,
      amount: roundMoney((current?.amount ?? 0) + entry.amount),
      percent: 0,
    })
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      percent: Math.round((item.amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount)
}

function buildCategories(entries: CardInvoiceEntry[]) {
  return buildSpendGroups(entries, (entry) => ({
    id: entry.categoryName ?? 'Outros',
    name: entry.categoryName ?? 'Outros',
    color: entry.categoryColor ?? '#475d76',
  }))
}

function buildSupercategories(entries: CardInvoiceEntry[]) {
  return buildSpendGroups(entries, (entry) => ({
    id: entry.supercategoryName ?? 'Sem supercategoria',
    name: entry.supercategoryName ?? 'Sem supercategoria',
    color: entry.supercategoryColor ?? '#475d76',
  }))
}

function buildRecurrences(entries: CardInvoiceEntry[]) {
  const labels = {
    single: 'Compra avulsa',
    installment: 'Compra parcelada',
    fixed: 'Despesa fixa',
  }
  const colors = {
    single: '#4981a1',
    installment: '#896db9',
    fixed: '#bf8230',
  }

  return buildSpendGroups(entries, (entry) => ({
    id: entry.recurrence,
    name: labels[entry.recurrence],
    color: colors[entry.recurrence],
  }))
}
function dueDateInMonth(month: string, dueDay: number) {
  const { year, month: value } = monthParts(month)
  const lastDay = new Date(year, value, 0).getDate()
  const day = Math.min(dueDay, lastDay)
  return `${year}-${String(value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function openInvoiceStatus(
  month: string,
  dueDay: number,
  today: string,
): { status: CardInvoiceDetail['status']; statusLabel: string } {
  const dueDate = dueDateInMonth(month, dueDay)
  if (dueDate < today) {
    return { status: 'overdue', statusLabel: 'Vencida' }
  }
  return { status: 'open', statusLabel: 'Em aberto' }
}

function invoiceMonthAmount(
  db: Database.Database,
  card: Card,
  month: string,
  adjustments: Map<string, number>,
  rewards: Map<string, number>,
  payments: Map<string, { totalPaid: number }>,
) {
  const payment = payments.get(month)
  if (payment) return payment.totalPaid
  const entriesSubtotal = invoiceEntries(db, card, month).reduce(
    (sum, entry) => sum + entry.amount,
    0,
  )
  return roundMoney(
    Math.max(
      0,
      entriesSubtotal +
        (adjustments.get(month) ?? 0) -
        (rewards.get(month) ?? 0),
    ),
  )
}

function buildProjection(
  db: Database.Database,
  card: Card,
  focusMonth: string,
): CardInvoiceProjectionMonth[] {
  const adjustments = loadCardInvoiceAdjustmentsMap(db, card.id)
  const rewards = loadCardInvoiceRewardsMap(db, card.id)
  const payments = loadCardInvoicePaymentsMap(db, card.id)
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(focusMonth, index - 1)
    return {
      month,
      shortLabel: MONTH_SHORT[monthParts(month).month - 1]!,
      amount: invoiceMonthAmount(
        db,
        card,
        month,
        adjustments,
        rewards,
        payments,
      ),
    }
  })
  return markResidualMonths(months)
}

/** Residual: valor < R$ 150 ou ≤ 15% da média das faturas positivas. */
function markResidualMonths(
  months: CardInvoiceProjectionMonth[],
): CardInvoiceProjectionMonth[] {
  const positive = months.filter((item) => item.amount > 0)
  const average =
    positive.length > 0
      ? positive.reduce((sum, item) => sum + item.amount, 0) / positive.length
      : 0

  return months.map((item) => ({
    ...item,
    residual:
      item.amount > 0 &&
      (item.amount < 150 || item.amount <= average * 0.15),
  }))
}

/**
 * Início da cauda residual: primeiro mês a partir do qual
 * todas as faturas positivas restantes são residuais.
 * Evita marcar um mês isolado no começo (ex.: jul baixo antes de ago alto).
 */
function residualFromLabel(months: CardInvoiceProjectionMonth[]) {
  for (let index = 0; index < months.length; index += 1) {
    const tail = months.slice(index)
    const positiveTail = tail.filter((item) => item.amount > 0)
    if (positiveTail.length === 0) continue
    if (positiveTail.every((item) => item.residual)) {
      return monthLabel(positiveTail[0]!.month)
    }
  }
  return null
}

/** Janela projetada a partir do mês de referência (inclusive). */
const PROJECTION_MONTHS = 12
/** Faturas já fechadas mostradas antes dela, só como contexto. */
const PROJECTION_PAST_MONTHS = 6

/**
 * Projeção consolidada (todos os cartões): os próximos 12 meses a partir de
 * hoje, precedidos de 6 faturas já fechadas como contexto — essas ficam fora
 * de `total` e da marcação de residual. Não altera saldo de conta.
 */
export function buildConsolidatedCardsProjection(
  db: Database.Database,
  fromMonth = todayLocal().slice(0, 7),
): CardsProjectionSummary {
  const rows = db
    .prepare(
      `SELECT
         id,
         name,
         bank_key AS bankKey,
         bank_name AS bankName,
         color,
         last_four AS lastFour,
         credit_limit AS creditLimit,
         closing_day AS closingDay,
         due_day AS dueDay,
         active,
         created_at AS createdAt
       FROM cards
       WHERE active = 1`,
    )
    .all() as {
    id: number
    name: string
    bankKey: Card['bankKey']
    bankName: string
    color: string
    lastFour: string | null
    creditLimit: number
    closingDay: number
    dueDay: number
    active: number
    createdAt: string
  }[]

  const mapped: Card[] = rows.map((row) => ({
    ...row,
    active: Boolean(row.active),
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }))

  const adjustments = loadAdjustmentsForCards(
    db,
    mapped.map((card) => card.id),
  )
  const rewards = loadRewardsForCards(
    db,
    mapped.map((card) => card.id),
  )
  const paidTotals = loadPaidTotalsForCards(
    db,
    mapped.map((card) => card.id),
  )

  const monthAt = (offset: number) => {
    const month = shiftMonth(fromMonth, offset)
    let amount = 0
    let paid = 0
    /*
     * Um mês pode ficar parcialmente pago: são vários cartões, cada um com sua
     * data de fechamento e pagamento. Por isso o pago é somado por cartão, e
     * não decidido para o mês inteiro.
     */
    for (const card of mapped) {
      const paidTotal = paidTotals.get(`${card.id}:${month}`)
      if (paidTotal !== undefined) {
        amount += paidTotal
        paid += paidTotal
        continue
      }
      const entriesSubtotal = invoiceEntries(db, card, month).reduce(
        (entrySum, entry) => entrySum + entry.amount,
        0,
      )
      amount += Math.max(
        0,
        entriesSubtotal +
          (adjustments.get(`${card.id}:${month}`) ?? 0) -
          (rewards.get(`${card.id}:${month}`) ?? 0),
      )
    }
    return {
      month,
      shortLabel: MONTH_SHORT[monthParts(month).month - 1]!,
      amount: roundMoney(amount),
      paidAmount: roundMoney(paid),
    }
  }

  const openAmount = (item: { amount: number; paidAmount?: number }) =>
    roundMoney(item.amount - (item.paidAmount ?? 0))

  const projected = Array.from({ length: PROJECTION_MONTHS }, (_, index) =>
    monthAt(index),
  )
  /**
   * Histórico só para contexto no gráfico. Fica fora de `markResidualMonths`
   * e do total de propósito: fatura passada já foi paga, somá-la ao "total
   * projetado" inflaria a dívida futura, e a média usada para marcar residual
   * mudaria conforme o histórico crescesse.
   */
  const past = Array.from({ length: PROJECTION_PAST_MONTHS }, (_, index) => ({
    ...monthAt(index - PROJECTION_PAST_MONTHS),
    past: true,
  }))

  const withResidual = markResidualMonths(projected)
  /** Quitação é sobre o que falta pagar: fatura já quitada não adia nada. */
  const lastProjected = [...withResidual]
    .reverse()
    .find((item) => openAmount(item) > 0)

  return {
    months: [...past, ...withResidual],
    /*
     * Só o que falta pagar — mesma regra de `cardUsageSummary`, que alimenta o
     * "Utilizado" no topo da página. Somar fatura já quitada faria o número
     * deixar de ser dívida em aberto.
     */
    total: roundMoney(
      withResidual.reduce((sum, item) => sum + openAmount(item), 0),
    ),
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
    residualInvoicesFrom: residualFromLabel(withResidual),
  }
}

/**
 * Fatura aberta para exibição/agrupamento.
 *
 * ANTI-BUG: a soma dinâmica abaixo nunca altera saldo de conta. Na fase de
 * pagamento, o total exibido deverá ser persistido e só esse snapshot poderá
 * debitar a conta; fatura paga nunca será recalculada pela janela de datas.
 */
export function buildCardInvoice(
  db: Database.Database,
  card: Card,
  month: string,
): CardInvoiceDetail {
  const entries = invoiceEntries(db, card, month)
  const payment = loadCardInvoicePayment(db, card.id, month)
  const rewards = loadCardInvoiceRewards(db, card.id, month)
  const rewardsTotal = roundMoney(
    rewards.reduce((sum, reward) => sum + reward.creditAmount, 0),
  )
  const today = todayLocal()

  let entriesSubtotal: number
  let adjustment: number
  let adjustmentNotes: string | null
  let total: number
  let status: CardInvoiceDetail['status']
  let statusLabel: string
  let paymentInfo: CardInvoiceDetail['payment'] = null

  if (payment) {
    entriesSubtotal = payment.entriesSubtotal
    adjustment = payment.adjustment
    adjustmentNotes = payment.notes
    total = payment.totalPaid
    status = 'paid'
    statusLabel = 'Paga'
    const account = db
      .prepare('SELECT name FROM accounts WHERE id = ?')
      .get(payment.accountId) as { name: string } | undefined
    paymentInfo = {
      accountId: payment.accountId,
      accountName: account?.name ?? 'Conta',
      entryId: payment.entryId,
      paymentDate: payment.paymentDate,
      totalPaid: payment.totalPaid,
    }
  } else {
    entriesSubtotal = roundMoney(
      entries.reduce((sum, entry) => sum + entry.amount, 0),
    )
    const adjustmentRow = loadCardInvoiceAdjustment(db, card.id, month)
    adjustment = adjustmentRow?.amount ?? 0
    adjustmentNotes = adjustmentRow?.notes ?? null
    total = roundMoney(
      Math.max(0, entriesSubtotal + adjustment - rewardsTotal),
    )
    const open = openInvoiceStatus(month, card.dueDay, today)
    status = open.status
    statusLabel = open.statusLabel
  }

  const projection = buildProjection(db, card, month)
  const lastProjected = [...projection]
    .reverse()
    .find((item) => item.amount > 0)
  // Limite comprometido: fatura paga não conta; abertas usam o total atual.
  const committed = payment ? 0 : total
  const availableAmount = roundMoney(
    Math.max(0, card.creditLimit - committed),
  )
  const usedPercent =
    card.creditLimit > 0
      ? Math.min(100, Math.round((committed / card.creditLimit) * 100))
      : 0

  return {
    cardId: card.id,
    month,
    monthLabel: monthLabel(month),
    fullMonthLabel: fullMonthLabel(month),
    status,
    statusLabel,
    entriesSubtotal,
    adjustment,
    adjustmentNotes,
    rewards,
    rewardsTotal,
    total,
    creditLimit: card.creditLimit,
    usedAmount: committed,
    availableAmount,
    usedPercent,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
    residualInvoicesFrom: residualFromLabel(projection),
    payment: paymentInfo,
    projection,
    categories: buildCategories(entries),
    supercategories: buildSupercategories(entries),
    recurrences: buildRecurrences(entries),
    entries,
  }
}

/**
 * Limite comprometido e quitação estimada para a listagem de cartões.
 * Soma faturas do mês corrente em diante (parcelas futuras entram).
 * Não altera saldo de conta.
 */
export function cardUsageSummary(
  db: Database.Database,
  card: Omit<Card, 'usedAmount' | 'estimatedPayoffLabel'>,
  fromMonth = todayLocal().slice(0, 7),
) {
  const withPlaceholder: Card = {
    ...card,
    usedAmount: 0,
    estimatedPayoffLabel: null,
  }
  const paidInvoices = loadCardInvoicePaymentsMap(db, card.id)
  const cardAdjustments = loadCardInvoiceAdjustmentsMap(db, card.id)
  const cardRewards = loadCardInvoiceRewardsMap(db, card.id)
  /*
   * A janela é montada aqui, e não filtrando `buildCardInvoice().projection`:
   * aquela começa um mês antes do foco, então o filtro `>= fromMonth` deixava
   * só 11 meses e o "Utilizado" discordava do total da projeção consolidada
   * pelo valor do 12º mês.
   */
  const openProjection = Array.from(
    { length: PROJECTION_MONTHS },
    (_, index) => shiftMonth(fromMonth, index),
  )
    .filter((month) => !paidInvoices.has(month))
    .map((month) => ({
      month,
      amount: invoiceMonthAmount(
        db,
        withPlaceholder,
        month,
        cardAdjustments,
        cardRewards,
        paidInvoices,
      ),
    }))
  const usedAmount = roundMoney(
    openProjection.reduce((sum, item) => sum + item.amount, 0),
  )
  const lastProjected = [...openProjection]
    .filter((item) => item.amount > 0)
    .at(-1)

  return {
    usedAmount,
    estimatedPayoffLabel: lastProjected
      ? monthLabel(lastProjected.month)
      : null,
  }
}

