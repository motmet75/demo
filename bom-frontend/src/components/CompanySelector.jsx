import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import companyApi from '../api/companyApi'

export default function CompanySelector() {
  const { tenantId, companyId, setCompanyWithName } = useAppContext()
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
    const selected = companies.find(c => c.id === v)
    const name = selected ? (selected.name ?? selected.companyName ?? selected.code ?? null) : null
    setCompanyWithName(v, name)
  }

  // Always allow company selection if tenant is selected
  return (
    <div className="company-selector">
      <label className="company-selector__label">Company: </label>
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
