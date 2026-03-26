import { apiFetch, apiFetchJson, getContextHeaders } from './client'

export async function fetchMaterials() {
  const ctx = getContextHeaders()
  if (!ctx['X-Tenant-Id'] || !ctx['X-Company-Id']) {
    throw new Error('Please select a tenant and company before loading materials.')
  }
  const { res, data } = await apiFetchJson('/bom/materials')
  if (!res.ok) return []

  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}

export async function createMaterial(payload) {
  const { res, data } = await apiFetchJson('/bom/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((data && data.message) || 'Create failed')
  return data
}

export async function updateMaterial(id, payload) {
  const url = `/bom/materials/${encodeURIComponent(id)}`
  const { res, data } = await apiFetchJson(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }

  return data
}

export async function deleteMaterial(id) {
  const url = `/bom/materials/${encodeURIComponent(id)}`
  const res = await apiFetch(url, { method: 'DELETE' })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Delete failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }
  return data
}

export async function importMaterials(file) {
  const ctx = getContextHeaders()
  if (!ctx['X-Tenant-Id'] || !ctx['X-Company-Id']) {
    throw new Error('Please select a tenant and company before importing.')
  }
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/materials/import', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}