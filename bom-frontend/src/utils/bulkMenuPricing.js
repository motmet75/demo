/**
 * Price construction for menus generated from a stock selection.
 * The base price MUST be in VND: foreign-currency warehouse purchase prices
 * cannot be silently treated as local currency.
 *
 * precision: "cent" (2 digits after decimal), "1000", "10000", "100000"
 * mode: up/down/nearest
 */
export function calculateBulkMenuPrice(baseVnd, markupPercent, precision = '1000', mode = 'up') {
  const base = Number(baseVnd)
  const pct = Number(markupPercent)
  const steps = { cent: 0.01, '1000': 1000, '10000': 10000, '100000': 100000 }
  const step = steps[String(precision)]
  if (baseVnd == null || String(baseVnd).trim() === '' ||
      markupPercent == null || String(markupPercent).trim() === '' ||
      !Number.isFinite(base) || base < 0 ||
      !Number.isFinite(pct) || pct < -100 || pct > 10000 ||
      !step || !['up','down','nearest'].includes(mode)) return null
  const raw = base * (1 + pct / 100)
  if (!Number.isFinite(raw) || raw < 0) return null
  const scaled = raw / step
  // Use a small epsilon to avoid 30% floating-point exact-boundary rounding
  // incorrectly raising an already rounded value to the next 1000/10000.
  const value = mode === 'up' ? Math.ceil(scaled - 1e-9) :
    mode === 'down' ? Math.floor(scaled + 1e-9) : Math.round(scaled)
  return Math.round(value * step * 100) / 100
}

export function inventoryMenuCode(inventoryId) {
  const uuid = String(inventoryId || '').trim().toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) return ''
  return 'INV-' + uuid.replace(/-/g, '').toUpperCase()
}

export function inventoryVndUnitPrice(item) {
  if (String(item?.currency || '').trim().toUpperCase() !== 'VND') return ''
  const value = item?.unitPrice
  return value == null || Number(value) < 0 || !Number.isFinite(Number(value)) ? '' : String(value)
}

/**
 * Read the actual inventory denomination: a VND-priced batch needs no FX;
 * a USD/CAD/etc batch needs a user-reviewed VND per one unit of that
 * currency. This affects MENU pricing only; warehouse historical cost
 * and original customs invoice currency are never overwritten.
 */
export function resolveMenuInventoryVndBase(item, fxRates = {}) {
  const currency = String(item?.currency || '').trim().toUpperCase()
  const originalPrice = item?.unitPrice
  if (!currency || originalPrice == null ||
      String(originalPrice).trim() === '' ||
      !Number.isFinite(Number(originalPrice)) || Number(originalPrice) < 0) {
    return {value: null, currency, status: 'MISSING_PRICE_OR_CURRENCY', fxRate: null}
  }
  if (currency === 'VND') {
    return {value: Number(originalPrice),currency,fxRate:1,status:'VND'}
  }
  const raw = fxRates[currency]
  if (raw == null || String(raw).trim() === '' ||
      !Number.isFinite(Number(raw)) || Number(raw) <= 0) {
    return {value:null,currency,fxRate:null,status:'MISSING_FX'}
  }
  const result = Number(originalPrice)*Number(raw)
  if (!Number.isFinite(result) || result > Number.MAX_SAFE_INTEGER) {
    return {value:null,currency,fxRate:null,status:'INVALID_FX'}
  }
  return {
    value: Math.round((result+Number.EPSILON)*1e6)/1e6,
    currency,fxRate:Number(raw),status:'CONVERTED'
  }
}
