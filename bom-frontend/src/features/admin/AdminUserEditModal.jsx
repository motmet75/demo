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

const ORDERING_ROLE = 'ROLE_SHOP_ORDERING'
const COUNTER_ROLE = 'ROLE_COUNTER'
const STAFF_ROLE_OPTIONS = [
  { value: COUNTER_ROLE, label: 'Thu ngân / Bàn giao ca' },
  { value: ORDERING_ROLE, label: 'Nhân viên gọi món' }
]

export default function AdminUserEditModal({ open, user, onClose, onSave, saving, currentUser, isSuperAdmin }) {
  const { t, tx } = useI18n()
  const [tenants, setTenants] = useState([])
  const [companies, setCompanies] = useState([])
  const forcedTenantId = !isSuperAdmin && currentUser?.assignedTenantId ? String(currentUser.assignedTenantId) : ''
  const forcedCompanyId = !isSuperAdmin && currentUser?.assignedCompanyId ? String(currentUser.assignedCompanyId) : ''

  useEffect(() => {
    if (!isSuperAdmin) {
      setTenants(forcedTenantId
        ? [{
          id: forcedTenantId,
          tenantName: t('admin.users.assignedTenant'),
          tenantCode: forcedTenantId.slice(0, 8),
          isActive: true
        }]
        : [])
      return
    }
    getTenants().then(setTenants).catch(() => {})
  }, [forcedTenantId, isSuperAdmin, t])

  const initial = useMemo(() => ({
    username: user?.username || '',
    password: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    enabled: user?.enabled ?? true,
    authoritiesText: isSuperAdmin
      ? ((user?.authorities || []).join(', ') || 'ROLE_USER')
      : ORDERING_ROLE,
    staffRole: (user?.authorities || []).includes(COUNTER_ROLE) ? COUNTER_ROLE : ORDERING_ROLE,
    assignedTenantId: forcedTenantId || user?.assignedTenantId || '',
    assignedCompanyId: forcedCompanyId || user?.assignedCompanyId || ''
  }), [user, forcedTenantId, forcedCompanyId, isSuperAdmin])

  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(initial)
  }, [initial])

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
    const authoritiesText = isSuperAdmin ? form.authoritiesText : form.staffRole
    try {
      await onSave({
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        enabled: form.enabled,
        authorities: parseAuthoritiesInput(authoritiesText),
        assignedTenantId: (forcedTenantId || form.assignedTenantId) || null,
        assignedCompanyId: (forcedCompanyId || form.assignedCompanyId) || null
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
          {isSuperAdmin ? (
            <>
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
            </>
          ) : (
            <>
              <FormControl fullWidth disabled={saving}>
                <InputLabel id="staff-role-label">Vai trò nhân viên</InputLabel>
                <Select
                  labelId="staff-role-label"
                  label="Vai trò nhân viên"
                  value={form.staffRole}
                  onChange={handleChange('staffRole')}
                >
                  {STAFF_ROLE_OPTIONS.map((role) => (
                    <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={form.staffRole} size="small" />
              </Box>
            </>
          )}
          <FormControl fullWidth disabled={saving || Boolean(forcedTenantId)}>
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
          <FormControl fullWidth disabled={saving || !form.assignedTenantId || Boolean(forcedCompanyId)}>
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
