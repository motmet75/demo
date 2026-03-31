import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/useAuth'
import { getTenants } from '../api/tenantApi'

export default function TenantSelector() {
  const { tenantId, setTenantId } = useAppContext()
  const { isAdmin, user } = useAuth()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    getTenants()
      .then((data) => {
        if (mounted) {
          setTenants(Array.isArray(data) ? data : (data && data.data ? data.data : []))
          setLoading(false)
        }
      })
      .catch((e) => { if (mounted) { setError(e.message || String(e)); setLoading(false) } })
    return () => { mounted = false }
  }, [])

  const handleChange = (e) => {
    const v = e.target.value || null
    setTenantId(v)
  }

  // Non-admin users are locked to their assignedTenantId
  if (!isAdmin) {
    const assigned = tenants.find((t) => String(t.id) === String(user?.assignedTenantId))
    const label = assigned
      ? `${assigned.tenantCode || assigned.code || ''} - ${assigned.tenantName || assigned.name || ''}`
      : (tenantId || '—')
    return (
      <div style={{ display: 'inline-block', marginRight: 12 }}>
        <label>Tenant: </label>
        <span style={{ fontWeight: 'bold', marginLeft: 4 }}>{label}</span>
      </div>
    )
  }

  const disabled = false // Always allow tenant selection if context is missing or user wants to change

  return (
    <div style={{ display: 'inline-block', marginRight: 12 }}>
      <label>Tenant: </label>
      <select value={tenantId || ''} onChange={handleChange} disabled={disabled}>
        <option value="">-- Select tenant --</option>
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>{(t.tenantCode || t.code || t.name) + ' - ' + (t.tenantName || t.name || '')}</option>
        ))}
      </select>
      {loading && <span style={{ marginLeft: 8 }}>Loading...</span>}
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </div>
  )
}