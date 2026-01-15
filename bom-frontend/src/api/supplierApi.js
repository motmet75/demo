export async function fetchSuppliers() {
  const res = await fetch('/bom/api/suppliers')
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    console.warn('fetchSuppliers: server returned non-JSON response', text)
    return []
  }

  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.items)) return data.items
    if (Array.isArray(data.content)) return data.content
  }
  return []
}

export async function createSupplier(payload) {
  const res = await fetch('/bom/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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

export async function updateSupplier(id, payload) {
  const url = `/bom/api/suppliers/${encodeURIComponent(id)}`
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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

export async function deleteSupplier(id) {
  const url = `/bom/api/suppliers/${encodeURIComponent(id)}`
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