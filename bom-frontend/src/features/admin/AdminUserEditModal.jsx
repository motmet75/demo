import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField
} from '@mui/material'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'
import { checkAdminEmailAvailability } from '../../api/adminUserApi'
import { useI18n } from '../../i18n/I18nContext'

const normalizeEmail = value => String(value || '').trim().toLowerCase()
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const DUPLICATE_EMAIL_MESSAGE = 'Email này đã được sử dụng bởi tài khoản khác. Vui lòng chọn email khác.'

const parseAuthoritiesInput = (value) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const ORDERING_ROLE = 'ROLE_SHOP_ORDERING'
const COUNTER_ROLE = 'ROLE_COUNTER'
const BUSINESS_ROLE = 'ROLE_USER'
const STAFF_ROLE_OPTIONS = [
  { value: BUSINESS_ROLE, label: 'Nhân viên nghiệp vụ' },
  { value: COUNTER_ROLE, label: 'Thu ngân / Bàn giao ca' },
  { value: ORDERING_ROLE, label: 'Nhân viên gọi món' }
]
const MEMBER_ROLES = new Set(STAFF_ROLE_OPTIONS.map(role => role.value))

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
    staffRoles: (user?.authorities || []).filter(role => MEMBER_ROLES.has(role)).length
      ? (user?.authorities || []).filter(role => MEMBER_ROLES.has(role))
      : [ORDERING_ROLE],
    assignedTenantId: forcedTenantId || user?.assignedTenantId || '',
    assignedCompanyId: forcedCompanyId || user?.assignedCompanyId || ''
  }), [user, forcedTenantId, forcedCompanyId, isSuperAdmin])

  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [emailCheck, setEmailCheck] = useState({ email: '', status: 'idle', message: '' })
  const normalizedEmail = normalizeEmail(form.email)
  const emailStatus = emailCheck.email === normalizedEmail ? emailCheck.status : 'idle'
  const emailError = emailStatus === 'duplicate' || emailStatus === 'error' ||
    (emailStatus === 'invalid' && normalizedEmail.length > 0)

  useEffect(() => {
    // Debounce the authenticated server check while the administrator types.
    // A stale request must never report availability for a newer email.
    const email = normalizeEmail(form.email)
    let alive = true
    if (!validEmail(email)) {
      setEmailCheck({ email, status: 'invalid', message: '' })
      return () => { alive = false }
    }
    // Editing the same email is allowed: it already belongs to this user.
    if (user?.id != null && email === normalizeEmail(user?.email)) {
      setEmailCheck({ email, status: 'available', message: '' })
      return () => { alive = false }
    }
    setEmailCheck({ email, status: 'checking', message: '' })
    const timeout = setTimeout(async () => {
      try {
        const available = await checkAdminEmailAvailability(email, user?.id)
        if (alive) setEmailCheck({
          email, status: available ? 'available' : 'duplicate', message: ''
        })
      } catch (err) {
        if (alive) setEmailCheck({
          email, status: 'error',
          message: err?.message || 'Không kiểm tra được email. Hãy thử lại.'
        })
      }
    }, 450)
    return () => { alive = false; clearTimeout(timeout) }
  }, [form.email, user?.id, user?.email])

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
    setError('')
    const value = field === 'enabled' ? event.target.checked : event.target.value
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'assignedTenantId') next.assignedCompanyId = ''
      return next
    })
  }

  const toggleAuthorityRole = (role) => {
    setForm((prev) => {
      const roles = new Set(parseAuthoritiesInput(prev.authoritiesText))
      if (roles.has(role)) roles.delete(role)
      else roles.add(role)
      return { ...prev, authoritiesText: [...roles].join(', ') }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const email = normalizeEmail(form.email)
    if (!validEmail(email)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.')
      return
    }
    if (emailStatus === 'duplicate') {
      setError(DUPLICATE_EMAIL_MESSAGE)
      return
    }
    const authoritiesText = isSuperAdmin ? form.authoritiesText : form.staffRoles.join(', ')
    try {
      // Recheck immediately before submission (also covers stale debounce
      // results); the backend DB unique constraint remains the final guard.
      const available = await checkAdminEmailAvailability(email, user?.id)
      setEmailCheck({ email, status: available ? 'available' : 'duplicate', message: '' })
      if (!available) {
        setError(DUPLICATE_EMAIL_MESSAGE)
        return
      }
      await onSave({
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        email,
        enabled: form.enabled,
        authorities: parseAuthoritiesInput(authoritiesText),
        assignedTenantId: (forcedTenantId || form.assignedTenantId) || null,
        assignedCompanyId: (forcedCompanyId || form.assignedCompanyId) || null
      })
    } catch (err) {
      const message = err?.message || 'Không lưu được tài khoản.'
      if (/email/i.test(message) && /(đã|trùng|tồn tại|duplicate|registered|exists)/i.test(message)) {
        setEmailCheck({ email, status: 'duplicate', message: '' })
      }
      setError(message)
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
          <TextField label={t('admin.users.email')} type="email" value={form.email}
            onChange={handleChange('email')} required disabled={saving}
            error={emailError || (Boolean(error) && /email/i.test(error))}
            helperText={emailStatus === 'duplicate' ? DUPLICATE_EMAIL_MESSAGE :
              emailStatus === 'checking' ? 'Đang kiểm tra email...' :
              emailStatus === 'available' ? 'Email có thể sử dụng.' :
              emailStatus === 'error' ? emailCheck.message :
              emailStatus === 'invalid' && normalizedEmail.length > 0 ?
                'Địa chỉ email không đúng định dạng.' :
              Boolean(error) && /email/i.test(error) ? error : undefined}/>
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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {STAFF_ROLE_OPTIONS.map((role) => <Chip key={role.value} clickable label={`Gán ${role.label}`} color={parseAuthoritiesInput(form.authoritiesText).includes(role.value) ? 'primary' : 'default'} variant={parseAuthoritiesInput(form.authoritiesText).includes(role.value) ? 'filled' : 'outlined'} onClick={() => toggleAuthorityRole(role.value)} />)}
              </Box>
            </>
          ) : (
            <>
              <FormControl fullWidth disabled={saving}>
                <InputLabel id="staff-role-label">Vai trò nhân viên</InputLabel>
                <Select
                  labelId="staff-role-label"
                  label="Vai trò nhân viên"
                  multiple
                  value={form.staffRoles}
                  onChange={handleChange('staffRoles')}
                  renderValue={(selected) => selected.map(value => STAFF_ROLE_OPTIONS.find(role => role.value === value)?.label || value).join(' · ')}
                >
                  {STAFF_ROLE_OPTIONS.map((role) => (
                    <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {form.staffRoles.map(role => <Chip key={role} label={role} size="small" />)}
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
          <Button type="submit" variant="contained"
            disabled={saving || emailStatus !== 'available'}>
            {saving ? t('admin.users.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
