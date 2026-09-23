import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/useAuth'

export default function ContextHeaderBar() {
  const { tenantId, companyId, setTenantId, setCompanyId, reset } = useAppContext()
  const { isSuperAdmin } = useAuth()

  // Helper to shorten UUIDs: "550e8400-e29b..." -> "550e..."
  const formatId = (id) => (id ? `${id.substring(0, 6)}...` : '<none>')

  const resetTenant = () => setTenantId(null)
  const resetCompany = () => setCompanyId(null)

  return (
    <div style={{ marginBottom: 12, padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9rem' }}>
      <strong>Context:</strong>
      <div style={{ marginTop: 8 }}>
        <span>Tenant: <strong>{formatId(tenantId)}</strong></span>
        {isSuperAdmin && tenantId && (
          <button onClick={resetTenant} style={buttonStyle}>Change</button>
        )}
        
        <span style={{ margin: '0 12px', color: '#ccc' }}>|</span>
        
        <span>Company: <strong>{formatId(companyId)}</strong></span>
        {isSuperAdmin && companyId && (
          <button onClick={resetCompany} style={buttonStyle}>Change</button>
        )}
        
        {isSuperAdmin && (
          <button onClick={reset} style={{ ...buttonStyle, marginLeft: 16, color: 'red' }}>
            Reset all
          </button>
        )}
      </div>
    </div>
  )
}

const buttonStyle = {
  marginLeft: 8,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: '0.8rem'
}
