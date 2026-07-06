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

export function fetchShopConfig(tenantId, companyId) {
  return apiFetchJsonNoContext('/shop/public/shop-config' + qs({ tenantId, companyId }))
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

export function cancelPublicOrder(orderCode, note) {
  return apiFetchJsonNoContext(`/shop/public/orders/${encodeURIComponent(orderCode)}/cancel-by-customer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: note || null }),
  })
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

export function fetchPrintHistory(params = {}) {
  return apiFetchJson('/shop/staff/printing-history' + qs(params))
}

export function createPrintHistory(body) {
  return apiFetchJson('/shop/staff/printing-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  })
}
export function fetchOrdersByToken(token) {
  return apiFetchJson('/shop/staff/orders/by-token' + qs({ token }))
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

export function fetchTokenSession(token) {
  return apiFetchJsonNoContext(`/shop/public/session?t=${encodeURIComponent(token)}`)
}

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

// ── Staff calls ────────────────────────────────────────────────────

export function callStaff(tenantId, companyId, tableId, reason, note, token, order = null) {
  const orderInfo = order || {}
  return apiFetchJsonNoContext('/shop/public/call-staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId,
      companyId,
      tableId: tableId || null,
      reason,
      note: note || null,
      token: token || null,
      orderId: orderInfo.id || null,
      orderCode: orderInfo.orderCode || null,
      orderNumber: orderInfo.orderNumber ?? null,
      dailySeq: orderInfo.dailySeq ?? null,
    }),
  })
}

export function fetchPublicStaffCall(id, token, tenantId, companyId, tableId) {
  return apiFetchJsonNoContext(`/shop/public/call-staff/${encodeURIComponent(id)}` + qs({ token, tenantId, companyId, tableId }))
}

export function fetchLatestPublicStaffCall(token, tenantId, companyId, tableId) {
  return apiFetchJsonNoContext('/shop/public/call-staff/latest' + qs({ token, tenantId, companyId, tableId }))
}

export function fetchStaffCalls() {
  return apiFetchJson('/shop/staff/staff-calls')
}

export function replyStaffCall(id, message) {
  return apiFetchJson(`/shop/staff/staff-calls/${id}/reply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export function dismissStaffCall(id) {
  return apiFetchJson(`/shop/staff/staff-calls/${id}/dismiss`, { method: 'PATCH' })
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

// ── Split / Merge bills ────────────────────────────────────────────

export function splitBill(orderId, rootItemIds) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/split-bill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootItemIds })
  })
}

export function mergeBills(primaryId, otherIds) {
  return apiFetchJson('/shop/staff/orders/merge-bills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ primaryId, otherIds })
  })
}

export function undoMergeBills(orderId, mergeBatchId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/undo-merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeBatchId: mergeBatchId || null })
  })
}

export function patchOrderDiscount(orderId, discountAmount, voucherCode) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/discount`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discountAmount, voucherCode })
  })
}

export function linkOrderCustomer(orderId, customerId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/customer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId })
  })
}

// ── Customer management ────────────────────────────────────────────

export function fetchCustomers(q) {
  return apiFetchJson('/shop/staff/customers' + (q ? qs({ q }) : ''))
}

export function fetchCustomerHistory(customerId) {
  return apiFetchJson(`/shop/staff/customers/${customerId}/history`)
}

export function createCustomer(body) {
  return apiFetchJson('/shop/staff/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function updateCustomer(id, body) {
  return apiFetchJson(`/shop/staff/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function deleteCustomer(id) {
  return apiFetchJson(`/shop/staff/customers/${id}`, { method: 'DELETE' })
}

export function addCustomerPoints(id, points) {
  return apiFetchJson(`/shop/staff/customers/${id}/add-points`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points })
  })
}

export function recalculateCustomerPoints(customerId) {
  return apiFetchJson(`/shop/staff/customers/${customerId}/recalculate-points`, { method: 'POST' })
}

// ── Force confirm ─────────────────────────────────────────────────

export function forceConfirmOrder(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/force-confirm`, { method: 'PATCH' })
}

// ── Earn points from order ────────────────────────────────────────

export function earnOrderPoints(orderId) {
  return apiFetchJson(`/shop/staff/orders/${orderId}/earn-points`, { method: 'POST' })
}

// ── Voucher management ────────────────────────────────────────────

export function fetchVouchers() {
  return apiFetchJson('/shop/staff/vouchers')
}

export function createVoucher(body) {
  return apiFetchJson('/shop/staff/vouchers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function cancelVoucher(id) {
  return apiFetchJson(`/shop/staff/vouchers/${id}`, { method: 'DELETE' })
}

export function redeemVoucher(code, orderId) {
  return apiFetchJson('/shop/staff/vouchers/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, orderId })
  })
}

export function rotateVoucherKey() {
  return apiFetchJson('/shop/staff/vouchers/rotate-key', { method: 'POST' })
}
