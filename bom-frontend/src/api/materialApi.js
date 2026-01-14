export async function fetchMaterials() {
  const res = await fetch('/bom/api/materials')
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON; return empty array or raw text wrapped
    console.warn('fetchMaterials: server returned non-JSON response', text)
    return []
  }

  // If the API returns an array directly
  if (Array.isArray(data)) return data

  // If the API returns an envelope, try common fields
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }

  // fallback: return empty array
  return []
}

export async function createMaterial(payload) {
  const res = await fetch('/bom/api/materials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  return res.json()
}

export async function updateMaterial(id, payload) {
  // send JSON body to PUT /bom/api/materials/{id}, handle success and error, return updated material
  const url = `/bom/api/materials/${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  // read text first so we can handle non-JSON error responses gracefully
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON, keep raw text
    data = text
  }

  if (!res.ok) {
    // try to extract useful message
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }

  return data
}

export async function deleteMaterial(id) {
  // Call DELETE /bom/api/materials/{id} and throw on non-OK
  const url = `/bom/api/materials/${encodeURIComponent(id)}`
  const res = await fetch(url, { method: 'DELETE' })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Delete failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }

  // Some APIs return the deleted resource or an acknowledgement. Return parsed data (may be null).
  return data
}

export async function importMaterials(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/bom/api/materials/import', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Upload failed')
  }
  return res.json()
}