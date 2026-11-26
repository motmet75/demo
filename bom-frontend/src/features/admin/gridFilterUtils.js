// Shared helpers for the client-side filter + sort on the website content grids.

/** Lower-case and strip Vietnamese accents, so "ca phe" matches "Cà phê". */
export const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()

export const blank = value => !String(value ?? '').trim() || String(value).trim().toLowerCase() === 'none'

/** Distinct non-empty values of get(row) with how many rows have each, sorted by label. */
export function countedOptions(rows, get, labelFor = v => v) {
  const seen = new Map()
  rows.forEach(r => { const v = get(r); if (!blank(v)) seen.set(v, (seen.get(v) || 0) + 1) })
  return [...seen.entries()].map(([value, count]) => ({ value, count }))
    .sort((a, b) => String(labelFor(a.value)).localeCompare(String(labelFor(b.value)), 'vi'))
}

/** Every word of the typed text must appear in the folded haystack. */
export function matchesWords(text, haystack) {
  const words = fold(text).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const h = fold(haystack)
  return words.every(w => h.includes(w))
}

/** Stable sort of rows by column.get(row) in dir ('asc' | 'desc'). */
export function sortRows(rows, get, dir) {
  const sign = dir === 'asc' ? 1 : -1
  return rows.map((r, i) => ({ r, i, v: get(r) }))
    .sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : 0) * sign || a.i - b.i)
    .map(x => x.r)
}

/** Clicking the sorted column flips it; a new column starts descending for numbers/dates, else ascending. */
export const nextSort = (cur, key, descFirst) => cur.key === key
  ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
  : { key, dir: descFirst.includes(key) ? 'desc' : 'asc' }

const pad = n => String(n).padStart(2, '0')
/** Current time in Asia/Ho_Chi_Minh (UTC+7, no DST) plus minutes, as a datetime-local value. */
export const vietnamNowPlus = minutes => {
  const d = new Date(Date.now() + (7 * 60 + minutes) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Post-time windows; t and now are Vietnam-time "YYYY-MM-DDTHH:mm" strings, so plain string compare works. */
export const WHEN_FILTERS = [
  { value: '', label: 'Mọi thời gian' },
  { value: 'upcoming', label: 'Sắp đăng', test: (t, now) => t >= now },
  { value: 'today', label: 'Hôm nay', test: (t, now) => t.slice(0, 10) === now.slice(0, 10) },
  { value: 'next7', label: '7 ngày tới', test: (t, now) => t >= now && t <= vietnamNowPlus(7 * 24 * 60) },
  { value: 'last7', label: '7 ngày qua', test: (t, now) => t < now && t >= vietnamNowPlus(-7 * 24 * 60) },
  { value: 'past', label: 'Đã qua', test: (t, now) => t < now },
]
