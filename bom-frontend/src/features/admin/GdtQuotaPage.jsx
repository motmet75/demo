import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, Divider, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
import { fetchAdminUsers } from '../../api/adminUserApi'
import {
  fetchGdtDefaults, fetchGdtTenantPolicy, fetchGdtTenantUsage,
  updateGdtDefaults, updateGdtTenantPolicy
} from '../../api/gdtControlApi'

const numberFields = [
  ['monthlyRunLimit', 'Report runs / month', 'Used when quota mode is RUN.'],
  ['monthlyInvoiceLimit', 'Unique invoices / month', 'Used when quota mode is INVOICE.'],
  ['monthlyOcrLimit', 'Online OCR / month', 'Anhmedia Google Vision requests per month.'],
  ['dailyOcrLimit', 'Online OCR / day', 'Daily protection that caused HTTP 429.'],
  ['maxInvoicesPerJob', 'Maximum invoices / job', 'Applies to INVOICE quota mode.'],
  ['maxDevices', 'Desktop devices', 'Maximum active desktop device identities.']
]

const toLocalInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const integer = (value) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0

function UsageChip({ label, used, limit, remaining }) {
  const exhausted = Number(remaining) <= 0
  return <Chip color={exhausted ? 'error' : 'success'} variant={exhausted ? 'filled' : 'outlined'} label={`${label}: ${used ?? 0}/${limit ?? 0} · còn ${remaining ?? 0}`} />
}

function PolicyFields({ value, onChange, defaults = false }) {
  const set = (field, next) => onChange({ ...value, [field]: next })
  return <Grid container spacing={2}>
    {defaults && <Grid item xs={12} sm={6} md={3}><TextField fullWidth type="number" label="Trial days" value={value.trialDays ?? 0} onChange={e => set('trialDays', integer(e.target.value))} inputProps={{ min: 1 }} /></Grid>}
    <Grid item xs={12} sm={6} md={3}><TextField select fullWidth label="Download quota mode" value={value.invoiceQuotaMode || 'RUN'} onChange={e => set('invoiceQuotaMode', e.target.value)}>
      <MenuItem value="RUN">RUN — report runs</MenuItem><MenuItem value="INVOICE">INVOICE — unique invoices</MenuItem>
    </TextField></Grid>
    {numberFields.map(([field, label, help]) => <Grid item xs={12} sm={6} md={3} key={field}><TextField fullWidth type="number" label={label} value={value[field] ?? 0} onChange={e => set(field, integer(e.target.value))} helperText={help} inputProps={{ min: field.startsWith('max') ? 1 : 0 }} /></Grid>)}
    {defaults && <Grid item xs={12} sm={6} md={3}><TextField fullWidth type="number" label="Telemetry retention days" value={value.telemetryRetentionDays ?? 0} onChange={e => set('telemetryRetentionDays', integer(e.target.value))} inputProps={{ min: 1 }} /></Grid>}
    {!defaults && <Grid item xs={12} sm={6} md={3}><TextField fullWidth type="datetime-local" label="Trial ends" value={value.trialEndsAt || ''} onChange={e => set('trialEndsAt', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>}
    <Grid item xs={12}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <FormControlLabel control={<Checkbox checked={Boolean(value.localOcrEnabled)} onChange={e => set('localOcrEnabled', e.target.checked)} />} label="Allow Local OCR" />
      <FormControlLabel control={<Checkbox checked={Boolean(value.onlineOcrEnabled)} onChange={e => set('onlineOcrEnabled', e.target.checked)} />} label="Allow Anhmedia online OCR" />
      {!defaults && <FormControlLabel control={<Checkbox checked={Boolean(value.suspended)} onChange={e => set('suspended', e.target.checked)} />} label="Suspend GDT service" />}
    </Stack></Grid>
  </Grid>
}

export default function GdtQuotaPage() {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [defaults, setDefaults] = useState(null)
  const [policy, setPolicy] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadInitial = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [userRows, defaultValue] = await Promise.all([fetchAdminUsers(), fetchGdtDefaults()])
      setUsers(userRows.filter(user => user.assignedTenantId))
      setDefaults(defaultValue)
    } catch (e) { setError(e.message || 'Cannot load GDT quota settings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadInitial, 0)
    return () => window.clearTimeout(timer)
  }, [loadInitial])

  const tenantUsers = useMemo(() => selected ? users.filter(user => String(user.assignedTenantId) === String(selected.assignedTenantId)) : [], [selected, users])

  const loadTenant = useCallback(async (user) => {
    setSelected(user); setPolicy(null); setUsage(null); setError(''); setNotice('')
    if (!user?.assignedTenantId) return
    setLoading(true)
    try {
      const [policyValue, usageValue] = await Promise.all([fetchGdtTenantPolicy(user.assignedTenantId), fetchGdtTenantUsage(user.assignedTenantId)])
      setPolicy({ ...policyValue, trialEndsAt: toLocalInput(policyValue.trialEndsAt) })
      setUsage(usageValue)
    } catch (e) { setError(e.message || 'Cannot load customer quota') }
    finally { setLoading(false) }
  }, [])

  const saveDefaults = async () => {
    setSaving('defaults'); setError(''); setNotice('')
    try { setDefaults(await updateGdtDefaults(defaults)); setNotice('Global GDT defaults saved.') }
    catch (e) { setError(e.message || 'Cannot save defaults') }
    finally { setSaving('') }
  }

  const saveTenant = async () => {
    if (!selected?.assignedTenantId || !policy) return
    setSaving('tenant'); setError(''); setNotice('')
    try {
      const payload = {
        trialEndsAt: policy.trialEndsAt ? new Date(policy.trialEndsAt).toISOString() : null,
        invoiceQuotaMode: policy.invoiceQuotaMode,
        monthlyRunLimit: policy.monthlyRunLimit,
        monthlyInvoiceLimit: policy.monthlyInvoiceLimit,
        monthlyOcrLimit: policy.monthlyOcrLimit,
        dailyOcrLimit: policy.dailyOcrLimit,
        maxInvoicesPerJob: policy.maxInvoicesPerJob,
        maxDevices: policy.maxDevices,
        localOcrEnabled: policy.localOcrEnabled,
        onlineOcrEnabled: policy.onlineOcrEnabled,
        suspended: policy.suspended,
      }
      const saved = await updateGdtTenantPolicy(selected.assignedTenantId, payload)
      setPolicy({ ...saved, trialEndsAt: toLocalInput(saved.trialEndsAt) })
      setUsage(await fetchGdtTenantUsage(selected.assignedTenantId))
      setNotice('Customer GDT quota saved. New limits apply immediately.')
    } catch (e) { setError(e.message || 'Cannot save customer quota') }
    finally { setSaving('') }
  }

  if (loading && !defaults && !selected) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>

  return <Box sx={{ p: { xs: 1, md: 3 } }}>
    <Typography variant="h4" fontWeight={800} gutterBottom>GDT OCR & Download Quotas</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Super Admin control for desktop OCR, invoice downloads, report runs, devices, trials, and suspension.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

    <Card sx={{ mb: 3 }}><CardContent>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box><Typography variant="h6">Global defaults</Typography><Typography variant="body2" color="text.secondary">Used for customers without an explicit override.</Typography></Box>
        <Button variant="contained" startIcon={<SaveIcon />} disabled={!defaults || saving === 'defaults'} onClick={saveDefaults}>{saving === 'defaults' ? 'Saving…' : 'Save defaults'}</Button>
      </Stack>
      {defaults && <PolicyFields value={defaults} onChange={setDefaults} defaults />}
    </CardContent></Card>

    <Card><CardContent>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box><Typography variant="h6">Customer override</Typography><Typography variant="body2" color="text.secondary">Search by username or email. Limits are shared by every user assigned to the same tenant.</Typography></Box>
        <Button startIcon={<RefreshIcon />} onClick={() => selected ? loadTenant(selected) : loadInitial()} disabled={loading}>Refresh</Button>
      </Stack>
      <Autocomplete
        options={users}
        value={selected}
        onChange={(_, value) => loadTenant(value)}
        getOptionLabel={user => `${user.email || user.username} · ${user.username}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={params => <TextField {...params} label="User email or username" placeholder="maythuyminhchau@gmail.com" />}
      />

      {selected && <Box sx={{ mt: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }}>Tenant <strong>{selected.assignedTenantId}</strong> is shared by {tenantUsers.length} configured user(s): {tenantUsers.map(user => user.email || user.username).join(', ')}</Alert>
        {usage && <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <UsageChip label="Runs this month" used={usage.runUsed} limit={usage.policy?.monthlyRunLimit} remaining={usage.runRemaining} />
          <UsageChip label="Invoices this month" used={usage.invoiceUsed} limit={usage.policy?.monthlyInvoiceLimit} remaining={usage.invoiceRemaining} />
          <UsageChip label="OCR this month" used={usage.ocrUsed} limit={usage.policy?.monthlyOcrLimit} remaining={usage.ocrRemaining} />
          <UsageChip label="OCR today" used={usage.ocrToday} limit={usage.policy?.dailyOcrLimit} remaining={usage.ocrTodayRemaining} />
        </Stack>}
        <Divider sx={{ mb: 2 }} />
        {loading && !policy ? <CircularProgress /> : policy && <>
          <PolicyFields value={policy} onChange={setPolicy} />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}><Button variant="contained" startIcon={<SaveIcon />} onClick={saveTenant} disabled={saving === 'tenant'}>{saving === 'tenant' ? 'Saving…' : 'Save customer quota'}</Button></Box>
        </>}
      </Box>}
    </CardContent></Card>
  </Box>
}
