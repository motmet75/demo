import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { fetchShopOrders } from '../../api/shopApi'

const fmt         = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'
const fmtDots     = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripDigits = (s) => s.replace(/[^0-9]/g, '')

function localDateTimeStr(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return localDateTimeStr(d)
}
function todayEnd() {
  const d = new Date(); d.setHours(23, 59, 0, 0)
  return localDateTimeStr(d)
}

export default function EodAuditDialog({ open, onClose }) {
  const [fromTime, setFromTime]       = useState(todayStart)
  const [toTime, setToTime]           = useState(todayEnd)
  const [fromCode, setFromCode]       = useState('')
  const [toCode, setToCode]           = useState('')
  const [preCashDigits, setPreCashDigits] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState(null)

  const handleLoad = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await fetchShopOrders(null)
      const all = Array.isArray(data) ? data : []

      const from = fromTime ? new Date(fromTime) : null
      const to   = toTime   ? new Date(toTime)   : null
      const fc   = fromCode.trim()
      const tc   = toCode.trim()

      const orders = all.filter(o => {
        if (o.status === 'CANCELLED') return false
        const t = new Date(o.createdAt)
        if (from && t < from) return false
        if (to   && t > to)   return false
        if (fc && o.orderCode && o.orderCode < fc) return false
        if (tc && o.orderCode && o.orderCode > tc) return false
        return true
      })

      // Totals
      let cashTotal = 0, qrTotal = 0, splitCash = 0, splitQr = 0
      let cashCount = 0, qrCount = 0, splitCount = 0
      let unpaidTotal = 0, unpaidCount = 0

      orders.forEach(o => {
        const amt    = Number(o.totalAmount || 0)
        const sCash  = Number(o.splitCashAmount || 0)
        if (o.paymentMethod === 'CASH') {
          cashTotal += amt; cashCount++
        } else if (o.paymentMethod === 'BANK_QR') {
          qrTotal += amt; qrCount++
        } else if (o.paymentMethod === 'SPLIT') {
          splitCash += sCash; splitQr += (amt - sCash); splitCount++
        }
        if (o.paymentStatus !== 'PAID') {
          unpaidTotal += amt; unpaidCount++
        }
      })

      const totalCashCollected = cashTotal + splitCash
      const totalQrCollected   = qrTotal + splitQr
      const grandTotal         = cashTotal + qrTotal + splitCash + splitQr

      const codes    = orders.map(o => o.orderCode).filter(Boolean).sort()
      const firstCode = codes.length ? codes[0] : null
      const lastCode  = codes.length ? codes[codes.length - 1] : null

      setResult({
        orders, cashTotal, cashCount, qrTotal, qrCount,
        splitCash, splitQr, splitCount, totalCashCollected, totalQrCollected,
        grandTotal, unpaidTotal, unpaidCount, firstCode, lastCode,
      })
    } catch (e) {
      setError(e.message || 'Failed to load orders')
    }
    setLoading(false)
  }

  const pre     = preCashDigits ? Number(preCashDigits) : 0
  const newCash = result ? pre + result.totalCashCollected : pre

  const Row = ({ label, value, bold, color, bg }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      px: 1.5, py: 0.6, bgcolor: bg || 'transparent', borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color || 'text.primary'} sx={{ fontSize: 13 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={bold ? 800 : 600} color={color || 'text.primary'} sx={{ fontSize: 13 }}>
        {value}
      </Typography>
    </Box>
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <AssessmentIcon color="primary" />
        <Typography fontWeight={800} variant="h6">End of Day Audit</Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          {/* Filters */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField label="From time" type="datetime-local" size="small" value={fromTime}
              onChange={e => setFromTime(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="To time" type="datetime-local" size="small" value={toTime}
              onChange={e => setToTime(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="From order ID" size="small" value={fromCode}
              onChange={e => setFromCode(e.target.value)} placeholder="(any)"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText="paste order string ID" />
            <TextField label="To order ID" size="small" value={toCode}
              onChange={e => setToCode(e.target.value)} placeholder="(any)"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText="paste order string ID" />
          </Box>

          <Button variant="contained" onClick={handleLoad} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <AssessmentIcon />}
            sx={{ fontWeight: 700, textTransform: 'none' }}>
            {loading ? 'Loading…' : 'Load & Calculate'}
          </Button>

          {result && (
            <>
              <Divider />

              {/* Order range info */}
              <Box sx={{ bgcolor: '#f1f5f9', borderRadius: 1.5, px: 1.5, py: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Scope
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  <b>{result.orders.length}</b> orders
                </Typography>
                {result.firstCode && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">From</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.firstCode}</Typography>
                    <Typography variant="caption" color="text.secondary">to</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.lastCode}</Typography>
                  </Box>
                )}
              </Box>

              {/* Revenue breakdown */}
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <Box sx={{ bgcolor: '#e3f2fd', px: 1.5, py: 0.75 }}>
                  <Typography variant="caption" fontWeight={800} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Revenue Breakdown
                  </Typography>
                </Box>
                <Row label={`Cash (${result.cashCount} orders)`} value={fmt(result.cashTotal)} />
                <Row label={`QR / Bank transfer (${result.qrCount} orders)`} value={fmt(result.qrTotal)} />
                {result.splitCount > 0 && <>
                  <Row label={`Split — cash portion (${result.splitCount} orders)`} value={fmt(result.splitCash)} />
                  <Row label={`Split — QR portion`} value={fmt(result.splitQr)} />
                </>}
                <Divider />
                <Row label="Total Cash Collected" value={fmt(result.totalCashCollected)} bold color="#1b5e20" bg="#f0fdf4" />
                <Row label="Total QR Collected" value={fmt(result.totalQrCollected)} bold color="#01579b" bg="#e3f2fd" />
                <Divider />
                <Row label="Grand Total" value={fmt(result.grandTotal)} bold color="primary.main" bg="#f8faff" />
                {result.unpaidCount > 0 && (
                  <Row label={`Still unpaid (${result.unpaidCount} orders)`} value={fmt(result.unpaidTotal)} color="error.main" />
                )}
              </Box>

              {/* Cash drawer reconciliation */}
              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <Box sx={{ bgcolor: '#fff8e1', px: 1.5, py: 0.75 }}>
                  <Typography variant="caption" fontWeight={800} color="#e65100" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Cash Drawer
                  </Typography>
                </Box>
                <Box sx={{ px: 1.5, py: 1 }}>
                  <TextField
                    label="Pre-cash (opening balance)" type="text" inputMode="numeric" size="small" fullWidth
                    value={fmtDots(preCashDigits)}
                    onChange={e => setPreCashDigits(stripDigits(e.target.value))}
                    placeholder="0" helperText="Cash already in the drawer at start of shift"
                    inputProps={{ maxLength: 15, style: { fontWeight: 700 } }}
                    InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>đ</Typography> }}
                  />
                </Box>
                <Row label="+ Cash collected" value={fmt(result.totalCashCollected)} />
                <Divider />
                <Row label="= Expected cash in drawer" value={fmt(newCash)} bold color="#1b5e20" bg="#f0fdf4" />
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
