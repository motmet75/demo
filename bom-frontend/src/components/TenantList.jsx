import React, { useEffect, useState } from 'react'
import { getTenants, createTenant, updateTenant, activateTenant } from '../api/tenantApi'
import TenantForm from './TenantForm'

export default function TenantList() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getTenants()
      setTenants(Array.isArray(data) ? data : (data && data.data ? data.data : []))
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
            <th>Code</th>
            <th>Name</th>
            <th>Active</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
              <td>{t.tenantCode || t.code || ''}</td>
              <td>{t.tenantName || t.name || ''}</td>
              <td>{t.isActive ? 'Yes' : 'No'}</td>
              <td>{t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}</td>
              <td>
                <button onClick={() => setEditing(t)}>Edit</button>
                <button onClick={() => onToggleActive(t)} style={{ marginLeft: 8 }}>{t.isActive ? 'Deactivate' : 'Activate'}</button>
              </td>
            </tr>
          ))}
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
