import { apiFetch } from './client'

// Use apiFetch (NOT apiFetchNoContext) so X-Tenant-Id and X-Company-Id
// headers are automatically injected — matching how all other /bom/** 
// controllers receive them (same pattern as InvoiceController, CompanyController)
const base = '/bom/etl'

async function handleResponse(res) {
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

export async function runEtlQuery(sql, params = {}) {
  const res = await apiFetch(base + '/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sql, params: params ?? {} }),
  })
  return handleResponse(res)
}

export async function pingEtl() {
  const res = await apiFetch(base + '/ping', { credentials: 'include' })
  return handleResponse(res)
}

export async function testEtlPost(message = 'hello') {
  const res = await apiFetch(base + '/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ message }),
  })
  return handleResponse(res)
}

export default { runEtlQuery, pingEtl, testEtlPost }