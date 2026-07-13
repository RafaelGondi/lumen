import type { EntryPayload, EntryRecurrence, EntryType } from '~/types/entry'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'

const RECURRENCES: EntryRecurrence[] = ['single', 'installment', 'fixed']
const ENTRY_TYPES: EntryType[] = ['income', 'expense', 'transfer']

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseOptionalText(value: unknown, max = 200): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') badRequest('Texto inválido.')
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) badRequest(`Texto com no máximo ${max} caracteres.`)
  return trimmed
}

function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== 'string') badRequest(`${label} inválida.`)

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    const probe = new Date(y!, m! - 1, d!)
    if (
      probe.getFullYear() === y &&
      probe.getMonth() === m! - 1 &&
      probe.getDate() === d
    ) {
      return value
    }
    badRequest(`${label} inválida.`)
  }

  const fromBr = parseDateBr(value)
  if (!fromBr) badRequest(`${label} inválida.`)
  return fromBr
}

export function parseEntryPayload(body: unknown): EntryPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>

  const type =
    typeof raw.type === 'string' && ENTRY_TYPES.includes(raw.type as EntryType)
      ? (raw.type as EntryType)
      : 'income'

  if (typeof raw.accountId !== 'number' || !Number.isInteger(raw.accountId)) {
    badRequest('Conta inválida.')
  }

  let destinationAccountId: number | null = null
  if (type === 'transfer') {
    if (
      typeof raw.destinationAccountId !== 'number' ||
      !Number.isInteger(raw.destinationAccountId)
    ) {
      badRequest('Selecione a conta de destino.')
    }
    if (raw.destinationAccountId === raw.accountId) {
      badRequest('Origem e destino devem ser contas diferentes.')
    }
    destinationAccountId = raw.destinationAccountId
  }

  const description =
    typeof raw.description === 'string' ? raw.description.trim() : ''
  if (!description || description.length > 120) {
    badRequest('Informe uma descrição válida.')
  }

  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    badRequest('Informe um valor maior que zero.')
  }

  let categoryId: number | null = null
  if (raw.categoryId !== null && raw.categoryId !== undefined) {
    if (typeof raw.categoryId !== 'number' || !Number.isInteger(raw.categoryId)) {
      badRequest('Categoria inválida.')
    }
    categoryId = raw.categoryId
  }

  // Transferências nesta fase são sempre avulsas.
  let recurrence: EntryRecurrence = 'single'
  if (type !== 'transfer') {
    if (!RECURRENCES.includes(raw.recurrence as EntryRecurrence)) {
      badRequest('Tipo de recorrência inválido.')
    }
    recurrence = raw.recurrence as EntryRecurrence
  }

  const date = parseIsoDate(raw.date, 'Data')
  const useMonthEnd =
    type !== 'transfer' && recurrence !== 'single' && raw.useMonthEnd === true

  let endDate: string | null = null
  if (
    type !== 'transfer' &&
    raw.endDate !== null &&
    raw.endDate !== undefined &&
    raw.endDate !== ''
  ) {
    endDate = parseIsoDate(raw.endDate, 'Data de fim')
    if (endDate < date) badRequest('A data de fim deve ser posterior ao início.')
  }

  let installmentCount: number | null = null
  if (type !== 'transfer' && recurrence === 'installment') {
    if (
      typeof raw.installmentCount !== 'number' ||
      !Number.isInteger(raw.installmentCount) ||
      raw.installmentCount < 2 ||
      raw.installmentCount > 60
    ) {
      badRequest('Informe de 2 a 60 parcelas.')
    }
    installmentCount = raw.installmentCount
  }

  return {
    type,
    accountId: raw.accountId,
    destinationAccountId,
    description,
    amount: roundMoney(raw.amount),
    categoryId: type === 'transfer' ? null : categoryId,
    statementName: parseOptionalText(raw.statementName, 120),
    notes: parseOptionalText(raw.notes, 500),
    recurrence,
    date,
    endDate: type === 'transfer' ? null : endDate,
    installmentCount: type === 'transfer' ? null : installmentCount,
    useMonthEnd: type === 'transfer' ? false : useMonthEnd,
  }
}

/** @deprecated Use parseEntryPayload */
export function parseIncomeEntryPayload(body: unknown): EntryPayload {
  const payload = parseEntryPayload(body)
  return { ...payload, type: 'income', destinationAccountId: null }
}
