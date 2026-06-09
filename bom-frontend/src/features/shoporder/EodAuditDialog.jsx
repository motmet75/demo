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

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'

function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 16)
}
function todayEnd() {
  const d = new Date(); d.setHours(23, 59, 59, 0)
  return d.toISOString().slice(0, 16)
}

export default function EodAuditDialog({ open, onClose }) {
  const [fromTime, setFromTime]       = useState(todayStart)
  const [toTime, setToTime]           = useState(todayEnd)
  const [fromOrder, setFromOrder]     = useState('')
  const [toOrder, setToOrder]         = useState('')
  const [preCash, setPreCash]         = useState('')
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
      const fromNum = fromOrder !== '' ? Number(fromOrder) : null
      const toNum   = toOrder   !== '' ? Number(toOrder)   : null

      const orders = all.filter(o => {
        if (o.status === 'CANCELLED') return false
        const t = new Date(o.createdAt)
        if (from && t < from) return false
        if (to   && t > to)   return false
        if (fromNum != null && o.orderNumber != null && o.orderNumber < fromNum) return false
        if (toNum   != null && o.orderNumber != null && o.orderNumber > toNum)   return false
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

      const orderNums = orders.map(o => o.orderNumber).filter(n => n != null)
      const minOrder  = orderNums.length ? Math.min(...orderNums) : null
      const maxOrder  = orderNums.length ? Math.max(...orderNums) : null

      setResult({
        orders, cashTotal, cashCount, qrTotal, qrCount,
        splitCash, splitQr, splitCount, totalCashCollected, totalQrCollected,
        grandTotal, unpaidTotal, unpaidCount, minOrder, maxOrder,
      })
    } catch (e) {
      setError(e.message || 'Failed to load orders')
    }
    setLoading(false)
  }

  const pre   = Number(preCash.replace(/[^0-9]/g, '') || 0)
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
            <TextField label="From order #" type="number" size="small" value={fromOrder}
              onChange={e => setFromOrder(e.target.value)} placeholder="(any)" />
            <TextField label="To order #" type="number" size="small" value={toOrder}
              onChange={e => setToOrder(e.target.value)} placeholder="(any)" />
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
                  <b>{result.orders.length}</b> orders &nbsp;·&nbsp;
                  Order #{result.minOrder ?? '?'} → #{result.maxOrder ?? '?'}
                </Typography>
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
                    label="Pre-cash (opening balance)" type="number" size="small" fullWidth
                    value={preCash} onChange={e => setPreCash(e.target.value)}
                    placeholder="0" helperText="Cash already in the drawer at start of shift"
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
