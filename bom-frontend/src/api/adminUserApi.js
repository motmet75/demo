import { apiFetchNoContext } from './client'

// Helper that mirrors apiFetchJson but uses apiFetchNoContext
async function fetchJson(url, opts = {}) {
  const res = await apiFetchNoContext(url, opts)
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { res, data }
}

export async function fetchAdminUsers() {
  const { res, data } = await fetchJson('/admin/users', { credentials: 'include' })
  if (!res.ok) throw new Error(data?.message || 'Failed to load users')
  return Array.isArray(data) ? data : []
}

// Called by the create/edit form while the admin enters an email.
// Server checks the global unique email index, including users outside
// the current table view, and excludes the user being edited.
export async function checkAdminEmailAvailability(email, excludeUserId = null) {
  const params = new URLSearchParams({ email: String(email).trim() })
  if (excludeUserId != null) params.set('excludeUserId', String(excludeUserId))
  const { res, data } = await fetchJson(`/admin/users/email-availability?${params.toString()}`, {
    credentials: 'include'
  })
  if (!res.ok) throw new Error(data?.message || 'Không thể kiểm tra email. Vui lòng thử lại.')
  if (typeof data?.available !== 'boolean') {
    throw new Error('Máy chủ không trả về kết quả kiểm tra email hợp lệ.')
  }
  return data.available
}

export async function createAdminUser(payload) {
  const { res, data } = await fetchJson('/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to create user')
  return data
}

export async function updateAdminUser(id, payload) {
  const { res, data } = await fetchJson(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to update user')
  return data
}

export async function deleteAdminUser(id) {
  const res = await apiFetchNoContext(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Failed to delete user')
  }
}

export async function replaceUserAuthorities(username, authorities) {
  const { res, data } = await fetchJson(`/admin/authorities/${encodeURIComponent(username)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authorities)
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to update authorities')
  return data
}

export async function assignUserTenant(id, tenantId) {
  const { res, data } = await fetchJson(`/admin/users/${encodeURIComponent(id)}/tenant`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: tenantId ?? null })
  })
  if (!res.ok) throw new Error(data?.message || 'Failed to assign tenant')
  return data
}
