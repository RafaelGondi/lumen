/**
 * Testes unitários da máscara/parse de data BR.
 * Espelha utils/dateMoney.ts — manter em sincronia.
 */
import assert from 'node:assert/strict'

function formatDateBr(date) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function maskDateBr(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseDateBr(value) {
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

assert.equal(maskDateBr('1'), '1')
assert.equal(maskDateBr('12'), '12')
assert.equal(maskDateBr('120'), '12/0')
assert.equal(maskDateBr('1207'), '12/07')
assert.equal(maskDateBr('12072026'), '12/07/2026')
assert.equal(maskDateBr('12/07/2026abc'), '12/07/2026')
assert.equal(maskDateBr('12072026111'), '12/07/2026')

assert.equal(parseDateBr('12/07/2026'), '2026-07-12')
assert.equal(parseDateBr('31/02/2026'), null)
assert.equal(parseDateBr('99/99/9999'), null)
assert.equal(parseDateBr('12/7/2026'), null)
assert.equal(formatDateBr('2026-07-12'), '12/07/2026')

console.log('verify:date-mask ok')
