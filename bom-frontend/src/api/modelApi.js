import { apiFetch, apiFetchJson, getContextHeaders } from './client'

export async function importModels(file) {
  const ctx = getContextHeaders()
  if (!ctx['X-Tenant-Id'] || !ctx['X-Company-Id']) {
    throw new Error('Please select a tenant and company before importing.')
  }
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/bom/models/import', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text)?.message || text } catch { /* ignore */ }
    throw new Error(msg || 'Upload failed')
  }
  return res.json()
}

export async function fetchBomsByModel(modelId) {
  if (!modelId) return []
  const { res, data } = await apiFetchJson(`/bom/boms/by-model/${encodeURIComponent(modelId)}`)
  if (!res.ok) return []
  const list = Array.isArray(data) ? data : (data?.data ?? [])
  return list
}

export async function fetchModels() {
  const ctx = getContextHeaders()
  if (!ctx['X-Tenant-Id'] || !ctx['X-Company-Id']) {
    throw new Error('Please select a tenant and company before loading models.')
  }
  const { res, data } = await apiFetchJson('/bom/models')
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
  const { res, data } = await apiFetchJson('/bom/models', {
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
  const url = `/bom/models/${encodeURIComponent(id)}`
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
  const url = `/bom/models/${encodeURIComponent(id)}`
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

export async function importModelBoms(file, options = {}) {
  // options: { tenantId, companyId, bomId }
  const form = new FormData()
  form.append('file', file)
  if (options.tenantId) form.append('tenantId', options.tenantId)
  if (options.companyId) form.append('companyId', options.companyId)
  if (options.bomId) form.append('bomId', options.bomId)

  const headers = {}
  // include X-Tenant-Id header for server-side tenant resolution if provided
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId

  const res = await apiFetch('/bom/models/import-bom', { method: 'POST', body: form, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}

export async function fetchModelBoms() {
  const { res, data } = await apiFetchJson('/bom/model-boms')
  if (!res.ok) return []

  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}

export async function fetchModelBomsByModel(modelId, options = {}) {
  // options: { tenantId, companyId }
  if (!modelId) return []
  const params = new URLSearchParams()
  if (options.tenantId) params.set('tenantId', options.tenantId)
  if (options.companyId) params.set('companyId', options.companyId)
  const qs = params.toString()
  const url = `/bom/model-boms/by-model/${encodeURIComponent(modelId)}${qs ? '?' + qs : ''}`
  const headers = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  const { res, data } = await apiFetchJson(url, { headers })
  if (!res.ok) return []
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}

export async function createModelBom(payload, options = {}) {
  // payload: { modelId, materialId, qtyPerUnit }
  const params = new URLSearchParams()
  if (options.tenantId) params.set('tenantId', options.tenantId)
  if (options.companyId) params.set('companyId', options.companyId)
  const qs = params.toString()
  const url = `/bom/model-boms${qs ? '?' + qs : ''}`
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(url, { method: 'POST', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to create BOM item')
  return data
}

export async function updateModelBom(id, payload, options = {}) {
  // payload: { materialId?, qtyPerUnit? }
  const params = new URLSearchParams()
  if (options.tenantId) params.set('tenantId', options.tenantId)
  if (options.companyId) params.set('companyId', options.companyId)
  const qs = params.toString()
  const url = `/bom/model-boms/${encodeURIComponent(id)}${qs ? '?' + qs : ''}`
  const headers = { 'Content-Type': 'application/json' }
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId
  if (options.companyId) headers['X-Company-Id'] = options.companyId
  const { res, data } = await apiFetchJson(url, { method: 'PUT', headers, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message) || 'Failed to update BOM item')
  return data
}

export async function deleteModelBom(id) {
  const res = await apiFetch(`/bom/model-boms/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete BOM item')
}