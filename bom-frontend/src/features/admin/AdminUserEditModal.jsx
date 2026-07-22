import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField
} from '@mui/material'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'
import { useI18n } from '../../i18n/I18nContext'

const parseAuthoritiesInput = (value) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

export default function AdminUserEditModal({ open, user, onClose, onSave, saving }) {
  const { t, tx } = useI18n()
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
      <DialogTitle>{t(user ? 'admin.users.editTitle' : 'admin.users.createTitle')}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          {error ? <Alert severity="error">{tx(error)}</Alert> : null}
          <TextField label={t('admin.users.username')} value={form.username} onChange={handleChange('username')} required disabled={saving} />
          <TextField
            label={user ? t('admin.users.newPasswordKeep') : t('common.password')}
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            required={!user}
            disabled={saving}
          />
          <TextField label={t('admin.users.firstName')} value={form.firstName} onChange={handleChange('firstName')} required disabled={saving} />
          <TextField label={t('admin.users.lastName')} value={form.lastName} onChange={handleChange('lastName')} required disabled={saving} />
          <TextField label={t('admin.users.email')} type="email" value={form.email} onChange={handleChange('email')} disabled={saving} />
          <FormControlLabel control={<Switch checked={!!form.enabled} onChange={handleChange('enabled')} disabled={saving} />} label={t('admin.users.enabled')} />
          <TextField
            label={t('admin.users.authorities')}
            value={form.authoritiesText}
            onChange={handleChange('authoritiesText')}
            helperText={t('admin.users.authoritiesHelp')}
            disabled={saving}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {parseAuthoritiesInput(form.authoritiesText).map((role) => <Chip key={role} label={role} size="small" />)}
          </Box>
          <FormControl fullWidth disabled={saving}>
            <InputLabel id="assigned-tenant-label">{t('admin.users.assignedTenant')}</InputLabel>
            <Select
              labelId="assigned-tenant-label"
              label={t('admin.users.assignedTenant')}
              value={form.assignedTenantId}
              onChange={handleChange('assignedTenantId')}
            >
              <MenuItem value=""><em>{t('admin.users.none')}</em></MenuItem>
              {tenants.map((tenant) => (
                <MenuItem key={tenant.id} value={tenant.id}>
                  {tenant.tenantName} ({tenant.tenantCode}){!tenant.isActive ? ` [${t('admin.users.inactive')}]` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={saving || !form.assignedTenantId}>
            <InputLabel id="assigned-company-label">{t('admin.users.assignedCompany')}</InputLabel>
            <Select
              labelId="assigned-company-label"
              label={t('admin.users.assignedCompany')}
              value={form.assignedCompanyId}
              onChange={handleChange('assignedCompanyId')}
            >
              <MenuItem value=""><em>{t('admin.users.none')}</em></MenuItem>
              {companies.map((company) => (
                <MenuItem key={company.id} value={String(company.id)}>
                  {company.companyName ?? company.name} ({company.companyCode ?? company.code})
                </MenuItem>
              ))}
            </Select>
            {!form.assignedTenantId && (
              <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, ml: 1.5 }}>
                {t('admin.users.selectTenantFirst')}
              </Box>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? t('admin.users.saving') : t('common.save')}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
