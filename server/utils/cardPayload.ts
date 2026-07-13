import type { BankKey } from '~/types/account'
import type { CardPayload } from '~/types/card'
import { bankCatalog } from '~/utils/bankCatalog'
import { roundMoney } from '~/utils/dateMoney'

const BANK_KEYS = new Set<string>([
  ...bankCatalog.map((bank) => bank.key),
  'custom',
])

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function parseDay(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 31) {
    badRequest(`${label} deve ser um dia entre 1 e 31.`)
  }
  return value
}

export function parseCardPayload(body: unknown): CardPayload {
  if (!body || typeof body !== 'object') {
    badRequest('Corpo da requisição inválido.')
  }

  const raw = body as Record<string, unknown>
  const bankKey = raw.bankKey as BankKey

  if (typeof bankKey !== 'string' || !BANK_KEYS.has(bankKey)) {
    badRequest('Banco inválido.')
  }

  const bankName =
    typeof raw.bankName === 'string' ? raw.bankName.trim() : ''
  if (!bankName || bankName.length > 60) {
    badRequest('Informe o nome do banco / emissor.')
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || name.length > 80) {
    badRequest('Informe o nome do cartão.')
  }

  const color = typeof raw.color === 'string' ? raw.color.trim() : ''
  if (!color || color.length > 32) {
    badRequest('Informe a cor do cartão.')
  }

  let lastFour: string | null = null
  if (raw.lastFour !== null && raw.lastFour !== undefined && raw.lastFour !== '') {
    const digits = String(raw.lastFour).replace(/\D/g, '')
    if (digits.length !== 4) {
      badRequest('Informe exatamente 4 dígitos finais.')
    }
    lastFour = digits
  }

  if (
    typeof raw.creditLimit !== 'number' ||
    !Number.isFinite(raw.creditLimit) ||
    raw.creditLimit < 0
  ) {
    badRequest('Informe um limite válido.')
  }

  /**
   * closingDay = dia de FECHAMENTO da fatura (não início de ciclo).
   * dueDay = dia de VENCIMENTO do boleto.
   */
  const closingDay = parseDay(raw.closingDay, 'Dia de fechamento')
  const dueDay = parseDay(raw.dueDay, 'Dia de vencimento')

  const active =
    raw.active === undefined ? true : Boolean(raw.active)

  return {
    name,
    bankKey,
    bankName,
    color,
    lastFour,
    creditLimit: roundMoney(raw.creditLimit),
    closingDay,
    dueDay,
    active,
  }
}

export function parseCardIdParam(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    badRequest('Identificador inválido.')
  }
  return id
}

/** @deprecated Preferir cardUsageSummary / buildCardInvoice. */
export function fakeCardUsedAmount(id: number, creditLimit: number): number {
  if (creditLimit <= 0) return 0
  const ratio = ((id * 37) % 28) / 100
  return roundMoney(creditLimit * ratio)
}
