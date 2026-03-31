import React, { useContext, useEffect, useState } from 'react';
import AuthContext from '../../context/AuthContextValue';
import { getTenants, createTenant, updateTenant, deleteTenant } from '../../api/tenantApi';

export default function TenantsPage() {
  const { user, loading } = useContext(AuthContext);
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [formData, setFormData] = useState({ tenantName: '', tenantCode: '', isActive: true, maxCompanies: 1 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    getTenants()
      .then(setTenants)
      .catch(e => setError(e.message));
  }, [user, loading]);

  const refresh = () => {
    getTenants().then(setTenants).catch(e => setError(e.message));
  };

  const handleEdit = (tenant) => {
    setEditTenant(tenant);
    setFormData({
      tenantName: tenant.tenantName || tenant.name || '',
      tenantCode: tenant.tenantCode || tenant.code || '',
      isActive: tenant.isActive != null ? tenant.isActive : true,
      maxCompanies: tenant.maxCompanies != null ? tenant.maxCompanies : 1
    });
    setShowForm(true);
  };

  const handleDelete = async (tenant) => {
    if (!window.confirm(`Delete tenant '${tenant.name || tenant.tenantName}'?`)) return;
    setSaving(true);
    try {
      await deleteTenant(tenant.id || tenant.tenantId);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTenant) {
        await updateTenant(editTenant.id || editTenant.tenantId, formData);
      } else {
        await createTenant(formData);
      }
      setShowForm(false);
      setEditTenant(null);
      setFormData({ tenantName: '', tenantCode: '', isActive: true, maxCompanies: 1 });
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div style={{color: 'red'}}>You must be logged in to view tenants.</div>;
  if (error) return <div style={{color: 'red'}}>{error}</div>;
  return (
    <div>
      <h2>Tenants</h2>
      <button onClick={() => { setShowForm(true); setEditTenant(null); setFormData({ tenantName: '', tenantCode: '', isActive: true, maxCompanies: 1 }); }} disabled={saving}>
        + Add Tenant
      </button>
      {showForm && (
        <form onSubmit={handleFormSubmit} style={{ margin: '16px 0', padding: 12, border: '1px solid #ccc', maxWidth: 400 }}>
          <div>
            <label>Name: <input required value={formData.tenantName} onChange={e => setFormData({ ...formData, tenantName: e.target.value })} /></label>
          </div>
          <div>
            <label>Code: <input required value={formData.tenantCode} onChange={e => setFormData({ ...formData, tenantCode: e.target.value })} /></label>
          </div>
          <div>
            <label>Active: <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /></label>
          </div>
          <div>
            <label>Max Companies: <input type="number" min={1} value={formData.maxCompanies} onChange={e => setFormData({ ...formData, maxCompanies: Number(e.target.value) })} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="submit" disabled={saving}>{editTenant ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditTenant(null); }} style={{ marginLeft: 8 }}>Cancel</button>
          </div>
        </form>
      )}
      <ul>
        {tenants.map(t => (
          <li key={t.id || t.tenantId}>
            {t.tenantName || t.name} ({t.tenantCode || t.code})
            <button onClick={() => handleEdit(t)} style={{ marginLeft: 8 }}>Edit</button>
            <button onClick={() => handleDelete(t)} style={{ marginLeft: 4 }} disabled={saving}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}