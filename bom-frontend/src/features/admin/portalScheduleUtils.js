// Pure helpers for the Portal bulk social schedule dialog (kept apart so components stay fast-refreshable).

export const MAX_PRODUCTS = 100
export const MAX_ROUNDS = 52
export const MAX_POSTS = 2000
export const UNIT_MS = { MINUTES: 60e3, HOURS: 3600e3, DAYS: 86400e3, WEEKS: 7 * 86400e3 }

const pad = value => String(value).padStart(2, '0')
/** Date → value for <input type="datetime-local"> (browser local time). */
export const toLocalInput = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
export const fromLocalInput = value => (value ? new Date(value) : null)
export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh' } catch { return 'Asia/Ho_Chi_Minh' } }
export const fmt = value => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const plain = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const usable = value => value && String(value).trim() && String(value).trim().toLowerCase() !== 'none'
export const imageCount = product =>
  String(product.imageUrl || '').split(/\r?\n/).filter(line => usable(line)).length

/** Repeat shift for round r (0-based), same rule as the server. */
export function shiftRound(date, round, every, unit) {
  const next = new Date(date)
  if (unit === 'HOURS') next.setHours(next.getHours() + every * round)
  else next.setDate(next.getDate() + every * round * (unit === 'WEEKS' ? 7 : 1))
  return next
}

/** Fixed times of day ("8,12,19" or "08:30,19:00") → sorted [h, m] pairs, or null when invalid. */
export function parseDayTimes(raw) {
  const parts = String(raw || '').split(/[,;\s]+/).filter(Boolean)
  const out = []
  for (const part of parts) {
    const match = part.match(/^(\d{1,2})(?::(\d{2}))?$/)
    if (!match) return null
    const h = Number(match[1]); const m = Number(match[2] || 0)
    if (h > 23 || m > 59) return null
    if (!out.some(([a, b]) => a === h && b === m)) out.push([h, m])
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/** One slot per product: start + i × interval, or the next fixed times of day from the start. */
export function arrangeTimes(count, start, interval, unit, dayTimes) {
  if (dayTimes?.length) {
    const result = []
    const day = new Date(start); day.setHours(0, 0, 0, 0)
    while (result.length < count) {
      for (const [h, m] of dayTimes) {
        const slot = new Date(day); slot.setHours(h, m, 0, 0)
        if (slot >= start && result.length < count) result.push(slot)
      }
      day.setDate(day.getDate() + 1)
    }
    return result
  }
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * interval * UNIT_MS[unit]))
}

export const PARTS = [
  ['name', 'Name'], ['description', 'Short description'], ['price', 'Price'], ['code', 'Code'], ['link', 'Product link'],
]

export function buildMessage(product, parts, tenant, hashtags) {
  const lines = []
  if (parts.name && usable(product.name)) lines.push(product.name.trim())
  if (parts.description && usable(plain(product.shortDescription))) lines.push(plain(product.shortDescription))
  if (parts.price && Number(product.price) > 0) {
    const price = Number(product.price)
    const discount = Number(product.discount) || 0
    const final = discount > 0 ? Math.round(price * (100 - discount) / 100) : price
    lines.push(`Giá: ${final.toLocaleString('vi-VN')} ${product.currency || 'VND'}${discount > 0 ? ` (-${discount}%)` : ''}`)
  }
  if (parts.code && usable(product.code)) lines.push(`Mã: ${product.code.trim()}`)
  if (parts.link && usable(product.path)) {
    const path = product.path.trim()
    lines.push(path.startsWith('http') ? path : `https://${tenant}/san-pham/${path.replace(/^\/+/, '').replace(/^san-pham\//, '')}`)
  }
  if (hashtags.trim()) lines.push(hashtags.trim())
  return lines.join('\n')
}

