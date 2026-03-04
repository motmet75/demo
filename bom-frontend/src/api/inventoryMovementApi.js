import { apiFetch, apiFetchJson } from './client'

export async function fetchMovements(options = {}) {
  const params = new URLSearchParams()
  if (options.tenantId) params.set('tenantId', options.tenantId)
  if (options.companyId) params.set('companyId', options.companyId)
  if (options.movementType) params.set('movementType', options.movementType)
  if (options.materialId) params.set('materialId', options.materialId)
  const qs = params.toString()
  const url = `/bom/api/inventory-movements${qs ? '?' + qs : ''}`
  const headers = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(url, { headers })
  if (!res.ok) return []
  return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : [])
}

export async function recordMovementIn(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson('/bom/api/inventory-movements/in', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to record IN movement')
  return data
}

export async function recordMovementOut(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson('/bom/api/inventory-movements/out', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to record OUT movement')
  return data
}

export async function recordMovementTransfer(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson('/bom/api/inventory-movements/transfer', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to record TRANSFER movement')
  return data
}

export async function recordMovementAdjustment(payload, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson('/bom/api/inventory-movements/adjustment', { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to record ADJUSTMENT movement')
  return data
}

export async function deleteMovement(id) {
  const res = await apiFetch(`/bom/api/inventory-movements/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete movement')
}
