import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'
import { extendShopValidity } from '../../api/authApi'
import { useI18n } from '../../i18n/I18nContext'

const PRESETS = [7, 30, 90, 365]
const idOf = company => String(company?.id || company?.uuid || '')

export default function AdminShopValidityPanel() {
  const { language, formatDateTime } = useI18n()
  const vi = language === 'vi'
  const [tenants, setTenants] = useState([])
  const [companies, setCompanies] = useState([])
  const [tenantId, setTenantId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [days, setDays] = useState('30')
  const [loading, setLoading] = useState(true)
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const company = useMemo(() => companies.find(item => idOf(item) === companyId), [companies, companyId])

  useEffect(() => {
    let active = true
    getTenants()
      .then(list => {
        if (!active) return
        const rows = Array.isArray(list) ? list : []
        setTenants(rows)
        if (rows.length === 1) setTenantId(String(rows[0].id))
      })
      .catch(err => active && setError(err.message || (vi ? 'Không thể tải danh sách tenant' : 'Failed to load tenants')))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [vi])

  useEffect(() => {
    if (!tenantId) {
      setCompanies([])
      setCompanyId('')
      return
    }
    let active = true
    setLoadingCompanies(true)
    setError('')
    setSuccess('')
    getCompanies(tenantId)
      .then(list => {
        if (!active) return
        const rows = Array.isArray(list) ? list : []
        setCompanies(rows)
        setCompanyId(current => rows.some(item => idOf(item) === current) ? current : (rows.length === 1 ? idOf(rows[0]) : ''))
      })
      .catch(err => active && setError(err.message || (vi ? 'Không thể tải danh sách công ty' : 'Failed to load companies')))
      .finally(() => active && setLoadingCompanies(false))
    return () => { active = false }
  }, [tenantId, vi])

  const extend = async () => {
    const count = Number.parseInt(days, 10)
    if (!companyId) { setError(vi ? 'Chọn công ty cần gia hạn' : 'Select a company to extend'); return }
    if (!Number.isInteger(count) || count < 1 || count > 3650) { setError(vi ? 'Số ngày phải từ 1 đến 3650' : 'Days must be between 1 and 3650'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      const { res, data } = await extendShopValidity(companyId, count)
      if (!res.ok) throw new Error(data?.message || (vi ? 'Gia hạn thất bại' : 'Failed to extend access'))
      setCompanies(current => current.map(item => idOf(item) === companyId ? { ...item, validUntil: data.validUntil, expired: data.expired } : item))
      const name = data.companyName || company?.companyName || ''
      setSuccess(vi ? `Đã gia hạn ${name} đến ${formatDateTime(data.validUntil)}` : `Extended ${name} until ${formatDateTime(data.validUntil)}`)
    } catch (err) {
      setError(err.message || (vi ? 'Gia hạn thất bại' : 'Failed to extend access'))
    } finally { setSaving(false) }
  }

  const expiry = company?.validUntil ? new Date(company.validUntil) : null
  const expired = expiry ? expiry.getTime() <= Date.now() : false

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <AccessTimeIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>{vi ? 'Gia hạn sử dụng cửa hàng' : 'Shop company access'}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {vi ? 'Chọn công ty và cộng thêm thời gian để người dùng tiếp tục sử dụng chức năng cửa hàng.' : 'Select a company and add access time so its users can continue using the shop.'}
        </Typography>
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 1.5 }}>{success}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
          <FormControl size="small" sx={{ minWidth: 220, flex: 1 }} disabled={loading || saving}>
            <InputLabel>Tenant</InputLabel>
            <Select value={tenantId} label="Tenant" onChange={event => { setTenantId(event.target.value); setCompanyId('') }}>
              <MenuItem value=""><em>{vi ? 'Chọn tenant' : 'Select tenant'}</em></MenuItem>
              {tenants.map(item => <MenuItem key={item.id} value={String(item.id)}>{item.tenantName} ({item.tenantCode})</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 240, flex: 1.2 }} disabled={!tenantId || loadingCompanies || saving}>
            <InputLabel>{vi ? 'Công ty cửa hàng' : 'Shop company'}</InputLabel>
            <Select value={companyId} label={vi ? 'Công ty cửa hàng' : 'Shop company'} onChange={event => { setCompanyId(event.target.value); setSuccess('') }}>
              <MenuItem value=""><em>{vi ? 'Chọn công ty' : 'Select company'}</em></MenuItem>
              {companies.map(item => <MenuItem key={idOf(item)} value={idOf(item)}>{item.companyName || item.name} ({item.companyCode || item.code})</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="number" label={vi ? 'Số ngày cộng thêm' : 'Days to add'} value={days} onChange={event => setDays(event.target.value)} inputProps={{ min: 1, max: 3650 }} disabled={saving} sx={{ width: { xs: '100%', md: 160 } }} />
          <Button variant="contained" onClick={extend} disabled={!companyId || saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />} sx={{ minHeight: 40, minWidth: 150, textTransform: 'none', fontWeight: 800 }}>
            {saving ? (vi ? 'Đang gia hạn...' : 'Extending...') : (vi ? 'Gia hạn' : 'Extend access')}
          </Button>
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.5 }}>
          {PRESETS.map(value => <Chip key={value} label={`+${value} ${vi ? 'ngày' : 'days'}`} color={Number(days) === value ? 'primary' : 'default'} variant={Number(days) === value ? 'filled' : 'outlined'} onClick={() => setDays(String(value))} disabled={saving} size="small" />)}
        </Stack>

        {company && (
          <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#f8fafc', borderRadius: 1.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={700}>{vi ? 'Hết hạn hiện tại:' : 'Current expiry:'}</Typography>
            <Typography variant="body2">{expiry ? formatDateTime(expiry) : (vi ? 'Chưa đặt — không giới hạn' : 'Not set — unlimited')}</Typography>
            {expiry && <Chip size="small" label={expired ? (vi ? 'Đã hết hạn' : 'Expired') : (vi ? 'Đang hoạt động' : 'Active')} color={expired ? 'error' : 'success'} />}
          </Box>
        )}
      </CardContent>
    </Card>
  )
}