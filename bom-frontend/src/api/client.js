// Lightweight fetch wrapper that attaches tenant/company headers from localStorage
const STORAGE_KEY = 'bom_app_context_v1'

// In-memory context store — updated synchronously by React components via setLiveContext().
// _contextReady becomes true once setLiveContext has been called at least once,
// meaning the React state has been initialised and the localStorage fallback
// should no longer be used (even if both values are null/cleared).
let _liveContext = { tenantId: null, companyId: null }
let _contextReady = false
let _liveUsername = null

export function setLiveContext(tenantId, companyId) {
  _liveContext = { tenantId: tenantId ?? null, companyId: companyId ?? null }
  _contextReady = true
}

export function setLiveUsername(username) {
  _liveUsername = username ?? null
}

export function getContextHeaders() {
  // Once React state is initialised (_contextReady), always use the live values —
  // even if they are null (user cleared the selectors).  This prevents stale
  // localStorage values from leaking into requests after a context switch.
  if (_contextReady) {
    const headers = {}
    if (_liveContext.tenantId)  headers['X-Tenant-Id']  = _liveContext.tenantId
    if (_liveContext.companyId) headers['X-Company-Id'] = _liveContext.companyId
    if (_liveUsername)          headers['X-Username']   = _liveUsername
    return headers
  }

  // Before first React render: fall back to localStorage so the very first
  // authenticated request already carries the saved context.
  const headers = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.tenantId)  headers['X-Tenant-Id']  = parsed.tenantId
      if (parsed.companyId) headers['X-Company-Id'] = parsed.companyId
    }
  } catch {
    // ignore
  }
  if (_liveUsername) headers['X-Username'] = _liveUsername
  return headers
}

/**
 * Ensure every relative URL goes through the /sapi proxy.
 * Skips URLs that already start with /sapi or are absolute (http/https).
 */
function withApiPrefix(url) {
  if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/sapi')) {
    return url
  }
  return '/sapi' + url
}

export async function apiFetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, getContextHeaders())
  const final = Object.assign({}, opts, { headers })
  return fetch(withApiPrefix(url), final)
}

/**
 * Like apiFetch but never injects X-Tenant-Id / X-Company-Id headers.
 * Use this for global admin endpoints (e.g. /bom/tenants, /admin/*) that
 * must work regardless of which tenant/company the admin currently has selected.
 */
export async function apiFetchNoContext(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {})
  if (_liveUsername) headers['X-Username'] = _liveUsername
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