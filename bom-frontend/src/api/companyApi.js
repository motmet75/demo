const base = '/bom/api/companies'

async function handleResponse(res) {
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = (data && data.message) || data || res.statusText
    throw new Error(err)
  }
  return data
}

export async function getCompanies(tenantId) {
  const url = tenantId ? `${base}?tenantId=${tenantId}` : base
  const res = await fetch(url)
  return handleResponse(res)
}

export async function createCompany(payload) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function updateCompany(id, payload) {
  const res = await fetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function deleteCompany(id) {
  const res = await fetch(`${base}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(res.statusText)
  return true
}

export default { getCompanies, createCompany, updateCompany, deleteCompany }
