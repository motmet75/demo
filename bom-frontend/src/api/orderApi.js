import { apiFetchJson } from './client'

const BASE = '/api/orders'

function extractPage(data) {
  // Spring Page<T> envelope → { content, totalElements, ... }
  if (data && Array.isArray(data.content)) return data
  if (Array.isArray(data)) return { content: data, totalElements: data.length, totalPages: 1, number: 0, size: data.length }
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }
}

export async function fetchOrders({ status, orderType, fromDate, toDate, page = 0, size = 20, sort = 'createdAt', direction = 'desc' } = {}) {
  const params = new URLSearchParams()
  if (status)    params.set('status', status)
  if (orderType) params.set('orderType', orderType)
  if (fromDate)  params.set('fromDate', fromDate)
  if (toDate)    params.set('toDate', toDate)
  params.set('page', page)
  params.set('size', size)
  params.set('sort', sort)
  params.set('direction', direction)
  const { res, data } = await apiFetchJson(`${BASE}?${params}`)
  if (!res.ok) return { content: [], totalElements: 0 }
  return extractPage(data)
}

export async function fetchOrderById(id) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error((data && data.error) || 'Not found')
  return data
}

export async function createOrder(payload) {
  const { res, data } = await apiFetchJson(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((data && data.error) || 'Create failed')
  return data
}

export async function updateOrder(id, payload) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((data && data.error) || 'Update failed')
  return data
}

export async function confirmOrder(id) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}/confirm`, { method: 'PATCH' })
  if (!res.ok) throw new Error((data && data.error) || 'Confirm failed')
  return data
}

export async function finishOrder(id, payload = {}) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}/finish`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error((data && data.error) || 'Finish failed')
  return data
}

export async function deliverOrder(id) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}/deliver`, { method: 'PATCH' })
  if (!res.ok) throw new Error((data && data.error) || 'Deliver failed')
  return data
}

export async function cancelOrder(id) {
  const { res, data } = await apiFetchJson(`${BASE}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' })
  if (!res.ok) throw new Error((data && data.error) || 'Cancel failed')
  return data
}

export async function checkInventory(orderIds) {
  const { res, data } = await apiFetchJson(`${BASE}/check-inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds })
  })
  if (!res.ok) throw new Error((data && data.error) || 'Check inventory failed')
  return data
}

export async function moveToProduction(orderIds, deliveryDateTime, issuedBy = 'system') {
  const { res, data } = await apiFetchJson(`${BASE}/move-to-production`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds, deliveryDateTime, issuedBy })
  })
  if (!res.ok) throw new Error((data && data.error) || 'Move to production failed')
  return data
}
