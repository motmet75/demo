export async function fetchModels() {
  const res = await fetch('/bom/api/models')
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // not JSON; return empty array or raw text wrapped
    console.warn('fetchModels: server returned non-JSON response', text)
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

export async function createModel(payload) {
  const res = await fetch('/bom/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  return res.json()
}

export async function updateModel(id, payload) {
  const url = `/bom/api/models/${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }

  return data
}

export async function deleteModel(id) {
  const url = `/bom/api/models/${encodeURIComponent(id)}`
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

  return data
}