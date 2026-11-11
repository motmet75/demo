import React, { useState } from 'react'
import { getTenants } from '../api/tenantApi'

export default function TenantForm({ mode = 'create', tenant = null, onCreate, onUpdate, onCancel }) {
  const [tenantCode, setTenantCode] = useState(tenant?.tenantCode || tenant?.code || '')
  const [tenantName, setTenantName] = useState(tenant?.tenantName || tenant?.name || '')
  const [isActive, setIsActive] = useState(tenant?.isActive ?? true)
  const [maxCompanies, setMaxCompanies] = useState(tenant?.maxCompanies ?? 1)
  const [portalContentTenant, setPortalContentTenant] = useState(tenant?.portalContentTenant || '')
  const [errors, setErrors] = useState({})
  const [checking, setChecking] = useState(false)

  const validate = async () => {
    const e = {}
    if (!tenantCode || tenantCode.trim().length < 2) e.tenantCode = 'Tenant code is required (min 2 chars)'
    if (!tenantName || tenantName.trim().length < 2) e.tenantName = 'Tenant name is required'

    // uniqueness check
    if (!e.tenantCode) {
      setChecking(true)
      try {
        const all = await getTenants()
        const list = Array.isArray(all) ? all : (all && all.data ? all.data : [])
        const exists = list.find((t) => (t.tenantCode || t.code) === tenantCode && (mode !== 'edit' || t.id !== tenant.id))
        if (exists) e.tenantCode = 'Tenant code already exists'
      } catch {
        // ignore remote errors for uniqueness
      } finally {
        setChecking(false)
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await validate()
    if (!ok) return
    const payload = { tenantCode, tenantName, isActive, maxCompanies: Number(maxCompanies) || 1, portalContentTenant: portalContentTenant.trim() || null }
    if (mode === 'create') {
      await onCreate(payload)
      setTenantCode('')
      setTenantName('')
      setIsActive(true)
      setPortalContentTenant('')
    } else {
      await onUpdate(tenant.id, payload)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <div>
        <label>Tenant Code</label><br />
        <input value={tenantCode} onChange={(e) => setTenantCode(e.target.value)} />
        {errors.tenantCode && <div style={{ color: 'red' }}>{errors.tenantCode}</div>}
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Tenant Name</label><br />
        <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
        {errors.tenantName && <div style={{ color: 'red' }}>{errors.tenantName}</div>}
      </div>
      <div style={{ marginTop: 8 }}>
        <label>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Portal Website Tenant</label><br />
        <input value={portalContentTenant} onChange={(e) => setPortalContentTenant(e.target.value)} placeholder="migiatruyen.vn" style={{ width: 280 }} />
        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>Assigned ADMIN users can edit this website database</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Max Companies</label><br />
        <input
          type="number"
          min="1"
          value={maxCompanies}
          onChange={(e) => setMaxCompanies(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 80 }}
        />
        <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>Max number of companies this tenant can create</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <button type="submit" disabled={checking}>{mode === 'create' ? 'Create' : 'Save'}</button>
        {mode === 'edit' && <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>}
      </div>
    </form>
  )
}
