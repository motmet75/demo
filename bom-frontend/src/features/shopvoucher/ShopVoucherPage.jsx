import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import AddIcon from '@mui/icons-material/Add'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import DeleteIcon from '@mui/icons-material/Delete'
import RedeemIcon from '@mui/icons-material/Redeem'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import { fetchVouchers, createVoucher, cancelVoucher, redeemVoucher } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const STATUS_COLOR = { ACTIVE: 'success', USED: 'default', EXPIRED: 'warning', CANCELLED: 'error' }

function CreateVoucherDialog({ open, onClose, onCreated }) {
  const [faceValue, setFaceValue] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [expiry, setExpiry]       = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { if (open) { setFaceValue(''); setSalePrice(''); setExpiry(''); setNotes(''); setError('') } }, [open])

  const save = async () => {
    if (!faceValue || Number(faceValue) <= 0) { setError('Face value is required'); return }
    setSaving(true); setError('')
    try {
      const { res, data } = await createVoucher({
        faceValue: Number(faceValue),
        salePrice: salePrice ? Number(salePrice) : null,
        expiryDate: expiry || null,
        notes: notes || null,
      })
      if (!res.ok) { setError(data?.error || 'Create failed'); setSaving(false); return }
      onCreated(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={800}>Create Voucher</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Face Value *" size="small" fullWidth type="number"
          value={faceValue} onChange={e => setFaceValue(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">đ</InputAdornment> }}
          helperText="Value customer can redeem against an order" />
        <TextField label="Sale Price (optional)" size="small" fullWidth type="number"
          value={salePrice} onChange={e => setSalePrice(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start">đ</InputAdornment> }}
          helperText="How much you sold this voucher for" />
        <TextField label="Expiry Date (optional)" size="small" fullWidth type="date"
          value={expiry} onChange={e => setExpiry(e.target.value)}
          InputLabelProps={{ shrink: true }} />
        <TextField label="Notes" size="small" fullWidth multiline rows={2}
          value={notes} onChange={e => setNotes(e.target.value)} />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function QrDialog({ open, voucher, onClose }) {
  if (!voucher) return null
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCode2Icon color="primary" /> Voucher QR
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', pt: 0 }}>
        <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 3, mb: 0.5, fontFamily: 'monospace' }}>
          {voucher.code}
        </Typography>
        <Typography variant="h5" fontWeight={900} color="success.main" sx={{ mb: 1.5 }}>
          {fmt(voucher.faceValue)}
        </Typography>
        {voucher.qrBase64 ? (
          <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', border: '2px solid #e0e0e0', borderRadius: 2, mb: 1 }}>
            <img src={`data:image/png;base64,${voucher.qrBase64}`} alt="Voucher QR"
              style={{ width: 220, height: 220, display: 'block' }} />
          </Box>
        ) : (
          <Alert severity="warning">No QR — set a voucher secret key in Shop Setup first</Alert>
        )}
        {voucher.expiryDate && (
          <Typography variant="caption" color="text.secondary" display="block">Expires: {voucher.expiryDate}</Typography>
        )}
        {voucher.notes && (
          <Typography variant="caption" color="text.secondary" display="block">{voucher.notes}</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
        <Button variant="contained" onClick={() => window.print()} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Print
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function RedeemDialog({ open, onClose, onRedeemed }) {
  const [code, setCode]       = useState('')
  const [orderId, setOrderId] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null)

  useEffect(() => { if (open) { setCode(''); setOrderId(''); setError(''); setResult(null) } }, [open])

  const redeem = async () => {
    if (!code.trim() || !orderId.trim()) { setError('Enter both voucher code and order ID'); return }
    setSaving(true); setError('')
    try {
      const { res, data } = await redeemVoucher(code.trim().toUpperCase(), orderId.trim())
      if (!res.ok) { setError(data?.error || 'Redeem failed'); setSaving(false); return }
      setResult(data)
      onRedeemed?.(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RedeemIcon color="success" /> Redeem Voucher
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        {result ? (
          <Alert severity="success">
            Voucher {result.voucher?.code} redeemed! Discount applied: {fmt(result.discountApplied)}
          </Alert>
        ) : (
          <>
            <TextField label="Voucher Code" size="small" fullWidth
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              helperText="Or paste the full QR payload (BV:...)" />
            <TextField label="Order ID" size="small" fullWidth
              value={orderId} onChange={e => setOrderId(e.target.value)}
              helperText="UUID of the order to apply this voucher to" />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" color="success" onClick={redeem} disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {saving ? <CircularProgress size={18} /> : 'Redeem'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default function ShopVoucherPage() {
  const [vouchers, setVouchers]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [qrTarget, setQrTarget]     = useState(null)
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [delTarget, setDelTarget]   = useState(null)
  const [deleting, setDeleting]     = useState(false)
  const [filterStatus, setFilterStatus] = useState('ACTIVE')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchVouchers()
      setVouchers(data || [])
    } catch { setError('Failed to load vouchers') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreated = (v) => { setVouchers(prev => [v, ...prev]); setCreateOpen(false); setQrTarget(v) }

  const handleCancel = async () => {
    if (!delTarget) return
    setDeleting(true)
    try {
      const { data } = await cancelVoucher(delTarget.id)
      setVouchers(prev => prev.map(v => v.id === delTarget.id ? data : v))
      setDelTarget(null)
    } catch { setError('Cancel failed') }
    setDeleting(false)
  }

  const filtered = filterStatus ? vouchers.filter(v => v.status === filterStatus) : vouchers

  return (
    <Box sx={{ p: 2, maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <ConfirmationNumberIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>Vouchers</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RedeemIcon />} onClick={() => setRedeemOpen(true)}
          sx={{ textTransform: 'none' }}>
          Redeem
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
          Create Voucher
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {['', 'ACTIVE', 'USED', 'CANCELLED'].map(s => (
          <Chip key={s} label={s || 'All'} size="small"
            variant={filterStatus === s ? 'filled' : 'outlined'}
            color={filterStatus === s ? 'primary' : 'default'}
            onClick={() => setFilterStatus(s)}
            sx={{ cursor: 'pointer', fontWeight: filterStatus === s ? 700 : 400 }} />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No vouchers found</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map(v => (
            <Box key={v.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
              border: `1px solid ${v.status === 'ACTIVE' ? '#86efac' : '#e0e0e0'}`,
              borderRadius: 2, bgcolor: v.status === 'ACTIVE' ? '#f0fdf4' : '#fafafa',
            }}>
              <Box sx={{ minWidth: 100 }}>
                <Typography fontWeight={900} sx={{ fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 }}>
                  {v.code}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {v.createdAt ? new Date(v.createdAt).toLocaleDateString('vi-VN') : ''}
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={800} color="success.main" sx={{ fontSize: 16 }}>
                  {fmt(v.faceValue)}
                </Typography>
                {v.salePrice && <Typography variant="caption" color="text.secondary">Sold: {fmt(v.salePrice)}</Typography>}
                {v.expiryDate && <Typography variant="caption" color="text.secondary" display="block">Exp: {v.expiryDate}</Typography>}
                {v.notes && <Typography variant="caption" color="text.secondary" display="block">{v.notes}</Typography>}
              </Box>
              <Chip label={v.status} size="small" color={STATUS_COLOR[v.status] || 'default'}
                sx={{ fontWeight: 700, minWidth: 72 }} />
              {v.status === 'ACTIVE' && (
                <Tooltip title="Show QR">
                  <IconButton size="small" color="primary" onClick={() => setQrTarget(v)}>
                    <QrCode2Icon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {v.status === 'ACTIVE' && (
                <Tooltip title="Cancel voucher">
                  <IconButton size="small" color="error" onClick={() => setDelTarget(v)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Box>
      )}

      <CreateVoucherDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <QrDialog open={!!qrTarget} voucher={qrTarget} onClose={() => setQrTarget(null)} />
      <RedeemDialog open={redeemOpen} onClose={() => setRedeemOpen(false)} onRedeemed={() => { load(); setRedeemOpen(false) }} />

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Cancel Voucher?</DialogTitle>
        <DialogContent>
          <Typography>Cancel voucher <strong>{delTarget?.code}</strong> ({fmt(delTarget?.faceValue)})? It cannot be used after cancellation.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDelTarget(null)} sx={{ textTransform: 'none' }}>Keep</Button>
          <Button variant="contained" color="error" onClick={handleCancel} disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {deleting ? <CircularProgress size={18} /> : 'Cancel Voucher'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
