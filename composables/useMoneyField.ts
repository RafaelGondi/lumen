import { roundMoney } from '~/utils/dateMoney'

export function maskBrl(value: string) {
  const digits = value
    .replace(/\D/g, '')
    .replace(/^0+(?=\d{3})/, '')
    .slice(0, 17)
  const padded = (digits || '0').padStart(3, '0')
  const integer = padded
    .slice(0, -2)
    .replace(/^0+(?=\d)/, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${integer},${padded.slice(-2)}`
}

export function parseMoneyInput(value: string) {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/R\$/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? roundMoney(amount) : null
}

export function moneyFieldFromAmount(amount: number | null | undefined) {
  if (!amount || amount <= 0) return '0,00'
  return maskBrl(String(Math.round(amount * 100)))
}

export function useMoneyField(initial = '0,00') {
  const amountText = ref(initial)

  function amountDigits(value: string) {
    return value.replace(/\D/g, '').replace(/^0+/, '')
  }

  function setMaskedAmount(input: HTMLInputElement, digits: string) {
    const masked = maskBrl(digits)
    amountText.value = masked
    input.value = masked
    input.setSelectionRange(masked.length, masked.length)
  }

  function handleAmountKeydown(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement
    const allSelected =
      input.selectionStart === 0 && input.selectionEnd === input.value.length

    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      const current = allSelected ? '' : amountDigits(amountText.value)
      if (current.length < 17) {
        setMaskedAmount(input, `${current}${event.key}`)
      }
      return
    }

    if (event.key === 'Backspace') {
      event.preventDefault()
      const current = allSelected ? '' : amountDigits(amountText.value)
      const next = current.slice(0, -1)
      setMaskedAmount(input, next || '0')
    }
  }

  function handleAmountInput(event: Event) {
    const input = event.target as HTMLInputElement
    setMaskedAmount(input, amountDigits(input.value))
  }

  function setFromAmount(amount: number | null | undefined) {
    amountText.value = moneyFieldFromAmount(amount)
  }

  const amountValue = computed(() => parseMoneyInput(amountText.value))

  return {
    amountText,
    amountValue,
    handleAmountKeydown,
    handleAmountInput,
    setFromAmount,
  }
}
