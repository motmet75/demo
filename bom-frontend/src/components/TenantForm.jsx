import React, { useEffect, useState } from 'react'
import { getTenants } from '../api/tenantApi'

export default function TenantForm({ mode = 'create', tenant = null, onCreate, onUpdate, onCancel }) {
  const [tenantCode, setTenantCode] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState({})
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && tenant) {
      setTenantCode(tenant.tenantCode || tenant.code || '')
      setTenantName(tenant.tenantName || tenant.name || '')
      setIsActive(tenant.isActive ?? true)
    }
  }, [mode, tenant])

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
      } catch (err) {
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
    const payload = { tenantCode, tenantName, isActive }
    if (mode === 'create') {
      await onCreate(payload)
      setTenantCode('')
      setTenantName('')
      setIsActive(true)
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
      <div style={{ marginTop: 12 }}>
        <button type="submit" disabled={checking}>{mode === 'create' ? 'Create' : 'Save'}</button>
        {mode === 'edit' && <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>}
      </div>
    </form>
  )
}
