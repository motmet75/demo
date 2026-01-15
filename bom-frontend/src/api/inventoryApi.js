export async function fetchInventory() {
  const res = await fetch('/bom/api/inventory')
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    console.warn('fetchInventory: server returned non-JSON response', text)
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

export async function addStock(payload) {
  const res = await fetch('/bom/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Add stock failed')
  }
  return res.json()
}

export async function updateInventory(id, payload) {
  const url = `/bom/api/inventory/${encodeURIComponent(id)}`
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) {
    const message = (data && data.message) || (typeof data === 'string' ? data : res.statusText) || `Request failed with status ${res.status}`
    const error = new Error(message)
    error.status = res.status
    error.response = data
    throw error
  }
  return data
}

export async function reserveInventory(id, qty) {
  const url = `/bom/api/inventory/${encodeURIComponent(id)}/reserve`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || 'Reserve failed')
  }
  try { return JSON.parse(text) } catch { return text }
}

export async function releaseInventory(id, qty) {
  const url = `/bom/api/inventory/${encodeURIComponent(id)}/release`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: qty }) })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || 'Release failed')
  }
  try { return JSON.parse(text) } catch { return text }
}
