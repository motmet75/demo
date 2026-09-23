import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/useAuth'
import { useTenantList } from '../context/TenantListContext'

export default function TenantSelector() {
  const { tenantId, setTenantId } = useAppContext()
  const { isSuperAdmin, user, loading: authLoading } = useAuth()
  const { tenants, loading, error } = useTenantList()

  const handleChange = (e) => {
    const v = e.target.value || null
    setTenantId(v)
  }

  // Non-super users are locked to their assigned tenant.
  if (!isSuperAdmin) {
    const label = user?.assignedTenantName
      ? (user.assignedTenantCode ? `${user.assignedTenantCode} - ${user.assignedTenantName}` : user.assignedTenantName)
      : (user?.assignedTenantId || tenantId || '')
    if (!label) return null
    return (
      <div style={{ display: 'inline-block', marginRight: 12 }}>
        <label>Tenant: </label>
        <span style={{ fontWeight: 'bold', marginLeft: 4 }}>{label}</span>
      </div>
    )
  }

  if (authLoading) {
    return <div style={{ display: 'inline-block', marginRight: 12 }}>Tenant: <span>...</span></div>
  }

  return (
    <div style={{ display: 'inline-block', marginRight: 12 }}>
      <label>Tenant: </label>
      <select value={tenantId || ''} onChange={handleChange}>
        <option value="">-- Select tenant --</option>
        {tenants.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {(t.tenantCode || t.code || '') + ' - ' + (t.tenantName || t.name || '')}
          </option>
        ))}
      </select>
      {loading && <span style={{ marginLeft: 8 }}>Loading...</span>}
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </div>
  )
}
