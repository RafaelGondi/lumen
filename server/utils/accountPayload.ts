import type { AccountPayload, BankKey } from '~/types/account'
import { bankCatalog, resolveBankColor } from '~/utils/bankCatalog'

const BANK_KEYS = new Set<string>([
  ...bankCatalog.map((bank) => bank.key),
  'custom',
])

export function parseAccountPayload(body: unknown): AccountPayload {
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Corpo da requisição inválido.',
    })
  }

  const raw = body as Record<string, unknown>
  const bankKey = raw.bankKey as BankKey

  if (typeof bankKey !== 'string' || !BANK_KEYS.has(bankKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Banco inválido.',
    })
  }

  const bankName =
    typeof raw.bankName === 'string' ? raw.bankName.trim() : ''

  if (!bankName || bankName.length > 60) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o nome do banco.',
    })
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''

  if (!name || name.length > 60) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o nome da conta.',
    })
  }

  const initialBalance =
    typeof raw.initialBalance === 'number' && Number.isFinite(raw.initialBalance)
      ? Math.round(raw.initialBalance * 100) / 100
      : Number.NaN

  if (Number.isNaN(initialBalance)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Saldo inicial inválido.',
    })
  }

  return {
    bankKey,
    bankName,
    name,
    initialBalance,
  }
}

export function parseAccountIdParam(value: string | undefined): number {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Identificador inválido.',
    })
  }

  return id
}

export function accountColorFor(payload: AccountPayload): string {
  return resolveBankColor(payload.bankKey, payload.bankName)
}
