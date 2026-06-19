import React, { useEffect, useState } from 'react'
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
import Chip from '@mui/material/Chip'
import MergeIcon from '@mui/icons-material/MergeType'
import { fetchShopOrders, mergeBills } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const ACTIVE = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY']
const STATUS_COLOR = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success' }

export default function MergeBillsDialog({ open, order, onClose, onMerge }) {
  const [orders, setOrders]   = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!open || !order) return
    setLoading(true); setError(''); setSelected(new Set())
    fetchShopOrders()
      .then(({ data }) => {
        const others = (data || []).filter(o =>
          o.id !== order.id && ACTIVE.includes(o.status)
        )
        setOrders(others)
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false))
  }, [open, order])

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleMerge = async () => {
    if (selected.size === 0) { setError('Select at least one order to merge'); return }
    setSaving(true); setError('')
    try {
      const { res, data } = await mergeBills(order.id, [...selected])
      if (!res.ok) { setError(data?.error || 'Merge failed'); setSaving(false); return }
      onMerge?.(data)
      onClose()
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  const primaryNum = order?.orderNumber ? `#${order.orderNumber}` : order?.orderCode

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <MergeIcon color="primary" />
        <Typography fontWeight={800} variant="h6">Merge Bills into {primaryNum}</Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Select orders to merge into <strong>{primaryNum}</strong>. Those orders will be cancelled after merging.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box>
        ) : orders.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>No other active orders found</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {orders.map(o => {
              const num = o.orderNumber ? `#${o.orderNumber}` : o.orderCode
              const total = Number(o.totalAmount || 0)
              return (
                <Box key={o.id}
                  onClick={() => toggle(o.id)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5,
                    border: selected.has(o.id) ? '1.5px solid #1976d2' : '1px solid #e0e0e0',
                    bgcolor: selected.has(o.id) ? '#e3f2fd' : '#fafafa',
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                  <Checkbox checked={selected.has(o.id)} size="small" sx={{ p: 0.25 }} />
                  <Typography fontWeight={700} sx={{ minWidth: 40, fontSize: 15 }}>{num}</Typography>
                  {o.tableName && <Chip label={`Table ${o.tableName}`} size="small" sx={{ height: 18, fontSize: 10 }} />}
                  <Chip label={o.status} color={STATUS_COLOR[o.status] || 'default'} size="small" sx={{ height: 18, fontSize: 10 }} />
                  <Box sx={{ flex: 1 }} />
                  <Typography fontWeight={700} color="primary" sx={{ fontSize: 14 }}>{fmt(total)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {(o.items || []).filter(i => !i.parentItemId).length} items
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleMerge} disabled={saving || selected.size === 0}
          startIcon={saving ? <CircularProgress size={16} /> : <MergeIcon />}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? 'Merging…' : `Merge ${selected.size > 0 ? `(${selected.size})` : ''} into ${primaryNum}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
