import type { ManualDebtPayload, ManualDebtPaymentPayload } from '~/types/manualDebt'
import { roundMoney } from '~/utils/dateMoney'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function text(value: unknown, label: string, max: number, required = false) {
  if (value === null || value === undefined || value === '') {
    if (required) badRequest(`Informe ${label.toLowerCase()}.`)
    return null
  }
  if (typeof value !== 'string') badRequest(`${label} inválido.`)
  const clean = value.trim()
  if (!clean && required) badRequest(`Informe ${label.toLowerCase()}.`)
  if (!clean) return null
  if (clean.length > max) badRequest(`${label} deve ter no máximo ${max} caracteres.`)
  return clean
}

function date(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest(`${label} inválida.`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) badRequest(`${label} inválida.`)
  return value
}

function positiveAmount(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    badRequest(`Informe ${label.toLowerCase()} maior que zero.`)
  }
  return roundMoney(value)
}

function optionalId(value: unknown, label: string) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    badRequest(`${label} inválida.`)
  }
  return value
}

export function parseManualDebtPayload(body: unknown): ManualDebtPayload {
  if (!body || typeof body !== 'object') badRequest('Corpo da requisição inválido.')
  const raw = body as Record<string, unknown>
  const startDate = date(raw.startDate, 'Data de início')
  const targetDate = raw.targetDate ? date(raw.targetDate, 'Previsão de pagamento') : null
  if (targetDate && targetDate < startDate) {
    badRequest('A previsão de pagamento deve ser posterior ao início.')
  }
  return {
    name: text(raw.name, 'Nome da dívida', 120, true)!,
    creditor: text(raw.creditor, 'Credor', 120),
    currentBalance: positiveAmount(raw.currentBalance, 'Saldo atual'),
    startDate,
    targetDate,
    categoryId: optionalId(raw.categoryId, 'Categoria'),
    notes: text(raw.notes, 'Observação', 500),
  }
}

export function parseManualDebtPaymentPayload(body: unknown): ManualDebtPaymentPayload {
  if (!body || typeof body !== 'object') badRequest('Corpo da requisição inválido.')
  const raw = body as Record<string, unknown>
  return {
    amount: positiveAmount(raw.amount, 'Valor do pagamento'),
    paymentDate: date(raw.paymentDate, 'Data do pagamento'),
    accountId: optionalId(raw.accountId, 'Conta'),
    notes: text(raw.notes, 'Observação', 500),
  }
}
