import React from 'react'
import { useAppContext } from '../context/AppContext'

export default function RequireContext({ children }) {
  const { tenantId, companyId } = useAppContext()

  if (!tenantId || !companyId) {
    return (
      <div style={{ padding: 16, border: '1px solid #f5c6cb', background: '#fff5f5', borderRadius: 4 }}>
        <h3>Context required</h3>
        <p>Please select Tenant and Company to access this page.</p>
      </div>
    )
  }

  return <>{children}</>
}