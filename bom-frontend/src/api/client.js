// Lightweight fetch wrapper that attaches tenant/company headers from localStorage
const STORAGE_KEY = 'bom_app_context_v1'

function getContextHeaders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    const headers = {}
    if (parsed.tenantId) headers['X-Tenant-Id'] = parsed.tenantId
    if (parsed.companyId) headers['X-Company-Id'] = parsed.companyId
    return headers
  } catch (e) {
    return {}
  }
}

export async function apiFetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, getContextHeaders())
  const final = Object.assign({}, opts, { headers })
  return fetch(url, final)
}

export async function apiFetchJson(url, opts = {}) {
  const res = await apiFetch(url, opts)
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch (e) {
    // not JSON
    data = text
  }
  return { res, data }
}