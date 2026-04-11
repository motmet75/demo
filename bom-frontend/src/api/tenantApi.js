import { apiFetchNoContext } from './client'

const base = '/bom/tenants'
const opts = { credentials: 'include' }

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
  const res = await apiFetchNoContext(base, opts)
  const data = await handleResponse(res)
  return Array.isArray(data) ? data : (data?.data ?? [])
}

export async function createTenant(payload) {
  const res = await apiFetchNoContext(base, {
    ...opts,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function updateTenant(id, payload) {
  const res = await apiFetchNoContext(`${base}/${id}`, {
    ...opts,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function activateTenant(id, active) {
  const res = await apiFetchNoContext(`${base}/${id}/activate`, {
    ...opts,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: !!active }),
  })
  return handleResponse(res)
}

export async function deleteTenant(id) {
  const res = await apiFetchNoContext(`${base}/${id}`, { ...opts, method: 'DELETE' })
  return handleResponse(res)
}

export default { getTenants, createTenant, updateTenant, activateTenant, deleteTenant }