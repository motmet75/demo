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
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import { generateWalkUpQr } from '../../api/shopApi'
import { printWalkUpQr } from '../../utils/printOrderReceipt'

export default function QrOrderDialog({ open, onClose }) {
  const [seq, setSeq]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null)   // { qrBase64, seq }

  const handleGenerate = async () => {
    setLoading(true); setError('')
    try {
      const seqVal = seq !== '' ? Number(seq) : null
      const { res, data } = await generateWalkUpQr(seqVal)
      if (!res.ok) { setError(data?.message || 'Failed to generate QR'); setLoading(false); return }
      setResult({ qrBase64: data.qrBase64, seq: data.seq ?? null, qrUrl: data.qrUrl ?? null })
    } catch (e) { setError(e.message || 'Network error') }
    setLoading(false)
  }

  const handleReset = () => { setResult(null); setSeq(''); setError('') }

  const handleClose = () => { handleReset(); onClose() }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCode2Icon color="primary" />
          <Typography fontWeight={800} variant="h6">QR Order Slip</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}

        {!result ? (
          /* ── Form ───────────────────────────────────────── */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Generate a QR code slip for a customer to scan and place their order.
              Optionally assign a sequence number — the order will be created with that number.
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
          </Box>
        ) : (
          /* ── Result ─────────────────────────────────────── */
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            {result.seq != null && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
                  Order number
                </Typography>
                <Typography sx={{ fontSize: 72, fontWeight: 900, lineHeight: 1, color: '#1976d2', letterSpacing: -3 }}>
                  #{result.seq}
                </Typography>
              </Box>
            )}

            <Box sx={{
              display: 'inline-block', p: 1.5, bgcolor: '#fff',
              borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <img
                src={`data:image/png;base64,${result.qrBase64}`}
                alt="Order QR"
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontWeight: 500 }}>
              Customer scans to view menu and order
            </Typography>
            {result.seq == null && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Order number will be assigned automatically
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1 }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>Cancel</Button>
            <Button
              variant="contained" onClick={handleGenerate} disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <QrCode2Icon />}
              sx={{ fontWeight: 700, textTransform: 'none', flex: 1 }}
            >
              {loading ? 'Generating…' : 'Generate QR'}
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
              onClick={() => printWalkUpQr(result.seq, result.qrBase64, result.qrUrl)}
              sx={{ fontWeight: 700, textTransform: 'none', flex: 1 }}
            >
              Print Slip
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
