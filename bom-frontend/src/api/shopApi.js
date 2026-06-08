import { apiFetchJson, apiFetchJsonNoContext } from './client'

function qs(params) {
  return '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString()
}

// ── Public (no auth) ───────────────────────────────────────────────

export function fetchMenu(tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/menu' + qs({ tenantId, companyId }))
}

export function fetchPublicOrder(orderCode, tenantId, companyId) {
  return apiFetchJsonNoContext(`/shop/public/orders/${orderCode}` + qs({ tenantId, companyId }))
}

export function createOrder(tenantId, companyId, body) {
  return apiFetchJsonNoContext('/shop/public/orders' + qs({ tenantId, companyId }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function fetchDeliveryOptions(tenantId, companyId, weightKg) {
  return apiFetchJsonNoContext('/shop/public/delivery-options' + qs({ tenantId, companyId, weightKg }))
}

// ── Staff (authenticated) ──────────────────────────────────────────

export function fetchShopOrders(status) {
  return apiFetchJson('/shop/staff/orders' + (status ? qs({ status }) : ''))
}

export function fetchShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}`)
}

export function confirmShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/confirm`, { method: 'PATCH' })
}

export function prepareShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/prepare`, { method: 'PATCH' })
}

export function readyShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/ready`, { method: 'PATCH' })
}

export function completeShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/complete`, { method: 'PATCH' })
}

export function cancelShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/cancel`, { method: 'PATCH' })
}

// ── Tables ─────────────────────────────────────────────────────────

export function fetchShopTables() {
  return apiFetchJson('/shop/staff/tables')
}

export function createShopTable(tableName) {
  return apiFetchJson('/shop/staff/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableName })
  })
}

export function updateShopTable(tableId, body) {
  return apiFetchJson(`/shop/staff/tables/${tableId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function deleteShopTable(tableId) {
  return apiFetchJson(`/shop/staff/tables/${tableId}`, { method: 'DELETE' })
}

export function fetchTableQr(tableId) {
  return apiFetchJson(`/shop/staff/tables/${tableId}/qrcode`)
}
