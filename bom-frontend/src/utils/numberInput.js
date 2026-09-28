const usInteger = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function formatIntegerInput(value) {
  if (value == null || value === '') return ''
  const raw = String(value)
  const negative = raw.startsWith('-')
  const digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return negative ? '-' : ''
  return `${negative ? '-' : ''}${usInteger.format(Number(digits))}`
}

export function parseIntegerInput(value, allowNegative = false) {
  const raw = String(value || '').trim()
  const negative = allowNegative && raw.startsWith('-')
  const digits = raw.replace(/[^0-9]/g, '')
  return digits ? `${negative ? '-' : ''}${digits}` : negative ? '-' : ''
}

export function formatQuantityInput(value, maximumFractionDigits = 4) {
  if (value == null || value === '') return ''
  const raw = String(value)
  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const decimalAt = unsigned.indexOf('.')
  const integerDigits = (decimalAt >= 0 ? unsigned.slice(0, decimalAt) : unsigned)
      .replace(/[^0-9]/g, '') || '0'
  const decimalDigits = decimalAt >= 0
      ? unsigned.slice(decimalAt + 1).replace(/[^0-9]/g, '').slice(0, maximumFractionDigits)
      : ''
  const grouped = usInteger.format(Number(integerDigits))
  return `${negative ? '-' : ''}${grouped}${decimalAt >= 0 ? `.${decimalDigits}` : ''}`
}

export function parseQuantityInput(
    value,
    { allowNegative = false, maximumFractionDigits = 4 } = {}
) {
  const raw = String(value || '').trim()
  const negative = allowNegative && raw.startsWith('-')
  const unsigned = raw.replace(/^-/, '').replace(/\s/g, '').replace(/,/g, '')
  const dotAt = unsigned.indexOf('.')
  const integerDigits = (dotAt >= 0 ? unsigned.slice(0, dotAt) : unsigned)
      .replace(/[^0-9]/g, '')
  const decimalDigits = dotAt >= 0
      ? unsigned.slice(dotAt + 1).replace(/[^0-9]/g, '').slice(0, maximumFractionDigits)
      : ''

  if (!integerDigits && dotAt < 0) return negative ? '-' : ''

  return `${negative ? '-' : ''}${integerDigits || '0'}${dotAt >= 0 ? `.${decimalDigits}` : ''}`
}

export function moneyInputSuggestions(value, maximum = Number.POSITIVE_INFINITY) {
  const base = Number(parseIntegerInput(value))
  if (!Number.isFinite(base) || base <= 0) return []
  return [...new Set([base * 100, base * 1000])].filter(candidate => candidate < maximum)
}