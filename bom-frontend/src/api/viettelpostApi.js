// API client for Viettel Post endpoints
import { apiFetch, apiFetchJson } from './client'

const API_BASE = '/viettelpost'

/**
 * Get stored token
 */
export async function getToken() {
  const { res, data } = await apiFetchJson(`${API_BASE}/token`)
  if (!res.ok) throw new Error(data?.message || 'Failed to get token')
  return data
}

/**
 * Set/update token manually
 */
export async function setToken(token, userId = 'default') {
  const { res, data } = await apiFetchJson(`${API_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, userId })
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to set token')
  return data
}

/**
 * Login to Viettel Post
 */
export async function login(username, password) {
  const { res, data } = await apiFetchJson(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!res.ok) throw new Error(data?.message || 'Login failed')
  return data
}

/**
 * Get all provinces
 */
export async function getProvinces(token) {
  const { res, data } = await apiFetchJson(`${API_BASE}/provinces`, {
    headers: { 'Authorization': token }
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to get provinces')
  return data.data || []
}

/**
 * Get districts by province ID
 */
export async function getDistricts(token, provinceId) {
  const { res, data } = await apiFetchJson(`${API_BASE}/districts/${provinceId}`, {
    headers: { 'Authorization': token }
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to get districts')
  return data.data || []
}

/**
 * Get wards by district ID
 */
export async function getWards(token, districtId) {
  const { res, data } = await apiFetchJson(`${API_BASE}/wards/${districtId}`, {
    headers: { 'Authorization': token }
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to get wards')
  return data.data || []
}

/**
 * Get complete address
 */
export async function getCompleteAddress(token, provinceId, districtId, wardId) {
  const params = new URLSearchParams({ provinceId })
  if (districtId) params.append('districtId', districtId)
  if (wardId) params.append('wardId', wardId)
  
  const { res, data } = await apiFetchJson(`${API_BASE}/address/complete?${params}`, {
    headers: { 'Authorization': token }
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to get address')
  return data.data
}

/**
 * Calculate shipping price
 */
export async function calculatePrice(token, priceData) {
  const { res, data } = await apiFetchJson(`${API_BASE}/calculate-price`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token 
    },
    body: JSON.stringify(priceData)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to calculate price')
  return data
}

/**
 * Get all shipment options
 */
export async function getShipmentOptions(token, shipmentData) {
  const { res, data } = await apiFetchJson(`${API_BASE}/shipment-options`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token 
    },
    body: JSON.stringify(shipmentData)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to get shipment options')
  return data
}

// Format Vietnamese currency
export function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN', { 
    style: 'currency', 
    currency: 'VND' 
  }).format(amount)
}
