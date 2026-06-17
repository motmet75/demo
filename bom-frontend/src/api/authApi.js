import { apiFetchJson } from './client'

export async function loginApi(payload) {
  const { res, data } = await apiFetchJson('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok || !data?.authenticated) {
    throw new Error(data?.message || 'Login failed')
  }
  return data
}

export async function logoutApi() {
  const { data } = await apiFetchJson('/auth/logout', { method: 'POST', credentials: 'include' })
  return data
}

export async function fetchCurrentUser() {
  const { res, data } = await apiFetchJson('/auth/me', { credentials: 'include' })
  if (!res.ok || !data?.authenticated) return null
  return data.user || null
}

export function extendShopValidity(companyId, days) {
  return apiFetchJson('/auth/admin/extend-validity', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, days }),
  })
}
