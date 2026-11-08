/**
 * Number input for Vietnamese accounting:
 *   1.000.000,50 = one million and a half
 * Dots group thousands; commas mark decimals. Do not silently accept US
 * grouping, which can change sales values by orders of magnitude.
 */
export function parseVnNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN
  const value = String(input ?? '').replace(/[\s\u00a0\u202f]/g, '').trim()
  if (!value) return NaN
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(value)) return NaN
  const result = Number(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(result) ? result : NaN
}

/** API/OCR returns normalized JSON/decimal values with a dot as decimal. */
export function parseMachineNumber(input) {
  if (input === '' || input == null) return NaN
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN
  const value = String(input).trim()
  if (!/^\d+(?:\.\d+)?$/.test(value)) return NaN
  const result = Number(value)
  return Number.isFinite(result) ? result : NaN
}

export function formatVnNumber(value, maximumFractionDigits = 4) {
  const parsed = typeof value === 'number' ? value : parseMachineNumber(value)
  if (!Number.isFinite(parsed)) return ''
  return new Intl.NumberFormat('vi-VN', {
    useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits
  }).format(parsed)
}
