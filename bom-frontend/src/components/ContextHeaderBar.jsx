import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/useAuth'

export default function ContextHeaderBar() {
  const { tenantId, companyId, setTenantId, setCompanyId, reset } = useAppContext()
  const { isAdmin } = useAuth()

  const resetTenant = () => setTenantId(null)
  const resetCompany = () => setCompanyId(null)

  return (
    <div style={{ marginBottom: 12, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}>
      <strong>Context:</strong>
      <div style={{ marginTop: 8 }}>
        Tenant: {tenantId || '<none>'}
        {isAdmin && tenantId && <button onClick={resetTenant} style={{ marginLeft: 8 }}>Change</button>}
        {' '}| Company: {companyId || '<none>'}
        {isAdmin && companyId && <button onClick={resetCompany} style={{ marginLeft: 8 }}>Change</button>}
        {isAdmin && <button onClick={reset} style={{ marginLeft: 12 }}>Reset all</button>}
      </div>
    </div>
  )
}
