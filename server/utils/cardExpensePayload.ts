import type {
  CardExpenseEditPayload,
  CardExpensePayload,
} from '~/types/cardExpense'
import type { EntryRecurrence, EntrySeriesScope } from '~/types/entry'
import { parseDateBr, roundMoney } from '~/utils/dateMoney'

const RECURRENCES: EntryRecurrence[] = ['single', 'installment', 'fixed']
const SCOPES: EntrySeriesScope[] = ['occurrence', 'future', 'series']

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseOptionalText(value: unknown, max: number) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') badRequest('Texto inválido.')
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > max) {
    badRequest(`Texto com no máximo ${max} caracteres.`)
  }
  return trimmed
}

function parseIsoDate(value: unknown, label: string) {
  if (typeof value !== 'string') badRequest(`${label} inválida.`)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : parseDateBr(value)
  if (!normalized) badRequest(`${label} inválida.`)

  const [year, month, day] = normalized.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day!)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    badRequest(`${label} inválida.`)
  }
  return normalized
}

function parseCommon(raw: Record<string, unknown>) {
  const description =
    typeof raw.description === 'string' ? raw.description.trim() : ''
  if (!description || description.length > 120) {
    badRequest('Informe uma descrição válida.')
  }
  if (
    typeof raw.amount !== 'number' ||
    !Number.isFinite(raw.amount) ||
    raw.amount <= 0
  ) {
    badRequest('Informe um valor maior que zero.')
  }

  let categoryId: number | null = null
  if (raw.categoryId !== null && raw.categoryId !== undefined) {
    if (
      typeof raw.categoryId !== 'number' ||
      !Number.isInteger(raw.categoryId)
    ) {
      badRequest('Categoria inválida.')
    }
    categoryId = raw.categoryId
  }

  return {
    description,
    amount: roundMoney(raw.amount),
    categoryId,
    statementName: parseOptionalText(raw.statementName, 120),
    notes: parseOptionalText(raw.notes, 500),
    date: parseIsoDate(raw.date, 'Data'),
  }
}

export function parseCardExpensePayload(body: unknown): CardExpensePayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  const common = parseCommon(raw)

  if (!RECURRENCES.includes(raw.recurrence as EntryRecurrence)) {
    badRequest('Tipo de recorrência inválido.')
  }
  const recurrence = raw.recurrence as EntryRecurrence
  const useMonthEnd = recurrence !== 'single' && raw.useMonthEnd === true

  let endDate: string | null = null
  if (raw.endDate !== null && raw.endDate !== undefined && raw.endDate !== '') {
    endDate = parseIsoDate(raw.endDate, 'Data de fim')
    if (endDate < common.date) {
      badRequest('A data de fim deve ser posterior ao início.')
    }
  }

  let installmentCount: number | null = null
  if (recurrence === 'installment') {
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
    ...common,
    recurrence,
    endDate,
    installmentCount,
    useMonthEnd,
  }
}

export function parseCardExpenseEditPayload(
  body: unknown,
): CardExpenseEditPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }
  const raw = body as Record<string, unknown>
  const common = parseCommon(raw)
  if (!SCOPES.includes(raw.scope as EntrySeriesScope)) {
    badRequest('Escopo inválido.')
  }
  if (
    typeof raw.occurrenceMonth !== 'string' ||
    !/^\d{4}-\d{2}$/.test(raw.occurrenceMonth)
  ) {
    badRequest('Competência da ocorrência inválida.')
  }

  let installmentCount: number | null = null
  if (raw.installmentCount !== null && raw.installmentCount !== undefined) {
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
    ...common,
    scope: raw.scope as EntrySeriesScope,
    occurrenceMonth: raw.occurrenceMonth,
    installmentCount,
  }
}

export function parseExpenseId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    badRequest('Identificador da despesa inválido.')
  }
  return id
}

