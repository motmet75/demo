import { apiFetch, apiFetchJson } from './client'

function buildUrl(base, params = {}) {
  const search = new URLSearchParams()
  if (params.tenantId) search.set('tenantId', params.tenantId)
  if (params.companyId) search.set('companyId', params.companyId)
  const q = search.toString()
  return q ? `${base}?${q}` : base
}

export async function fetchContracts() {
  const { res, data } = await apiFetchJson('/bom/api/contracts')
  if (!res.ok) {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error('Failed to fetch contracts: ' + res.status + ' ' + text)
  }
  return data
}

export async function updateContract(id, payload) {
  const url = buildUrl(`/bom/api/contracts/${encodeURIComponent(id)}`, { tenantId: payload.tenantId, companyId: payload.companyId })
  const body = { ...payload }
  // remove the transient helper ids from body
  delete body.tenantId
  delete body.companyId
  delete body.supplierCompanyId
  delete body.purchasingCompanyId

  const { res, data } = await apiFetchJson(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error('Failed to update: ' + res.status + ' ' + text)
  }
  return data
}

export async function deleteContract(id) {
  const res = await apiFetch('/bom/api/contracts/' + id, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error('Failed to delete: ' + res.status + ' ' + text)
  }
  return true
}

export async function createContract(payload) {
  const url = buildUrl('/bom/api/contracts', { tenantId: payload.tenantId, companyId: payload.companyId })
  const body = { ...payload }
  delete body.tenantId
  delete body.companyId
  delete body.supplierCompanyId
  delete body.purchasingCompanyId

  const { res, data } = await apiFetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    throw new Error('Failed to create: ' + res.status + ' ' + text)
  }
  return data
}