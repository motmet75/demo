import { apiFetch, apiFetchJson } from './client'

export async function fetchAdminUsers() {
  const { res, data } = await apiFetchJson('/admin/users', { credentials: 'include' })
  if (!res.ok) throw new Error(data?.message || 'Failed to load users')
  return Array.isArray(data) ? data : []
}

export async function createAdminUser(payload) {
  const { res, data } = await apiFetchJson('/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to create user')
  return data
}

export async function updateAdminUser(id, payload) {
  const { res, data } = await apiFetchJson(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to update user')
  return data
}

export async function deleteAdminUser(id) {
  const res = await apiFetch(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to delete user')
  }
}

export async function replaceUserAuthorities(username, authorities) {
  const { res, data } = await apiFetchJson(`/admin/authorities/${encodeURIComponent(username)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authorities)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to update authorities')
  return data
}

export async function assignUserTenant(id, tenantId) {
  const { res, data } = await apiFetchJson(`/admin/users/${encodeURIComponent(id)}/tenant`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: tenantId ?? null })
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to assign tenant')
  return data
}
