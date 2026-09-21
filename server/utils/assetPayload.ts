import type { AssetPayload, AssetType } from '~/types/asset'
import { roundMoney } from '~/utils/dateMoney'

const ASSET_TYPES = new Set<AssetType>([
  'fgts',
  'investment',
  'reserve',
  'property',
  'vehicle',
  'other',
])

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    badRequest('Data-base inválida.')
  }
  const [year, month, day] = value.split('-').map(Number)
  const probe = new Date(year!, month! - 1, day)
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month! - 1 ||
    probe.getDate() !== day
  ) badRequest('Data-base inválida.')
  return value
}

function amount(value: unknown, label: string, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) {
    badRequest(`${label} inválido.`)
  }
  return roundMoney(value)
}

export function parseAssetId(value: string | undefined) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) badRequest('Patrimônio inválido.')
  return id
}

export function parseAssetPayload(body: unknown): AssetPayload {
  if (!body || typeof body !== 'object') badRequest('Corpo da requisição inválido.')
  const raw = body as Record<string, unknown>
  const type = raw.type as AssetType
  if (!ASSET_TYPES.has(type)) badRequest('Tipo de patrimônio inválido.')

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || name.length > 100) badRequest('Informe um nome com até 100 caracteres.')

  const balanceDate = validDate(raw.balanceDate)
  if (balanceDate > todayLocal()) badRequest('A data-base não pode estar no futuro.')

  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : ''
  if (notes.length > 500) badRequest('A observação deve ter no máximo 500 caracteres.')

  return {
    type,
    name,
    currentBalance: amount(raw.currentBalance, 'Saldo atual'),
    monthlyContribution: amount(raw.monthlyContribution, 'Aporte mensal'),
    annualYieldRate: amount(raw.annualYieldRate, 'Rendimento anual', 1000),
    balanceDate,
    notes: notes || null,
  }
}

export function parseProjectionMonths(value: unknown) {
  const months = Number(value ?? 12)
  return [6, 12, 18].includes(months) ? months : 12
}
