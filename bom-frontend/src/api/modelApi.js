import { apiFetch, apiFetchJson } from './client'

export async function fetchModels() {
  const { res, data } = await apiFetchJson('/bom/api/models')
  if (!res.ok) return []

  // If the API returns an array directly
  if (Array.isArray(data)) return data

  // If the API returns an envelope, try common fields
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }

  return []
}

export async function createModel(payload) {
  const { res, data } = await apiFetchJson('/bom/api/models', {
    method: 'POST',
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

export async function updateModel(id, payload) {
  const url = `/bom/api/models/${encodeURIComponent(id)}`
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

export async function deleteModel(id) {
  const url = `/bom/api/models/${encodeURIComponent(id)}`
  const res = await apiFetch(url, { method: 'DELETE' })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Delete failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }

  return data
}

export async function importModelBoms(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/api/models/import-bom', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}

export async function fetchModelBoms() {
  const { res, data } = await apiFetchJson('/bom/api/model-boms')
  if (!res.ok) return []

  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}