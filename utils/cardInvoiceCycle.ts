import { addMonthsLocal } from '~/utils/dateMoney'

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthParts(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return { year: year!, month: month! }
}

function closingDate(year: number, month: number, cutoff: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return isoDate(year, month, Math.min(cutoff, lastDay))
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const shifted = new Date(year!, month! - 1, day! + days)
  return isoDate(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    shifted.getDate(),
  )
}

/**
 * Janela de compras da fatura de competência `year-month`.
 *
 * Ex.: fatura 2026-08, fechamento 25 → 2026-06-26..2026-07-25.
 * Estas funções agrupam a fatura aberta para exibição. Elas nunca devem
 * alterar saldo bancário nem recalcular o débito histórico de fatura paga.
 */
export function faturaDateRange(year: number, month: number, cutoff: number) {
  const invoiceMonth = isoDate(year, month, 1)
  const previousMonth = addMonthsLocal(invoiceMonth, -1)
  const twoMonthsBefore = addMonthsLocal(invoiceMonth, -2)
  const previous = monthParts(previousMonth.slice(0, 7))
  const before = monthParts(twoMonthsBefore.slice(0, 7))

  return {
    startDate: addDays(closingDate(before.year, before.month, cutoff), 1),
    endDate: closingDate(previous.year, previous.month, cutoff),
  }
}

/**
 * Define a competência da fatura para uma data efetiva de compra.
 *
 * Compra até o fechamento no mês M → fatura M+1.
 * Compra após o fechamento no mês M → fatura M+2.
 */
export function transacaoFaturaMonth(date: string, cutoff: number) {
  const [year, month, day] = date.split('-').map(Number)
  const effectiveCutoff = Math.min(cutoff, new Date(year!, month!, 0).getDate())
  const offset = day! <= effectiveCutoff ? 1 : 2
  return addMonthsLocal(date, offset).slice(0, 7)
}

/** Alias explícito para ocorrências fixas/parceladas. */
export function calcFaturaMonth(occurrenceDate: string, cutoff: number) {
  return transacaoFaturaMonth(occurrenceDate, cutoff)
}

