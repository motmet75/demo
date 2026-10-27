import { apiFetchJson } from './client'

export async function fetchServiceBoms() {
  const { res, data } = await apiFetchJson('/service-boms')
  if (!res.ok) throw new Error(data?.error || 'Could not load service BOMs')
  return Array.isArray(data) ? data : []
}

export async function createServiceBom(payload) {
  const { res, data } = await apiFetchJson('/service-boms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(data?.error || 'Could not create service BOM')
  return data
}

export async function addServiceBomItem(id, payload) {
  const { res, data } = await apiFetchJson(`/service-boms/${id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(data?.error || 'Could not add service cost')
  return data
}

export async function createServiceInstallation(payload) {
  const { res, data } = await apiFetchJson('/service-installations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(data?.error || 'Could not attach service BOM to order')
  return data
}
