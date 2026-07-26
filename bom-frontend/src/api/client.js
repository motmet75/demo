// Lightweight fetch wrapper that attaches tenant/company headers from localStorage
import { getCurrentLanguage, getCurrentTimeZone, getLanguageMeta } from '../i18n/translations'

const STORAGE_KEY = 'bom_app_context_v1'

export const SESSION_EXPIRED_EVENT = 'bom:session-expired'
export const SESSION_EXPIRED_RETURN_KEY = 'bom_session_expired_return_v1'

let _sessionExpiredNotified = false

// In-memory context store - updated synchronously by React components via setLiveContext().
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

export function resetSessionExpiredNotice() {
  _sessionExpiredNotified = false
}

export function consumeSessionExpiredReturnTo() {
  try {
    const value = sessionStorage.getItem(SESSION_EXPIRED_RETURN_KEY) || ''
    sessionStorage.removeItem(SESSION_EXPIRED_RETURN_KEY)
    return value
  } catch {
    return ''
  }
}

export function rememberSessionExpiredReturnTo(returnTo = currentRouteForReturn()) {
  try {
    if (returnTo && !returnTo.startsWith('/login')) {
      sessionStorage.setItem(SESSION_EXPIRED_RETURN_KEY, returnTo)
    }
  } catch {
    // ignore storage errors
  }
  return returnTo
}
function getLocaleHeaders() {
  const headers = {}
  const language = getCurrentLanguage()
  const locale = getLanguageMeta(language).locale
  const timeZone = getCurrentTimeZone()
  if (locale) headers['Accept-Language'] = locale
  if (language) headers['X-App-Language'] = language
  if (timeZone) headers['X-Time-Zone'] = timeZone
  return headers
}
export function getContextHeaders() {
  // Once React state is initialised (_contextReady), always use the live values -
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

function apiPath(url) {
  try {
    const full = url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url)
      : new URL(withApiPrefix(url), window.location.origin)
    return full.pathname.startsWith('/sapi') ? full.pathname.slice(5) || '/' : full.pathname
  } catch {
    const text = String(url || '')
    return text.startsWith('/sapi') ? text.slice(5) || '/' : text
  }
}

function isProtectedApiPath(path) {
  if (!path) return false
  if (path.startsWith('/bom/')) return true
  if (path.startsWith('/shop/staff/')) return true
  if (path.startsWith('/admin/')) return true
  return [
    '/auth/profile',
    '/auth/shop/reset',
    '/auth/shop/setup',
    '/auth/change-password',
    '/auth/last-context',
    '/auth/admin/extend-validity'
  ].some(prefix => path === prefix || path.startsWith(prefix + '/'))
}

function currentRouteForReturn() {
  if (typeof window === 'undefined') return '/'
  const base = '/bom-inventory'
  const path = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || '/'
    : window.location.pathname || '/'
  return `${path}${window.location.search || ''}${window.location.hash || ''}`
}

function notifySessionExpired(url) {
  if (_sessionExpiredNotified || typeof window === 'undefined') return
  _sessionExpiredNotified = true

  rememberSessionExpiredReturnTo()

  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { url, returnTo: currentRouteForReturn() } }))
}

function handleSessionResponse(url, res, skipSessionExpiredHandler) {
  if (skipSessionExpiredHandler || !res || res.status !== 401) return
  if (isProtectedApiPath(apiPath(url))) {
    notifySessionExpired(url)
  }
}

export async function apiFetch(url, opts = {}) {
  const { skipSessionExpiredHandler = false, ...fetchOpts } = opts
  const headers = Object.assign({}, getLocaleHeaders(), fetchOpts.headers || {}, getContextHeaders())
  const final = Object.assign({}, fetchOpts, { headers })
  const res = await fetch(withApiPrefix(url), final)
  handleSessionResponse(url, res, skipSessionExpiredHandler)
  return res
}

/**
 * Like apiFetch but never injects X-Tenant-Id / X-Company-Id headers.
 * Use this for global admin endpoints (e.g. /bom/tenants, /admin/*) that
 * must work regardless of which tenant/company the admin currently has selected.
 */
export async function apiFetchNoContext(url, opts = {}) {
  const { skipSessionExpiredHandler = false, ...fetchOpts } = opts
  const headers = Object.assign({}, getLocaleHeaders(), fetchOpts.headers || {})
  if (_liveUsername) headers['X-Username'] = _liveUsername
  const final = Object.assign({}, fetchOpts, { headers })
  const res = await fetch(withApiPrefix(url), final)
  handleSessionResponse(url, res, skipSessionExpiredHandler)
  return res
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

export async function apiFetchJsonNoContext(url, opts = {}) {
  const res = await apiFetchNoContext(url, opts)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { res, data }
}