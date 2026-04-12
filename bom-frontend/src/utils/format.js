/**
 * Central number and date formatting utilities.
 * Always use 'en-US' locale so the decimal separator is a dot (.)
 * and the thousands separator is a comma (,) — regardless of the
 * browser's system locale.
 */

const LOCALE = 'en-US'

/**
 * Format a number for display (dot decimal, comma thousands).
 * @param {number|string|null|undefined} value
 * @param {number} maxDecimals  - maximum fraction digits (default 9)
 * @param {string} fallback     - returned when value is null/undefined/NaN
 */
export function fmtNum(value, maxDecimals = 9, fallback = '') {
  if (value == null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return n.toLocaleString(LOCALE, { maximumFractionDigits: maxDecimals })
}

/**
 * Format a number for qty columns (up to 4 decimal places).
 */
export function fmtQty(value, fallback = '') {
  return fmtNum(value, 4, fallback)
}

/**
 * Format a date/time string or Instant value for display.
 * @param {string|null|undefined} value  - ISO string
 * @param {string} fallback
 */
export function fmtDate(value, fallback = '') {
  if (!value) return fallback
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  return d.toLocaleString(LOCALE)
}

/**
 * DataGrid valueFormatter for numeric columns.
 * Usage: valueFormatter: numFmt
 * or:    valueFormatter: numFmt4  for 4dp
 */
export const numFmt  = (value) => fmtNum(value, 9)
export const numFmt4 = (value) => fmtNum(value, 4)

/**
 * DataGrid valueFormatter for date columns.
 */
export const dateFmt = (value) => fmtDate(value)

/**
 * Parse a US-format number string entered by the user.
 * Strips commas (thousands separator) before parsing.
 * Returns the raw string if it cannot be parsed (let the backend validate).
 */
export function parseNumInput(str) {
  if (str == null || str === '') return ''
  // Remove thousands separators (commas) so "1,234.56" → 1234.56
  const clean = String(str).replace(/,/g, '')
  const n = Number(clean)
  return Number.isFinite(n) ? n : str
}
