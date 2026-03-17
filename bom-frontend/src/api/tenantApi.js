import { apiFetch } from './client'

const base = '/bom/tenants'

async function handleResponse(res) {
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = (data && data.message) || data || res.statusText
    throw new Error(err)
  }
  return data
}

export async function getTenants() {
  const res = await apiFetch(base)
  return handleResponse(res)
}

export async function createTenant(payload) {
  const res = await apiFetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function updateTenant(id, payload) {
  const res = await apiFetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function activateTenant(id, active) {
  const res = await apiFetch(`${base}/${id}/activate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: !!active }),
  })
  return handleResponse(res)
}

export default { getTenants, createTenant, updateTenant, activateTenant }