import { apiFetch, apiFetchJson } from './client'

const BASE = '/order-lines'

export async function fetchOrderLines(params = {}) {
  const qs = new URLSearchParams()
  if (params.orderId)    qs.set('orderId', params.orderId)
  if (params.lineStatus) qs.set('lineStatus', params.lineStatus)
  if (params.lineType)   qs.set('lineType', params.lineType)
  if (params.modelId)    qs.set('modelId', params.modelId)
  if (params.materialId) qs.set('materialId', params.materialId)
  const url = qs.toString() ? `${BASE}?${qs}` : BASE
  const { res, data } = await apiFetchJson(url)
  if (!res.ok) throw new Error(data?.message || `Failed to fetch order lines (${res.status})`)
  return Array.isArray(data) ? data : (data?.content ?? data ?? [])
}

export async function fetchOrderLine(id) {
  const { res, data } = await apiFetchJson(`${BASE}/${id}`)
  if (!res.ok) throw new Error(data?.message || `Not found (${res.status})`)
  return data
}

export async function createOrderLine(payload) {
  const { res, data } = await apiFetchJson(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(data?.message || `Create failed (${res.status})`)
  return data
}

export async function updateOrderLine(id, payload) {
  const { res, data } = await apiFetchJson(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(data?.message || `Update failed (${res.status})`)
  return data
}

export async function patchOrderLine(id, patch) {
  const { res, data } = await apiFetchJson(`${BASE}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(data?.message || `Patch failed (${res.status})`)
  return data
}

export async function deleteOrderLine(id) {
  const res = await apiFetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const text = await res.text()
    let msg
    try { msg = JSON.parse(text)?.message } catch { msg = text }
    throw new Error(msg || `Delete failed (${res.status})`)
  }
}
