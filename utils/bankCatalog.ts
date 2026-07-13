import type { BankKey, BankOption } from '~/types/account'

export const bankCatalog: BankOption[] = [
  { key: 'itau', name: 'Itaú', shortName: 'Itaú', color: '#ec7000' },
  { key: 'bradesco', name: 'Bradesco', shortName: 'Bradesco', color: '#cc092f' },
  { key: 'bb', name: 'Banco do Brasil', shortName: 'BB', color: '#003d7a' },
  { key: 'caixa', name: 'Caixa', shortName: 'Caixa', color: '#0066a1' },
  { key: 'inter', name: 'Inter', shortName: 'Inter', color: '#ff7a00' },
  { key: 'btg', name: 'BTG Pactual', shortName: 'BTG', color: '#001e62' },
  {
    key: 'mercadopago',
    name: 'Mercado Pago',
    shortName: 'MP',
    color: '#00bcff',
  },
  { key: 'picpay', name: 'PicPay', shortName: 'PicPay', color: '#21c25e' },
]

export function bankByKey(key: BankKey): BankOption | undefined {
  return bankCatalog.find((bank) => bank.key === key)
}

export function bankInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()

  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

export function resolveBankColor(bankKey: BankKey, bankName: string): string {
  if (bankKey !== 'custom') {
    return bankByKey(bankKey)?.color ?? '#39465a'
  }

  const palette = [
    '#14508f',
    '#1e3a6b',
    '#39465a',
    '#5d6570',
    '#0f9b8e',
    '#2f6fce',
  ]
  let hash = 0

  for (const char of bankName) {
    hash = (hash + char.charCodeAt(0) * 17) % palette.length
  }

  return palette[hash]!
}
