import type { AssetMovementKind, AssetMovementPayload } from '~/types/asset'

const kinds = new Set<AssetMovementKind>([
  'contribution',
  'yield',
  'withdrawal',
  'adjustment_credit',
  'adjustment_debit',
  'balance_confirmation',
])

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function validDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest(`${label} inválida.`)
  }
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) {
    badRequest(`${label} inválida.`)
  }
  return value
}

export function parseAssetMovementPayload(value: unknown): AssetMovementPayload {
  const raw = (value ?? {}) as Record<string, unknown>
  const kind = raw.kind as AssetMovementKind
  if (!kinds.has(kind)) badRequest('Tipo de movimentação inválido.')

  const amount = Number(raw.amount)
  if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && kind !== 'balance_confirmation')) {
    badRequest('Informe um valor válido.')
  }

  const movementDate = validDate(raw.movementDate, 'Data da movimentação')
  if (movementDate > todayLocal()) badRequest('A movimentação não pode estar no futuro.')

  const scheduledDate = raw.scheduledDate == null || raw.scheduledDate === ''
    ? null
    : validDate(raw.scheduledDate, 'Data prevista')

  if (scheduledDate && !['contribution', 'yield'].includes(kind)) {
    badRequest('Somente aporte ou rendimento podem substituir uma previsão.')
  }

  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : ''
  if (notes.length > 500) badRequest('A observação deve ter no máximo 500 caracteres.')

  return { kind, amount, movementDate, scheduledDate, notes: notes || null }
}

export function parseAssetMovementId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) badRequest('Movimentação inválida.')
  return id
}
