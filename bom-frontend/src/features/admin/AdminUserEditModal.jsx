import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField
} from '@mui/material'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'

const parseAuthoritiesInput = (value) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

export default function AdminUserEditModal({ open, user, onClose, onSave, saving }) {
  const [tenants, setTenants] = useState([])
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    getTenants().then(setTenants).catch(() => {})
  }, [])

  const initial = useMemo(() => ({
    username: user?.username || '',
    password: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    enabled: user?.enabled ?? true,
    authoritiesText: (user?.authorities || []).join(', '),
    assignedTenantId: user?.assignedTenantId || '',
    assignedCompanyId: user?.assignedCompanyId || ''
  }), [user])

  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')

  React.useEffect(() => {
    setForm(initial)
    setError('')
  }, [initial, open])

  // Load companies whenever the selected tenant changes
  useEffect(() => {
    let cancelled = false
    if (!form.assignedTenantId) {
      Promise.resolve().then(() => { if (!cancelled) setCompanies([]) })
      return () => { cancelled = true }
    }
    getCompanies(form.assignedTenantId)
      .then((data) => { if (!cancelled) setCompanies(data) })
      .catch(() => { if (!cancelled) setCompanies([]) })
    return () => { cancelled = true }
  }, [form.assignedTenantId])

  const handleChange = (field) => (event) => {
    const value = field === 'enabled' ? event.target.checked : event.target.value
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // clear company when tenant changes
      if (field === 'assignedTenantId') next.assignedCompanyId = ''
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await onSave({
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        enabled: form.enabled,
        authorities: parseAuthoritiesInput(form.authoritiesText),
        assignedTenantId: form.assignedTenantId || null,
        assignedCompanyId: form.assignedCompanyId || null
      })
    } catch (err) {
      setError(err?.message || 'Save failed')
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{user ? 'Edit User' : 'Create User'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Username" value={form.username} onChange={handleChange('username')} required disabled={saving} />
          <TextField
            label={user ? 'New Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            required={!user}
            disabled={saving}
          />
          <TextField label="First Name" value={form.firstName} onChange={handleChange('firstName')} required disabled={saving} />
          <TextField label="Last Name" value={form.lastName} onChange={handleChange('lastName')} required disabled={saving} />
          <TextField label="Email" type="email" value={form.email} onChange={handleChange('email')} disabled={saving} />
          <FormControlLabel control={<Switch checked={!!form.enabled} onChange={handleChange('enabled')} disabled={saving} />} label="Enabled" />
          <TextField
            label="Authorities"
            value={form.authoritiesText}
            onChange={handleChange('authoritiesText')}
            helperText="Comma-separated roles, for example: ROLE_ADMIN, ROLE_USER"
            disabled={saving}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {parseAuthoritiesInput(form.authoritiesText).map((role) => <Chip key={role} label={role} size="small" />)}
          </Box>
          <FormControl fullWidth disabled={saving}>
            <InputLabel id="assigned-tenant-label">Assigned Tenant</InputLabel>
            <Select
              labelId="assigned-tenant-label"
              label="Assigned Tenant"
              value={form.assignedTenantId}
              onChange={handleChange('assignedTenantId')}
            >
              <MenuItem value=""><em>— None —</em></MenuItem>
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.tenantName} ({t.tenantCode}){!t.isActive ? ' [inactive]' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={saving || !form.assignedTenantId}>
            <InputLabel id="assigned-company-label">Assigned Company</InputLabel>
            <Select
              labelId="assigned-company-label"
              label="Assigned Company"
              value={form.assignedCompanyId}
              onChange={handleChange('assignedCompanyId')}
            >
              <MenuItem value=""><em>— None —</em></MenuItem>
              {companies.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.companyName ?? c.name} ({c.companyCode ?? c.code})
                </MenuItem>
              ))}
            </Select>
            {!form.assignedTenantId && (
              <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, ml: 1.5 }}>
                Select a tenant first to load companies
              </Box>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
