const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

export function useCurrency() {
  function formatCurrency(value: number) {
    return currencyFormatter.format(value)
  }

  return { formatCurrency }
}
