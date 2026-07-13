export type BankKey =
  | 'itau'
  | 'bradesco'
  | 'bb'
  | 'caixa'
  | 'inter'
  | 'btg'
  | 'mercadopago'
  | 'picpay'
  | 'custom'

export interface BankOption {
  key: BankKey
  name: string
  shortName: string
  color: string
}

export interface Account {
  id: number
  bankKey: BankKey
  bankName: string
  name: string
  /** Saldo exibido; por enquanto espelha o saldo inicial até existir ledger. */
  balance: number
  initialBalance: number
  color: string
}

export interface AccountPayload {
  bankKey: BankKey
  bankName: string
  name: string
  initialBalance: number
}
