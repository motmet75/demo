import { apiFetch, apiFetchJson } from './client'

export async function fetchInventory() {
  const { res, data } = await apiFetchJson('/bom/inventory')
  if (!res.ok) return []

  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}

export async function fetchInventoryView() {
  const { res, data } = await apiFetchJson('/bom/inventory/view')
  if (!res.ok) return []
  return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : [])
}

export async function addStock(payload) {
  const { res, data } = await apiFetchJson('/bom/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || (typeof data === 'string' ? data : null) || `Add stock failed (${res.status})`
    throw new Error(message)
  }
  return data
}

export async function updateInventory(id, payload) {
  const url = `/bom/inventory/${encodeURIComponent(id)}`
  const { res, data } = await apiFetchJson(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }
  return data
}

export async function reserveInventory(id, qty) {
  const url = `/bom/inventory/${encodeURIComponent(id)}/reserve`
  const { res, data } = await apiFetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  if (!res.ok) {
    throw new Error((data && data.message) || 'Reserve failed')
  }
  return data
}

export async function releaseInventory(id, qty) {
  const url = `/bom/inventory/${encodeURIComponent(id)}/release`
  const { res, data } = await apiFetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  if (!res.ok) {
    throw new Error((data && data.message) || 'Release failed')
  }
  return data
}

export async function importInventory(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/inventory/import', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}

export async function deleteInventory(id) {
  const url = `/bom/inventory/${encodeURIComponent(id)}`
  const { res } = await apiFetchJson(url, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete inventory: ${res.status}`)
}

export async function patchInventoryCsv(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/inventory/patch-csv', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Patch upload failed')
  }
  return res.json()
}

export async function downloadPatchTemplate(tenantId, companyId) {
  const params = new URLSearchParams()
  if (tenantId)  params.set('tenantId',  tenantId)
  if (companyId) params.set('companyId', companyId)
  const qs = params.toString()
  const res = await apiFetch(`/bom/inventory/template/patch-csv${qs ? '?' + qs : ''}`)
  if (!res.ok) throw new Error('Template download failed')
  return res.blob()
}