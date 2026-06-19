import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import { splitBill } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'

export default function SplitBillDialog({ open, order, onClose, onSplit }) {
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const rootItems = (order?.items || []).filter(i => !i.parentItemId)
  const childMap  = {}
  ;(order?.items || []).forEach(i => {
    if (i.parentItemId) {
      const k = String(i.parentItemId)
      if (!childMap[k]) childMap[k] = []
      childMap[k].push(i)
    }
  })

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSplit = async () => {
    if (selected.size === 0) { setError('Select at least one item'); return }
    if (selected.size === rootItems.length) { setError('Keep at least one item in the original bill'); return }
    setLoading(true); setError('')
    try {
      const { res, data } = await splitBill(order.id, [...selected])
      if (!res.ok) { setError(data?.error || 'Split failed'); setLoading(false); return }
      onSplit?.(data)
      onClose()
    } catch (e) { setError(e.message || 'Network error') }
    setLoading(false)
  }

  const selectedTotal = rootItems
    .filter(i => selected.has(i.id))
    .reduce((s, i) => {
      const children = childMap[String(i.id)] || []
      const pQty = Number(i.quantity || 1)
      return s + Number(i.lineTotal || 0) + children.reduce((cs, c) => cs + Number(c.lineTotal || 0) * pQty, 0)
    }, 0)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <CallSplitIcon color="primary" />
        <Typography fontWeight={800} variant="h6">Split Bill</Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Select items to move to a new bill. The rest stay in the original.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {rootItems.map(item => {
            const children = childMap[String(item.id)] || []
            const pQty = Number(item.quantity || 1)
            const subtotal = Number(item.lineTotal || 0) + children.reduce((s, c) => s + Number(c.lineTotal || 0) * pQty, 0)
            return (
              <Box key={item.id}
                onClick={() => toggle(item.id)}
                sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1, p: 1, borderRadius: 1.5,
                  border: selected.has(item.id) ? '1.5px solid #1976d2' : '1px solid #e0e0e0',
                  bgcolor: selected.has(item.id) ? '#e3f2fd' : '#fafafa',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                <Checkbox checked={selected.has(item.id)} size="small" sx={{ p: 0.25, mt: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight={700} sx={{ fontSize: 14 }}>
                      {item.quantity}× {item.modelName}
                    </Typography>
                    <Typography fontWeight={700} sx={{ fontSize: 14, color: '#1976d2', ml: 1 }}>
                      {fmt(subtotal)}
                    </Typography>
                  </Box>
                  {children.map(c => (
                    <Typography key={c.id} variant="caption" color="text.secondary" display="block" sx={{ pl: 1 }}>
                      + {c.quantity}× {c.modelName}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )
          })}
        </Box>

        {selected.size > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
              <Typography variant="body2" color="text.secondary">New bill total</Typography>
              <Typography fontWeight={800} color="primary">{fmt(selectedTotal)}</Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSplit} disabled={loading || selected.size === 0}
          startIcon={loading ? <CircularProgress size={16} /> : <CallSplitIcon />}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          {loading ? 'Splitting…' : `Split ${selected.size > 0 ? `(${selected.size} item${selected.size > 1 ? 's' : ''})` : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
