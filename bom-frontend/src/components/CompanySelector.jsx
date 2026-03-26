import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { useAuth } from '../context/useAuth'
import companyApi from '../api/companyApi'

export default function CompanySelector() {
  const { tenantId, companyId, setCompanyId } = useAppContext()
  const { isAdmin, user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tenantId) return
    let mounted = true

    const fetchCompanies = async () => {
      try {
        setLoading(true)
        const data = await companyApi.getCompanies(tenantId)
        if (mounted) setCompanies(Array.isArray(data) ? data : (data && data.data ? data.data : []))
      } catch (e) {
        if (mounted) setError(e.message || String(e))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchCompanies()
    return () => { mounted = false }
  }, [tenantId])

  const handleChange = (e) => {
    const v = e.target.value || null
    setCompanyId(v)
  }

  // Non-admin users: can select company but only within their assignedTenantId
  if (!isAdmin) {
    return (
      <div style={{ display: 'inline-block', marginRight: 12 }}>
        <label>Company: </label>
        <select value={companyId || ''} onChange={handleChange} disabled={!tenantId}>
          <option value="">-- Select company --</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.code ?? c.companyCode ?? ''} - {c.name ?? c.companyName ?? ''}</option>
          ))}
        </select>
        {loading && <span style={{ marginLeft: 8 }}>Loading...</span>}
        {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
      </div>
    )
  }

  return (
    <div style={{ display: 'inline-block', marginRight: 12 }}>
      <label>Company: </label>
      <select value={companyId || ''} onChange={handleChange} disabled={!tenantId || !!companyId}>
        <option value="">-- Select company --</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
        ))}
      </select>
      {loading && <span style={{ marginLeft: 8 }}>Loading...</span>}
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </div>
  )
}
