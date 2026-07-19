import type {
  GlobalLimitKind,
  GlobalLimitPayload,
  LimitPayload,
  LimitScope,
  LimitUpdatePayload,
} from '~/types/limits'

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseMonth(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    badRequest('Mês inválido.')
  }
  return value
}

function parseScope(value: unknown): LimitScope {
  if (value === 'category' || value === 'supercategory') return value
  badRequest('Escopo inválido.')
}

function parseKind(value: unknown): GlobalLimitKind {
  if (value === 'fixed' || value === 'percentage') return value
  badRequest('Tipo de limite global inválido.')
}

function parsePositiveAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    badRequest('Informe um valor maior que zero.')
  }
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parseReferenceId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    badRequest('Referência inválida.')
  }
  return value
}

function parseRecurring(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export function parseGlobalLimitPayload(body: unknown): GlobalLimitPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>
  const kind = parseKind(raw.kind)
  const value = parsePositiveAmount(Number(raw.value))
  const effectiveFrom = parseMonth(raw.effectiveFrom)

  if (kind === 'percentage' && (value < 1 || value >= 100)) {
    badRequest('A meta de poupança deve ficar entre 1% e 99%.')
  }

  return { kind, value, effectiveFrom }
}

export function parseLimitPayload(body: unknown): LimitPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>

  return {
    scope: parseScope(raw.scope),
    referenceId: parseReferenceId(Number(raw.referenceId)),
    month: parseMonth(raw.month),
    amount: parsePositiveAmount(Number(raw.amount)),
    recurring: parseRecurring(raw.recurring),
  }
}

export function parseLimitUpdatePayload(body: unknown): LimitUpdatePayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>

  return {
    amount: parsePositiveAmount(Number(raw.amount)),
    recurring: parseRecurring(raw.recurring),
  }
}

import { parseIdParam } from './categoryPayload'