import { apiFetchNoContext } from './client'

async function jsonRequest(path, options = {}) {
  const res = await apiFetchNoContext(path, { credentials: 'include', ...options })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(data?.message || data?.detail || data || `Request failed (${res.status})`)
  return data
}

export const fetchGdtDefaults = () => jsonRequest('/admin/gdt-control/defaults')
export const updateGdtDefaults = (value) => jsonRequest('/admin/gdt-control/defaults', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
})
export const fetchGdtTenantPolicy = (tenantId) => jsonRequest(`/admin/gdt-control/tenants/${encodeURIComponent(tenantId)}`)
export const fetchGdtTenantUsage = (tenantId) => jsonRequest(`/admin/gdt-control/tenants/${encodeURIComponent(tenantId)}/usage`)
export const updateGdtTenantPolicy = (tenantId, value) => jsonRequest(`/admin/gdt-control/tenants/${encodeURIComponent(tenantId)}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value)
})
