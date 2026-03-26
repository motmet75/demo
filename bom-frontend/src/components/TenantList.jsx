import React, { useEffect, useState } from 'react'
import { getTenants, createTenant, updateTenant, activateTenant } from '../api/tenantApi'
import { getCompanies } from '../api/companyApi'
import TenantForm from './TenantForm'

export default function TenantList() {
  const [tenants, setTenants] = useState([])
  const [companyCounts, setCompanyCounts] = useState({})
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTenants()
      const list = Array.isArray(data) ? data : (data && data.data ? data.data : [])
      setTenants(list)
      // load company counts for all tenants in parallel
      const counts = await Promise.all(
        list.map((t) =>
          getCompanies(t.id)
            .then((companies) => ({ id: t.id, count: Array.isArray(companies) ? companies.length : 0 }))
            .catch(() => ({ id: t.id, count: 0 }))
        )
      )
      setCompanyCounts(Object.fromEntries(counts.map((c) => [c.id, c.count])))
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onCreate = async (payload) => {
    await createTenant(payload)
    await load()
  }

  const onUpdate = async (id, payload) => {
    await updateTenant(id, payload)
    setEditing(null)
    await load()
  }

  const onToggleActive = async (t) => {
    await activateTenant(t.id, !t.isActive)
    await load()
  }

  return (
    <div>
      <h2>Tenants</h2>
      <TenantForm onCreate={onCreate} />
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Code</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Name</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Active</th>
            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Companies</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Created</th>
            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => {
            const count = companyCounts[t.id] ?? '…'
            const max = t.maxCompanies ?? 1
            const atLimit = typeof count === 'number' && count >= max
            return (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '4px 8px' }}>{t.tenantCode || t.code || ''}</td>
                <td style={{ padding: '4px 8px' }}>{t.tenantName || t.name || ''}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center' }}>{t.isActive ? 'Yes' : 'No'}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                  <span style={{ color: atLimit ? '#c62828' : '#2e7d32', fontWeight: 'bold' }}>{count}</span>
                  <span style={{ color: '#666' }}> / {max}</span>
                  {atLimit && <span style={{ marginLeft: 6, color: '#c62828', fontSize: 11 }}>⚠ limit</span>}
                </td>
                <td style={{ padding: '4px 8px' }}>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</td>
                <td style={{ padding: '4px 8px' }}>
                  <button onClick={() => setEditing(t)}>Edit</button>
                  <button onClick={() => onToggleActive(t)} style={{ marginLeft: 8 }}>{t.isActive ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {editing && (
        <div style={{ marginTop: 12 }}>
          <h3>Edit Tenant</h3>
          <TenantForm mode="edit" tenant={editing} onUpdate={onUpdate} onCancel={() => setEditing(null)} />
        </div>
      )}
    </div>
  )
}
