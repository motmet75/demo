import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import { generateQueueQr, generateWalkUpQr } from '../../api/shopApi'
import { printQueueQrTracked, printWalkUpQrTracked } from '../../utils/printWithHistory'

function fmtDate(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) } catch { return '' }
}

export default function QrOrderDialog({ open, onClose }) {
  const [seq, setSeq] = useState('')
  const [maxOrders, setMaxOrders] = useState('12')
  const [queueDays, setQueueDays] = useState('30')
  const [loadingType, setLoadingType] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const loading = Boolean(loadingType)
  const isQueue = result?.type === 'QUEUE'

  const handleGenerateOrder = async () => {
    setLoadingType('order'); setError('')
    try {
      const seqVal = seq !== '' ? Number(seq) : null
      if (seqVal != null && (!Number.isFinite(seqVal) || seqVal < 1)) {
        setError('Order number must be a positive number')
        return
      }
      const maxOrdersRaw = maxOrders !== '' ? Number(maxOrders) : 12
      if (!Number.isFinite(maxOrdersRaw) || maxOrdersRaw < 1) {
        setError('Max orders must be at least 1')
        return
      }
      const maxOrdersLimit = Math.min(Math.floor(maxOrdersRaw), 500)
      const { res, data } = await generateWalkUpQr(seqVal, maxOrdersLimit)
      if (!res.ok) { setError(data?.message || 'Failed to generate QR'); return }
      setResult({
        type: 'ORDER',
        qrBase64: data.qrBase64,
        seq: data.seq ?? null,
        qrUrl: data.qrUrl ?? null,
        token: data.token ?? null,
        maxOrders: data.maxOrders ?? maxOrdersLimit,
      })
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoadingType('')
    }
  }

  const handleGenerateQueue = async () => {
    setLoadingType('queue'); setError('')
    try {
      const daysRaw = Number(queueDays)
      if (!Number.isFinite(daysRaw) || daysRaw < 1) {
        setError('Valid days must be at least 1')
        return
      }
      const validDays = Math.min(Math.floor(daysRaw), 366)
      const { res, data } = await generateQueueQr(validDays)
      if (!res.ok) { setError(data?.message || data?.error || 'Failed to generate queue QR'); return }
      setResult({
        type: 'QUEUE',
        qrBase64: data.qrBase64,
        qrUrl: data.qrUrl,
        token: data.token,
        expiresAt: data.expiresAt,
        validDays: data.validDays ?? validDays,
      })
    } catch (e) {
      setError(e.message || 'Network error')
    } finally {
      setLoadingType('')
    }
  }

  const handleReset = () => { setResult(null); setSeq(''); setMaxOrders('12'); setError('') }
  const handleClose = () => { handleReset(); onClose() }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCode2Icon color="primary" />
          <Typography fontWeight={800} variant="h6">QR Ordering</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}

        {!result ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>Order slip QR</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Temporary QR for one walk-up customer. Optionally assign an order number.
              </Typography>
              <TextField
                label="Order number (optional)"
                placeholder="Leave blank for auto"
                type="number"
                size="small"
                fullWidth
                value={seq}
                onChange={e => setSeq(e.target.value)}
                inputProps={{ min: 1 }}
                helperText={seq ? `Order will be assigned #${seq}` : 'Next available number will be used'}
              />
              <TextField
                label="Max orders accepted"
                type="number"
                size="small"
                fullWidth
                value={maxOrders}
                onChange={e => setMaxOrders(e.target.value)}
                inputProps={{ min: 1, max: 500 }}
                helperText="Default 12. Increase only when counter can accept more orders on this slip."
                sx={{ mt: 1.5 }}
              />
            </Box>

            <Divider />

            <Box>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>Queue QR</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Long-validity QR for customers to scan, choose their table, enter their name, then order.
              </Typography>
              <TextField
                label="Valid days"
                type="number"
                size="small"
                fullWidth
                value={queueDays}
                onChange={e => setQueueDays(e.target.value)}
                inputProps={{ min: 1, max: 366 }}
                helperText="Use 7, 30, 90, 180, or 365 days. Maximum is 366 days."
              />
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            {isQueue ? (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
                  Queue QR
                </Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, color: '#ff5722' }}>
                  Seat + Order
                </Typography>
                <Chip icon={<TableRestaurantIcon />} label={`Valid ${result.validDays || queueDays} days`} size="small" sx={{ mt: 1, fontWeight: 700 }} />
              </Box>
            ) : result.seq != null && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
                  Order number
                </Typography>
                <Typography sx={{ fontSize: 72, fontWeight: 900, lineHeight: 1, color: '#1976d2', letterSpacing: 0 }}>
                  #{result.seq}
                </Typography>
              </Box>
            )}
            {!isQueue && (
              <Chip
                label={`Max ${result.maxOrders || 12} order${Number(result.maxOrders || 12) === 1 ? '' : 's'}`}
                size="small"
                sx={{ mb: 1.5, fontWeight: 700 }}
              />
            )}

            <Box sx={{
              display: 'inline-block', p: 1.5, bgcolor: '#fff',
              borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <img
                src={`data:image/png;base64,${result.qrBase64}`}
                alt={isQueue ? 'Queue QR' : 'Order QR'}
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontWeight: 500 }}>
              {isQueue ? 'Customer scans to choose table, enter name, and order' : 'Customer scans to view menu and order'}
            </Typography>
            {isQueue && result.expiresAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Valid until {fmtDate(result.expiresAt)}
              </Typography>
            )}
            {!isQueue && result.seq == null && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Order number will be assigned automatically
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1, flexWrap: 'wrap' }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button
              variant="outlined" onClick={handleGenerateOrder} disabled={loading}
              startIcon={loadingType === 'order' ? <CircularProgress size={16} /> : <QrCode2Icon />}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              {loadingType === 'order' ? 'Generating...' : 'Order QR'}
            </Button>
            <Button
              variant="contained" onClick={handleGenerateQueue} disabled={loading}
              startIcon={loadingType === 'queue' ? <CircularProgress size={16} /> : <TableRestaurantIcon />}
              sx={{ fontWeight: 700, textTransform: 'none', flex: '1 1 140px' }}
            >
              {loadingType === 'queue' ? 'Generating...' : 'Queue QR'}
            </Button>
          </>
        ) : (
          <>
            <Tooltip title="Generate a new QR">
              <Button startIcon={<RefreshIcon />} onClick={handleReset}
                sx={{ textTransform: 'none' }}>
                New
              </Button>
            </Tooltip>
            <Button
              variant="contained" startIcon={<PrintIcon />}
              onClick={() => isQueue ? printQueueQrTracked(result, setError) : printWalkUpQrTracked(result, setError)}
              sx={{ fontWeight: 700, textTransform: 'none', flex: 1 }}
            >
              {isQueue ? 'Print Queue QR' : 'Print Slip'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}