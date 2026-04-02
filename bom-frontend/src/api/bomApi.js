import { apiFetchJson } from './client'

const BASE = '/bom/bom-crud'

function ctx(opts = {}) {
  // attach context headers from client.js automatically via apiFetchJson
  return opts
}

// ── BOM list ──────────────────────────────────────────────────────────
export async function fetchBoms() {
  const { res, data } = await apiFetchJson(BASE)
  if (!res.ok) return []
  return Array.isArray(data) ? data : []
}

// ── Active BOM for model ──────────────────────────────────────────────
export async function fetchActiveBom(modelId) {
  if (!modelId) return null
  const { res, data } = await apiFetchJson(`${BASE}/active/${encodeURIComponent(modelId)}`)
  if (!res.ok) return null
  return data
}

// ── BOM items for a bom ───────────────────────────────────────────────
export async function fetchBomItems(bomId) {
  if (!bomId) return []
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(bomId)}/items`)
  if (!res.ok) return []
  return Array.isArray(data) ? data : []
}

// ── Create BOM ────────────────────────────────────────────────────────
export async function createBom(payload) {
  const { res, data } = await apiFetchJson(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Create BOM failed')
  return data
}

// ── Update BOM name ───────────────────────────────────────────────────
export async function updateBomName(bomId, bomName) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(bomId)}/name`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bomName })
  })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Update name failed')
  return data
}

// ── Update BOM status ─────────────────────────────────────────────────
export async function updateBomStatus(bomId, status) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(bomId)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Update status failed')
  return data
}

// ── Delete BOM ────────────────────────────────────────────────────────
export async function deleteBom(bomId) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(bomId)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Delete BOM failed')
  return data
}

// ── Add BOM item ──────────────────────────────────────────────────────
export async function addBomItem(bomId, payload) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(bomId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Add item failed')
  return data
}

// ── Update BOM item ───────────────────────────────────────────────────
export async function updateBomItem(itemId, payload) {
  const { res, data } = await apiFetchJson(`${BASE}/items/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Update item failed')
  return data
}

// ── Delete BOM item ───────────────────────────────────────────────────
export async function deleteBomItem(itemId) {
  const { res, data } = await apiFetchJson(`${BASE}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error((typeof data === 'string' ? data : data?.error) || 'Delete item failed')
  return true
}

// ── Sync BOM from model_bom rows ──────────────────────────────────────
export async function syncBomFromModelBoms(modelId) {
  const { res, data } = await apiFetchJson(`${BASE}/sync/${encodeURIComponent(modelId)}`, { method: 'POST' })
  if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.error) || 'Sync failed')
  return data
}
