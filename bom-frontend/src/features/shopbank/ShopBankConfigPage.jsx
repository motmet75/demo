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
import { fetchBankConfig, updateBankConfig } from '../../api/shopApi'

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
  const [form, setForm] = useState({ bankBin: '', bankAccountNumber: '', bankAccountName: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBankConfig()
      .then(({ data }) => {
        if (data) setForm({ bankBin: data.bankBin || '', bankAccountNumber: data.bankAccountNumber || '', bankAccountName: data.bankAccountName || '' })
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

          <Button
            variant="contained" size="large" onClick={handleSave} disabled={saving || !form.bankBin || !form.bankAccountNumber}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Bank Account'}
          </Button>

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
