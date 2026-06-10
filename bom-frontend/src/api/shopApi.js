import { apiFetchJson, apiFetchJsonNoContext } from './client'

function qs(params) {
  return '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))).toString()
}

// ── Public (no auth) ───────────────────────────────────────────────

export function resolveToken(token) {
  return apiFetchJsonNoContext(`/shop/public/token/${encodeURIComponent(token)}`)
}

export function fetchMenu(tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/menu' + qs({ tenantId, companyId }))
}

export function fetchPublicOrder(orderCode) {
  return apiFetchJsonNoContext(`/shop/public/orders/${encodeURIComponent(orderCode)}`)
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

export function fetchActiveTableOrders(tableId, tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/table-orders' + qs({ tableId, tenantId, companyId }))
}

export function startCustomerEdit(orderCode) {
  return apiFetchJsonNoContext(`/shop/public/orders/${encodeURIComponent(orderCode)}/start-edit`, { method: 'PATCH' })
}

export function cancelCustomerEdit(orderCode) {
  return apiFetchJsonNoContext(`/shop/public/orders/${encodeURIComponent(orderCode)}/cancel-edit`, { method: 'PATCH' })
}

export function updatePublicOrderItems(orderCode, items) {
  return apiFetchJsonNoContext(`/shop/public/orders/${encodeURIComponent(orderCode)}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items)
  })
}

// ── Staff (authenticated) ──────────────────────────────────────────

export function createStaffOrder(body) {
  return apiFetchJson('/shop/staff/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function fetchOrderTagQr(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/tag-qr`)
}

export function generateWalkUpQr(seq) {
  return apiFetchJson('/shop/staff/qr-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seq != null ? { seq } : {})
  })
}

export function fetchShopOrders(status) {
  return apiFetchJson('/shop/staff/orders' + (status ? qs({ status }) : ''))
}

export function fetchActiveOrders() {
  return apiFetchJson('/shop/staff/orders?active=true')
}

export function pickupShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/pickup`, { method: 'PATCH' })
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

export function cancelShopOrder(orderId, reason) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  })
}

export function revertShopOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/revert`, { method: 'PATCH' })
}

export function markOrderPaid(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/pay`, { method: 'PATCH' })
}

export function switchToQrPayment(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/switch-payment`, { method: 'PATCH' })
}

export function splitPayment(orderId, cashAmount) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/split-payment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cashAmount })
  })
}

export function revertToCash(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/revert-payment`, { method: 'PATCH' })
}

export function updateOrderItems(orderId, items) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items)
  })
}

export function resetOrderSequence(resetTo = 0) {
  return apiFetchJson('/shop/staff/orders/sequence/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetTo })
  })
}

export function setShopOrderNumber(orderId, orderNumber) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/number`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber })
  })
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

export function setOrderTable(orderId, tableId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/table`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId: tableId || null })
  })
}

// ── Menu options ───────────────────────────────────────────────────

export function fetchPublicMenuOptions(tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/menu-options' + qs({ tenantId, companyId }))
}

export function fetchMenuOptions(modelId) {
  return apiFetchJson('/shop/staff/menu-options' + qs({ modelId }))
}

export function createMenuOption(body) {
  return apiFetchJson('/shop/staff/menu-options', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
}

export function updateMenuOption(id, body) {
  return apiFetchJson(`/shop/staff/menu-options/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
}

export function deleteMenuOption(id) {
  return apiFetchJson(`/shop/staff/menu-options/${id}`, { method: 'DELETE' })
}

// ── Pickup flow ────────────────────────────────────────────────────

export function pickupScan(orderCode) {
  return apiFetchJsonNoContext(
    `/shop/public/orders/${encodeURIComponent(orderCode)}/pickup-scan`,
    { method: 'PATCH' }
  )
}

export function fetchActivePickup(tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/active-pickup' + qs({ tenantId, companyId }))
}

export function fetchPickupQr(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/pickup-qr`)
}

// ── Display board ──────────────────────────────────────────────────

export function generateDisplayBoardToken() {
  return apiFetchJson('/shop/staff/display-board/token', { method: 'POST' })
}

export function fetchDisplayBoard(token) {
  return apiFetchJsonNoContext(`/shop/public/display-board/${encodeURIComponent(token)}`)
}

// ── Token management ──────────────────────────────────────────────

export function fetchTokens() {
  return apiFetchJson('/shop/staff/tokens')
}

export function enableToken(tokenId) {
  return apiFetchJson(`/shop/staff/tokens/${tokenId}/enable`, { method: 'PATCH' })
}

export function disableToken(tokenId) {
  return apiFetchJson(`/shop/staff/tokens/${tokenId}/disable`, { method: 'PATCH' })
}

export function deleteToken(tokenId) {
  return apiFetchJson(`/shop/staff/tokens/${tokenId}`, { method: 'DELETE' })
}

// ── Bank config ────────────────────────────────────────────────────

export function fetchBankConfig() {
  return apiFetchJson('/shop/staff/bank-config')
}

export function updateBankConfig(body) {
  return apiFetchJson('/shop/staff/bank-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
