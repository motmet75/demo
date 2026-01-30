export async function fetchSuppliers(options = {}) {
  // options: { tenantId, companyId }
  const headers = {};
  if (options.tenantId) headers['X-Tenant-Id'] = String(options.tenantId);
  if (options.companyId) headers['X-Company-Id'] = String(options.companyId);

  const params = new URLSearchParams();
  if (options.tenantId) params.set('tenantId', String(options.tenantId));
  if (options.companyId) params.set('companyId', String(options.companyId));
  const url = '/bom/api/suppliers' + (params.toString() ? `?${params.toString()}` : '');

  const res = await fetch(url, { headers });
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

export async function createSupplier(payload, options = {}) {
  // options: { tenantId, companyId }
  const headers = { 'Content-Type': 'application/json' };
  if (options.tenantId) headers['X-Tenant-Id'] = String(options.tenantId);
  if (options.companyId) headers['X-Company-Id'] = String(options.companyId);

  const params = new URLSearchParams();
  if (options.tenantId) params.set('tenantId', String(options.tenantId));
  if (options.companyId) params.set('companyId', String(options.companyId));
  const url = '/bom/api/suppliers' + (params.toString() ? `?${params.toString()}` : '');

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) })
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

export async function updateSupplier(id, payload, options = {}) {
  // options: { tenantId, companyId }
  const params = new URLSearchParams();
  if (options.tenantId) params.set('tenantId', String(options.tenantId));
  if (options.companyId) params.set('companyId', String(options.companyId));
  const url = `/bom/api/suppliers/${encodeURIComponent(id)}` + (params.toString() ? `?${params.toString()}` : '');

  const headers = { 'Content-Type': 'application/json' };
  if (options.tenantId) headers['X-Tenant-Id'] = String(options.tenantId);
  if (options.companyId) headers['X-Company-Id'] = String(options.companyId);

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(payload) })
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

export async function deleteSupplier(id, options = {}) {
  // options: { tenantId, companyId }
  const params = new URLSearchParams();
  if (options.tenantId) params.set('tenantId', String(options.tenantId));
  if (options.companyId) params.set('companyId', String(options.companyId));
  const url = `/bom/api/suppliers/${encodeURIComponent(id)}` + (params.toString() ? `?${params.toString()}` : '');

  const headers = {};
  if (options.tenantId) headers['X-Tenant-Id'] = String(options.tenantId);
  if (options.companyId) headers['X-Company-Id'] = String(options.companyId);

  const res = await fetch(url, { method: 'DELETE', headers })
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