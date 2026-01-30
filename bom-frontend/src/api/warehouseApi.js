import { apiFetch, apiFetchJson } from './client'

export function normalizeWarehouse(obj) {
  if (!obj || typeof obj !== 'object') return obj

  const normalizeValue = (v) => {
    if (v === null || v === undefined) return v
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      if (s === 'null' || s === 'undefined') return null
      return v
    }
    return v
  }

  const rawId = obj.id ?? obj.id ?? obj._id ?? null
  const rawCode = obj.code ?? obj.warehouseCode ?? obj.code ?? null
  const rawName = obj.name ?? obj.warehouseName ?? obj.name ?? null
  const rawLocation = obj.location ?? obj.addr ?? null

  const id = normalizeValue(rawId)
  const code = normalizeValue(rawCode)
  const name = normalizeValue(rawName)
  const location = normalizeValue(rawLocation)

  // normalize boolean-ish values; preserve undefined when not provided
  let isActive
  if (obj.isActive !== undefined) isActive = Boolean(obj.isActive)
  else if (obj.active !== undefined) isActive = Boolean(obj.active)
  else isActive = undefined

  const rawCreatedAt = obj.createdAt ?? obj.created_at ?? null
  const createdAt = normalizeValue(rawCreatedAt)

  return {
    // keep original fields, but ensure canonical properties exist for the frontend
    ...obj,
    id: id != null ? String(id) : id,
    code,
    name,
    location,
    isActive,
    createdAt
  }
}

// Convert string 'null'/'undefined' and empty strings to real nulls before sending to backend
export function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const out = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === null || v === undefined) {
      out[k] = null
      continue
    }
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      if (s === 'null' || s === 'undefined' || s === '') {
        out[k] = null
        continue
      }
      out[k] = v
      continue
    }
    out[k] = v
  }
  return out
}

export async function fetchWarehouses() {
  const { res, data } = await apiFetchJson('/bom/api/warehouses')
  if (!res.ok) return []

  if (Array.isArray(data)) return data.map(normalizeWarehouse)
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data.map(normalizeWarehouse)
    if (Array.isArray(data.items)) return data.items.map(normalizeWarehouse)
    if (Array.isArray(data.content)) return data.content.map(normalizeWarehouse)

    return [normalizeWarehouse(data)]
  }
  return []
}

export async function createWarehouse(payload) {
  const body = sanitizePayload(payload)
  const { res, data } = await apiFetchJson('/bom/api/warehouses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }
  return (data && typeof data === 'object') ? normalizeWarehouse(data) : data
}

export async function updateWarehouse(id, payload) {
  const body = sanitizePayload(payload)
  const url = `/bom/api/warehouses/${encodeURIComponent(id)}`
  const { res, data } = await apiFetchJson(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }
  return (data && typeof data === 'object') ? normalizeWarehouse(data) : data
}

export async function deleteWarehouse(id) {
  const url = `/bom/api/warehouses/${encodeURIComponent(id)}`
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
  return (data && typeof data === 'object') ? normalizeWarehouse(data) : data
}