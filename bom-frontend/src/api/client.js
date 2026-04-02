// Lightweight fetch wrapper that attaches tenant/company headers from localStorage
const STORAGE_KEY = 'bom_app_context_v1'

// In-memory context store — updated synchronously by React components via setLiveContext().
let _liveContext = { tenantId: null, companyId: null }
let _liveUsername = null

export function setLiveContext(tenantId, companyId) {
  _liveContext = { tenantId: tenantId ?? null, companyId: companyId ?? null }
}

export function setLiveUsername(username) {
  _liveUsername = username ?? null
}

export function getContextHeaders() {
  // Prefer live in-memory context; fall back to localStorage for the initial load
  const tenantId = _liveContext.tenantId
  const companyId = _liveContext.companyId

  const headers = {}

  if (tenantId || companyId) {
    if (tenantId) headers['X-Tenant-Id'] = tenantId
    if (companyId) headers['X-Company-Id'] = companyId
  } else {
    // Fallback: read from localStorage (used before the first React render)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.tenantId) headers['X-Tenant-Id'] = parsed.tenantId
        if (parsed.companyId) headers['X-Company-Id'] = parsed.companyId
      }
    } catch {
      // ignore
    }
  }

  // Always attach the logged-in username when available
  if (_liveUsername) headers['X-Username'] = _liveUsername

  return headers
}

/**
 * Ensure every relative URL goes through the /api proxy.
 * Skips URLs that already start with /api or are absolute (http/https).
 */
function withApiPrefix(url) {
  if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/api')) {
    return url
  }
  return '/api' + url
}

export async function apiFetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, getContextHeaders())
  const final = Object.assign({}, opts, { headers })
  return fetch(withApiPrefix(url), final)
}

export async function apiFetchJson(url, opts = {}) {
  const res = await apiFetch(url, opts)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON
    data = text
  }
  return { res, data }
}