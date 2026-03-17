import { apiFetch, apiFetchJson } from './client'

const BASE = '/bom/invoices'

export async function fetchInvoices({ invoiceType, status, page = 0, size = 20 } = {}, options = {}) {
  const params = new URLSearchParams()
  if (invoiceType) params.set('invoiceType', invoiceType)
  if (status) params.set('status', status)
  params.set('page', page)
  params.set('size', size)
  const headers = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(`${BASE}?${params}`, { headers })
  if (!res.ok) return { content: [], totalElements: 0 }
  return data && Array.isArray(data.content) ? data : { content: Array.isArray(data) ? data : [], totalElements: 0 }
}

export async function fetchAllInvoices(options = {}) {
  const headers = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(`${BASE}/all`, { headers })
  if (!res.ok) return []
  return Array.isArray(data) ? data : []
}

export async function createInvoice(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(BASE, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(typeof data === 'string' ? data : data?.message || 'Create failed')
  return data
}

export async function updateInvoice(id, payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(typeof data === 'string' ? data : data?.message || 'Update failed')
  return data
}

export async function deleteInvoice(id, options = {}) {
  const headers = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const res = await apiFetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Delete failed')
}
