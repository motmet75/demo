import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { getTenants } from '../api/tenantApi'

export default function TenantSelector() {
  const { tenantId, setTenantId, companyId } = useAppContext()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getTenants()
      .then((data) => { if (mounted) setTenants(Array.isArray(data) ? data : (data && data.data ? data.data : [])) })
      .catch((e) => { if (mounted) setError(e.message || String(e)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value || null
    setTenantId(v)
  }

  const disabled = !!(companyId)

  return (
    <div style={{ display: 'inline-block', marginRight: 12 }}>
      <label>Tenant: </label>
      <select value={tenantId || ''} onChange={handleChange} disabled={disabled || !!tenantId}>
        <option value="">-- Select tenant --</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>{(t.tenantCode || t.code || t.name) + ' - ' + (t.tenantName || t.name || '')}</option>
        ))}
      </select>
      {loading && <span style={{ marginLeft: 8 }}>Loading...</span>}
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
      {disabled && <span style={{ marginLeft: 8, color: '#666' }}>Switch disabled while company selected</span>}
    </div>
  )
}