/** Soma meses preservando o dia local sem atravessar UTC. */
export function addMonthsLocal(date: string, months: number): string {
  const [yearRaw, monthRaw, dayRaw] = date.split('-').map(Number)
  const year = yearRaw!
  const month = monthRaw!
  const day = dayRaw!

  const totalMonths = year * 12 + (month - 1) + months
  const nextYear = Math.floor(totalMonths / 12)
  const nextMonth = (totalMonths % 12) + 1
  const maxDay = new Date(nextYear, nextMonth, 0).getDate()
  const nextDay = Math.min(day, maxDay)

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`
}

export function monthEndLocal(date: string): string {
  const [yearRaw, monthRaw] = date.split('-').map(Number)
  const lastDay = new Date(yearRaw!, monthRaw!, 0).getDate()
  return `${yearRaw}-${String(monthRaw).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/** Soma meses usando o último dia de cada mês quando solicitado. */
export function addMonthsScheduled(
  date: string,
  months: number,
  useMonthEnd = false,
): string {
  const shifted = addMonthsLocal(date, months)
  return useMonthEnd ? monthEndLocal(shifted) : shifted
}

export function formatDateBr(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** Máscara de digitação para dd/mm/aaaa (só dígitos, máx. 8). */
export function maskDateBr(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function parseDateBr(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const probe = new Date(year, month - 1, day)

  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Distribui o total em N parcelas sem perder centavos. */
export function splitAmount(total: number, count: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count

  return Array.from({ length: count }, (_, index) =>
    roundMoney((base + (index < remainder ? 1 : 0)) / 100),
  )
}
