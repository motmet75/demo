import { apiFetch, apiFetchJson } from './client'

export async function fetchInventory() {
  const { res, data } = await apiFetchJson('/bom/api/inventory')
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
  const { res, data } = await apiFetchJson('/bom/api/inventory/view')
  if (!res.ok) return []
  return Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : [])
}

export async function addStock(payload) {
  const { res } = await apiFetchJson('/bom/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Add stock failed')
  }
  return res.json()
}

export async function updateInventory(id, payload) {
  const url = `/bom/api/inventory/${encodeURIComponent(id)}`
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
  const url = `/bom/api/inventory/${encodeURIComponent(id)}/reserve`
  const { res, data } = await apiFetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  if (!res.ok) {
    throw new Error((data && data.message) || 'Reserve failed')
  }
  return data
}

export async function releaseInventory(id, qty) {
  const url = `/bom/api/inventory/${encodeURIComponent(id)}/release`
  const { res, data } = await apiFetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  if (!res.ok) {
    throw new Error((data && data.message) || 'Release failed')
  }
  return data
}

export async function importInventory(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/api/inventory/import', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}