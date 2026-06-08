import React, { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import PrintIcon from '@mui/icons-material/Print'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import EditIcon from '@mui/icons-material/Edit'
import UndoIcon from '@mui/icons-material/Undo'
import { fetchOrderTagQr, revertShopOrder } from '../../api/shopApi'
import { printOrderReceipt, printOrderTag } from '../../utils/printOrderReceipt'
import EditOrderDialog from './EditOrderDialog'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const pct = (sell, raw) => {
  if (!sell || !raw || Number(raw) === 0) return '—'
  return ((Number(sell) - Number(raw)) / Number(sell) * 100).toFixed(1) + '%'
}
const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

const STATUS_COLOR = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

function OptionsDisplay({ selectedOptions }) {
  const opts = parseOpts(selectedOptions)
  const entries = Object.entries(opts)
  if (!entries.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {entries.map(([group, val]) => {
        const vals = Array.isArray(val) ? val : [val]
        return vals.map(v => (
          <Chip
            key={`${group}:${v}`}
            label={`${group}: ${v}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
          />
        ))
      })}
    </Box>
  )
}

export default function ShopOrderDetailModal({ open, order, onClose, onRefresh }) {
  const [tagQr, setTagQr]       = useState(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [error, setError]         = useState('')
  const [editOpen, setEditOpen]   = useState(false)

  useEffect(() => {
    if (!open || !order?.id) { setTagQr(null); return }
    setQrLoading(true)
    fetchOrderTagQr(order.id)
      .then(({ data }) => setTagQr(data?.qrBase64 || null))
      .catch(() => setTagQr(null))
      .finally(() => setQrLoading(false))
  }, [open, order?.id])

  const handleRevert = async () => {
    setReverting(true); setError('')
    try {
      await revertShopOrder(order.id)
      onRefresh?.()
      onClose()
    } catch (e) { setError(e.message || 'Failed to revert order') }
    setReverting(false)
  }

  if (!order) return null

  const isPending   = order.status === 'PENDING'
  const isConfirmed = order.status === 'CONFIRMED'

  return (
    <>
      <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md"
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>
            Order #{order.orderNumber ?? order.orderCode}
          </Typography>
          <Chip
            label={order.status}
            color={STATUS_COLOR[order.status] || 'default'}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

          {/* ── Info grid ─────────────────────────────────── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.5, p: 1.25, bgcolor: '#f8f9fa', borderRadius: 1.5 }}>
            <Typography variant="body2"><strong>Customer:</strong> {order.customerName || '—'}</Typography>
            <Typography variant="body2"><strong>Phone:</strong> {order.customerPhone || '—'}</Typography>
            <Typography variant="body2"><strong>Type:</strong> {order.fulfillmentType}</Typography>
            <Typography variant="body2"><strong>Table:</strong> {order.tableName || '—'}</Typography>
            <Typography variant="body2"><strong>Payment:</strong> {order.paymentMethod} / {order.paymentStatus}</Typography>
            <Typography variant="body2"><strong>Delivery fee:</strong> {fmt(order.deliveryFee)}</Typography>
            <Typography variant="body2"><strong>Created:</strong> {dateFmt(order.createdAt)}</Typography>
            {order.confirmedAt && <Typography variant="body2"><strong>Confirmed:</strong> {dateFmt(order.confirmedAt)}</Typography>}
            {order.notes && <Typography variant="body2" sx={{ gridColumn: '1/-1', fontStyle: 'italic', color: 'text.secondary' }}>Note: {order.notes}</Typography>}
          </Box>

          {/* ── Items ─────────────────────────────────────── */}
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12, bgcolor: '#f0f4ff' } }}>
                <TableCell>Item & Options</TableCell>
                <TableCell align="center" width={52}>Qty</TableCell>
                <TableCell align="right" width={100}>Price</TableCell>
                <TableCell align="right" width={80}>Raw</TableCell>
                <TableCell align="right" width={72}>Margin</TableCell>
                <TableCell align="right" width={110}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(order.items || []).map(item => (
                <TableRow key={item.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{item.modelName}</Typography>
                    <OptionsDisplay selectedOptions={item.selectedOptions} />
                    {item.itemNotes && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>
                        {item.itemNotes}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{Number(item.quantity)}</TableCell>
                  <TableCell align="right">{fmt(item.unitPrice)}</TableCell>
                  <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmt(item.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="caption" color="success.main">{pct(item.unitPrice, item.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight={700} color="primary">{fmt(item.lineTotal)}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box sx={{ mt: 1, textAlign: 'right', pr: 1 }}>
            <Typography variant="body2" color="text.secondary">Raw cost: {fmt(order.totalRawCost)}</Typography>
            <Typography fontWeight={800} variant="h6" color="primary">Total: {fmt(order.totalAmount)}</Typography>
          </Box>

          {/* ── QR codes ─────────────────────────────────── */}
          {(tagQr || order.paymentQr) && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Stack direction="row" spacing={3} justifyContent="center">
                {qrLoading && <CircularProgress size={24} />}
                {tagQr && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      Order Tracking QR
                    </Typography>
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  </Box>
                )}
                {order.paymentQr && (
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      Payment QR
                    </Typography>
                    <img
                      src={order.paymentQr?.startsWith('https://')
                        ? order.paymentQr
                        : `data:image/png;base64,${order.paymentQr}`}
                      alt="Payment QR"
                      style={{ width: 140, height: 140, borderRadius: 8, border: '1px solid #e0e0e0' }}
                    />
                  </Box>
                )}
              </Stack>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 0.75, justifyContent: 'space-between' }}>
          {/* ── Left: mutating actions ─────────────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {isPending && (
              <Tooltip title="Edit items on this order">
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setEditOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Edit Order
                </Button>
              </Tooltip>
            )}
            {isConfirmed && (
              <Tooltip title="Revert to Pending — urgent stop">
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={reverting ? <CircularProgress size={14} /> : <UndoIcon />}
                  onClick={handleRevert}
                  disabled={reverting}
                  sx={{ textTransform: 'none' }}
                >
                  Revert to Pending
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* ── Right: print actions + close ──────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tooltip title="Print order tag with tracking QR">
              <Button
                variant="outlined"
                startIcon={qrLoading ? <CircularProgress size={14} /> : <QrCode2Icon />}
                onClick={() => tagQr && printOrderTag(order, tagQr)}
                disabled={qrLoading || !tagQr}
                sx={{ textTransform: 'none' }}
              >
                Print Tag
              </Button>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => printOrderReceipt(order, tagQr)}
              sx={{ textTransform: 'none' }}
            >
              Print Receipt
            </Button>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {editOpen && (
        <EditOrderDialog
          open={editOpen}
          order={order}
          onClose={() => setEditOpen(false)}
          onUpdated={() => { setEditOpen(false); onRefresh?.() }}
        />
      )}
    </>
  )
}
