import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import PaymentsIcon from '@mui/icons-material/Payments'
import InputAdornment from '@mui/material/InputAdornment'
import StarIcon from '@mui/icons-material/Star'
import VpnKeyIcon from '@mui/icons-material/VpnKey'
import { fetchBankConfig, updateBankConfig, rotateVoucherKey } from '../../api/shopApi'

const POPULAR_BANKS = [
  { code: 'VCB',    name: 'Vietcombank', bin: '970436' },
  { code: 'TCB',    name: 'Techcombank', bin: '970407' },
  { code: 'MB',     name: 'MB Bank',     bin: '970422' },
  { code: 'ACB',    name: 'ACB',         bin: '970416' },
  { code: 'VPB',    name: 'VPBank',      bin: '970432' },
  { code: 'BIDV',   name: 'BIDV',        bin: '970418' },
  { code: 'CTG',    name: 'VietinBank',  bin: '970415' },
  { code: 'AGR',    name: 'Agribank',    bin: '970405' },
  { code: 'TPB',    name: 'TPBank',      bin: '970423' },
  { code: 'STB',    name: 'Sacombank',   bin: '970403' },
  { code: 'MSB',    name: 'MSB',         bin: '970426' },
  { code: 'SHB',    name: 'SHB',         bin: '970443' },
]

export default function ShopBankConfigPage() {
  const [form, setForm] = useState({ bankBin: '', bankAccountNumber: '', bankAccountName: '', prepaidMenu: false, realtimeInventory: false, processingInventoryRecheck: true, pointsConversionRate: 10000, pointsRoundUp: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [voucherKeySet, setVoucherKeySet] = useState(false)
  const [rotatingKey, setRotatingKey]     = useState(false)
  const [keyMsg, setKeyMsg]               = useState('')

  useEffect(() => {
    fetchBankConfig()
      .then(({ data }) => {
        if (data) {
          setForm({ bankBin: data.bankBin || '', bankAccountNumber: data.bankAccountNumber || '', bankAccountName: data.bankAccountName || '', prepaidMenu: Boolean(data.prepaidMenu), realtimeInventory: Boolean(data.realtimeInventory), processingInventoryRecheck: data.processingInventoryRecheck !== false, pointsConversionRate: data.pointsConversionRate || 10000, pointsRoundUp: Boolean(data.pointsRoundUp) })
          setVoucherKeySet(Boolean(data.voucherSecretSet))
        }
        setLoading(false)
      })
      .catch(() => { setError('Failed to load bank config'); setLoading(false) })
  }, [])

  const set = (field) => (e) => { setForm(f => ({ ...f, [field]: e.target.value })); setSuccess(false) }

  const selectBank = (bank) => {
    setForm(f => ({ ...f, bankBin: bank.bin }))
    setSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false)
    try {
      await updateBankConfig(form)
      setSuccess(true)
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // Build preview VietQR URL
  const previewUrl = form.bankBin && form.bankAccountNumber
    ? `https://img.vietqr.io/image/${form.bankBin}-${form.bankAccountNumber}-qr_only.png?amount=50000&addInfo=TEST&accountName=${encodeURIComponent(form.bankAccountName || '')}`
    : null

  return (
    <Box sx={{ p: 3, maxWidth: 640, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <AccountBalanceIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Bank Account Setup</Typography>
      </Box>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={3}>

          {/* Status alerts */}
          {success && <Alert severity="success" icon={<CheckCircleIcon />}>Bank account saved. Payment QR will use this account.</Alert>}
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          {/* Bank selector */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Quick select bank</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {POPULAR_BANKS.map(bank => {
                  const selected = form.bankBin === bank.bin
                  return (
                    <Chip
                      key={bank.code}
                      label={bank.name}
                      size="small"
                      variant={selected ? 'filled' : 'outlined'}
                      color={selected ? 'primary' : 'default'}
                      onClick={() => selectBank(bank)}
                      sx={{ cursor: 'pointer', fontWeight: selected ? 700 : 400 }}
                    />
                  )
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Account details</Typography>
              <Stack spacing={2}>
                <TextField
                  label="Bank Code / BIN"
                  size="small" fullWidth
                  value={form.bankBin}
                  onChange={set('bankBin')}
                  placeholder="e.g. VCB or 970436"
                  helperText="Use the short code (VCB, MB...) or 6-digit BIN number"
                />
                <TextField
                  label="Account Number"
                  size="small" fullWidth
                  value={form.bankAccountNumber}
                  onChange={set('bankAccountNumber')}
                  placeholder="e.g. 1234567890"
                />
                <TextField
                  label="Account Name"
                  size="small" fullWidth
                  value={form.bankAccountName}
                  onChange={set('bankAccountName')}
                  placeholder="e.g. NGUYEN VAN A"
                  helperText="Use ALL CAPS, no accents"
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Business logic */}
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: form.prepaidMenu ? '#1976d2' : undefined }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PaymentsIcon color={form.prepaidMenu ? 'primary' : 'disabled'} />
                <Typography variant="subtitle2" fontWeight={700}>Order Mode</Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.prepaidMenu}
                    onChange={e => { setForm(f => ({ ...f, prepaidMenu: e.target.checked })); setSuccess(false) }}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Prepaid Menu</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Customer pays before staff confirms. Paid orders cannot be cancelled.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />
              <Divider sx={{ my: 1.5 }} />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.realtimeInventory}
                    onChange={e => { setForm(f => ({ ...f, realtimeInventory: e.target.checked })); setSuccess(false) }}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Real-time inventory check</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Confirming an order checks BOM material stock and marks waiting stock when material is short.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.processingInventoryRecheck}
                    onChange={e => { setForm(f => ({ ...f, processingInventoryRecheck: e.target.checked })); setSuccess(false) }}
                    color="success"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Processing unit recheck</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Let the processing page refresh material inventory and manually input left units for menu availability.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', ml: 0 }}
              />
            </CardContent>
          </Card>

          {/* Points / Loyalty */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <StarIcon color="warning" />
                <Typography variant="subtitle2" fontWeight={700}>Points / Loyalty Programme</Typography>
              </Box>
              <Stack spacing={2}>
                <TextField
                  label="Conversion rate (VND per 1 point)"
                  size="small" fullWidth type="number"
                  value={form.pointsConversionRate}
                  onChange={e => { setForm(f => ({ ...f, pointsConversionRate: Number(e.target.value) || 10000 })); setSuccess(false) }}
                  InputProps={{ startAdornment: <InputAdornment position="start">đ</InputAdornment> }}
                  helperText={`e.g. ${Number(form.pointsConversionRate).toLocaleString('vi-VN')} đ spent = 1 point`}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.pointsRoundUp}
                      onChange={e => { setForm(f => ({ ...f, pointsRoundUp: e.target.checked })); setSuccess(false) }}
                      color="warning"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Round up points</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Off: round down (conservative). On: round up (customer-friendly).
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', ml: 0 }}
                />
              </Stack>
            </CardContent>
          </Card>

          <Button
            variant="contained" size="large" onClick={handleSave} disabled={saving || !form.bankBin || !form.bankAccountNumber}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>

          {/* Voucher Key Management */}
          <Card variant="outlined" sx={{ borderRadius: 2, borderColor: voucherKeySet ? '#16a34a' : '#f59e0b' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <VpnKeyIcon color={voucherKeySet ? 'success' : 'warning'} />
                <Typography variant="subtitle2" fontWeight={700}>Voucher Secret Key</Typography>
                <Chip label={voucherKeySet ? 'Key Set' : 'Not Set'} size="small"
                  color={voucherKeySet ? 'success' : 'warning'} sx={{ fontWeight: 700 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                A secret key used to sign voucher QR codes. Rotating the key will invalidate all existing voucher QRs — customers must re-print.
              </Typography>
              {keyMsg && <Alert severity="info" sx={{ mb: 1.5 }}>{keyMsg}</Alert>}
              <Button
                variant="outlined" color={voucherKeySet ? 'warning' : 'success'}
                onClick={async () => {
                  setRotatingKey(true); setKeyMsg('')
                  try {
                    const { data } = await rotateVoucherKey()
                    setVoucherKeySet(true)
                    setKeyMsg(`Key rotated. Preview: ${data.keyPreview}`)
                  } catch { setKeyMsg('Failed to rotate key') }
                  setRotatingKey(false)
                }}
                disabled={rotatingKey}
                startIcon={rotatingKey ? <CircularProgress size={16} /> : <VpnKeyIcon />}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {voucherKeySet ? 'Rotate Key' : 'Generate Key'}
              </Button>
            </CardContent>
          </Card>

          {/* QR Preview */}
          {previewUrl && (
            <>
              <Divider />
              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 1.5 }}>
                    <QrCode2Icon color="primary" />
                    <Typography variant="subtitle2" fontWeight={700}>Payment QR Preview</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    Sample QR for 50,000 đ — customers will see this at checkout
                  </Typography>
                  <img
                    src={previewUrl}
                    alt="VietQR preview"
                    style={{ width: 220, height: 220, border: '1px solid #e0e0e0', borderRadius: 8 }}
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }}
                  />
                  <Alert severity="warning" sx={{ display: 'none', mt: 1 }}>
                    Could not load QR preview — check bank code and account number.
                  </Alert>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {form.bankAccountName && <strong>{form.bankAccountName}</strong>} · {form.bankAccountNumber}
                  </Typography>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      )}
    </Box>
  )
}
