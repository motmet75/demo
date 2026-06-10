import React, { useEffect, useState, useMemo } from 'react'
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
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import PrintIcon from '@mui/icons-material/Print'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import EditIcon from '@mui/icons-material/Edit'
import UndoIcon from '@mui/icons-material/Undo'
import LabelIcon from '@mui/icons-material/Label'
import MonitorIcon from '@mui/icons-material/Monitor'
import { fetchOrderTagQr, revertShopOrder, switchToQrPayment, splitPayment, revertToCash } from '../../api/shopApi'
import { printOrderReceipt, printOrderTag, printCupLabels } from '../../utils/printOrderReceipt'
import { broadcastToCounter } from '../shopboard/CounterDisplayPage'
import EditOrderDialog from './EditOrderDialog'
import ConfirmActionDialog from './ConfirmActionDialog'

const fmt     = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const fmtDots = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripNonDigits = (s) => s.replace(/[^0-9]/g, '')
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

// ── Change calculator ───────────────────────────────────────────────────────
function ChangeCalc({ label, due, color = '#e65100', bg = '#fff7ed', borderColor = '#f59e0b' }) {
  const [digits, setDigits] = useState('')
  const cashNum = digits ? Number(digits) : 0
  const change  = cashNum - due
  return (
    <Box sx={{ bgcolor: bg, border: `1.5px solid ${borderColor}`, borderRadius: 1.5, p: 1.25 }}>
      <Typography variant="caption" fontWeight={800} color={color}
        sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TextField
          type="text"
          inputMode="numeric"
          size="small"
          label="Customer cash"
          value={fmtDots(digits)}
          onChange={e => setDigits(stripNonDigits(e.target.value))}
          placeholder="0"
          inputProps={{ maxLength: 15, style: { fontSize: 18, fontWeight: 700 } }}
          InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
          sx={{ width: 180 }}
        />
        {digits !== '' && cashNum > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              {change >= 0 ? 'Change' : 'Short'}
            </Typography>
            <Typography fontWeight={900} sx={{
              fontSize: 26, lineHeight: 1, color: change >= 0 ? '#2e7d32' : '#c62828',
            }}>
              {fmt(Math.abs(change))}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function buildItemGroups(items) {
  const roots = (items || []).filter(it => !it.parentItemId)
  return roots.map((root, rIdx) => {
    const children = (items || [])
      .filter(it => it.parentItemId === root.id)
      .map((child, cIdx) => ({
        ...child,
        _label: `${rIdx + 1}.${cIdx + 1}`,
        _parentQty: Number(root.quantity || 1),
      }))
    const rootTotal     = Number(root.lineTotal || 0)
    const childrenTotal = children.reduce((s, c) => s + Number(c.lineTotal || 0) * Number(root.quantity || 1), 0)
    return { root: { ...root, _label: `${rIdx + 1}.` }, children, subtotal: rootTotal + childrenTotal }
  })
}

export default function ShopOrderDetailModal({ open, order, onClose, onRefresh }) {
  const [tagQr, setTagQr]           = useState(null)
  const [qrLoading, setQrLoading]   = useState(false)
  const [reverting, setReverting]   = useState(false)
  const [switching, setSwitching]   = useState(false)
  const [splitOpen, setSplitOpen]   = useState(false)
  const [cashInput, setCashInput]   = useState('')
  const [splitting, setSplitting]   = useState(false)
  const [reverting2, setReverting2] = useState(false)
  const [error, setError]           = useState('')
  const [editOpen, setEditOpen]     = useState(false)
  const [confirmDlg, setConfirmDlg] = useState(null)

  const askConfirm = (cfg, fn) => setConfirmDlg({ ...cfg, onConfirm: async (reason) => { setConfirmDlg(null); await fn(reason) } })

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

  const handleSwitchAndPrint = async () => {
    setSwitching(true); setError('')
    try {
      const { res, data } = await switchToQrPayment(order.id)
      if (!res.ok) { setError(data?.message || 'Failed to switch payment method'); return }
      printOrderReceipt(data)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to switch payment method') }
    setSwitching(false)
  }

  const handleSplit = async () => {
    const cash = Number(cashInput)
    setSplitting(true); setError('')
    try {
      const { res, data } = await splitPayment(order.id, cash)
      if (!res.ok) { setError(data?.message || 'Failed to set split payment'); setSplitting(false); return }
      broadcastToCounter(data, tagQr || null)
      setSplitOpen(false)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to set split payment') }
    setSplitting(false)
  }

  const handleRevertToCash = async () => {
    setReverting2(true); setError('')
    try {
      const { res, data } = await revertToCash(order.id)
      if (!res.ok) { setError(data?.message || 'Failed to revert payment'); setReverting2(false); return }
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to revert payment') }
    setReverting2(false)
  }

  if (!order) return null

  const isPending     = order.status === 'PENDING'
  const isConfirmed   = order.status === 'CONFIRMED'
  const isFinal       = ['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
  const canSwitchToQr = order.paymentMethod === 'CASH' && !isFinal
  const canSplit      = !isFinal && order.paymentMethod !== 'SPLIT'
  const canRevertCash = !isFinal && (order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT')
  const total         = Number(order.totalAmount || 0)
  const cashNum       = Number(cashInput) || 0
  const qrPortion     = Math.max(0, total - cashNum)

  const splitCash = Number(order.splitCashAmount || 0)
  const splitQr   = total - splitCash

  const payQrSrc = order.paymentQr?.startsWith('https://')
    ? order.paymentQr
    : order.paymentQr ? `data:image/png;base64,${order.paymentQr}` : null

  return (
    <>
      <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md"
        PaperProps={{ sx: { borderRadius: 2 } }}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Typography fontWeight={800} variant="h6">
                Order #{order.orderNumber ?? '?'}
              </Typography>
              {/* orderCode shown prominently for QR tracking */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#1e293b', borderRadius: 1, px: 1, py: 0.25 }}>
                <QrCode2Icon sx={{ fontSize: 13, color: '#94a3b8' }} />
                <Typography sx={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: 1, color: '#e2e8f0' }}>
                  {order.orderCode}
                </Typography>
              </Box>
            </Box>
            {order.staffName && (
              <Typography variant="caption" color="text.secondary">by {order.staffName}</Typography>
            )}
          </Box>
          <Chip label={order.status} color={STATUS_COLOR[order.status] || 'default'} size="small" sx={{ fontWeight: 700 }} />
        </DialogTitle>

        <DialogContent sx={{ pt: 0 }}>
          {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

          {/* ── Info grid ─────────────────────────────────────────── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 1.5, p: 1.25, bgcolor: '#f8f9fa', borderRadius: 1.5 }}>
            <Typography variant="body2"><strong>Customer:</strong> {order.customerName || '—'}</Typography>
            <Typography variant="body2"><strong>Phone:</strong> {order.customerPhone || '—'}</Typography>
            <Typography variant="body2"><strong>Type:</strong> {order.fulfillmentType}</Typography>
            <Typography variant="body2"><strong>Table:</strong> {order.tableName || '—'}</Typography>
            <Typography variant="body2"><strong>Delivery fee:</strong> {fmt(order.deliveryFee)}</Typography>
            <Typography variant="body2"><strong>Created:</strong> {dateFmt(order.createdAt)}</Typography>
            {order.confirmedAt && <Typography variant="body2"><strong>Confirmed:</strong> {dateFmt(order.confirmedAt)}</Typography>}
            {order.notes && <Typography variant="body2" sx={{ gridColumn: '1/-1', fontStyle: 'italic', color: 'text.secondary' }}>Note: {order.notes}</Typography>}
          </Box>

          {/* ── Items ─────────────────────────────────────────────── */}
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
              {buildItemGroups(order.items || []).map(({ root, children, subtotal }) => [
                /* ── Root item row ── */
                <TableRow key={root.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{root._label}</Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={700} fontSize={14}>{root.modelName}</Typography>
                        <OptionsDisplay selectedOptions={root.selectedOptions} />
                        {root.itemNotes && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>{root.itemNotes}</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center"><Typography fontWeight={700} fontSize={14}>{Number(root.quantity)}</Typography></TableCell>
                  <TableCell align="right">{fmt(root.unitPrice)}</TableCell>
                  <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmt(root.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="caption" color="success.main">{pct(root.unitPrice, root.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight={700} fontSize={14} color="primary">{fmt(root.lineTotal)}</Typography></TableCell>
                </TableRow>,

                /* ── Child rows ── */
                ...children.map(child => {
                  const effectiveQty   = Number(child.quantity || 1) * child._parentQty
                  const effectiveTotal = Number(child.lineTotal || 0) * child._parentQty
                  return (
                    <TableRow key={child.id} sx={{ verticalAlign: 'top', bgcolor: '#f8f9ff' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, pl: 1.5, borderLeft: '2px solid #c7d2fe' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{child._label}</Typography>
                          <Box>
                            <Typography variant="body2" fontWeight={600} fontSize={13} color="#4338ca">{child.modelName}</Typography>
                            {child.itemNotes && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>{child.itemNotes}</Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center"><Typography fontWeight={800} fontSize={13} color="#6366f1">{child._parentQty}×{Number(child.quantity)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontSize={13} color="text.secondary">{fmt(child.unitPrice)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmt(child.unitRawCost)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption" color="success.main">{pct(child.unitPrice, child.unitRawCost)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700} fontSize={13} color="#6366f1">{fmt(effectiveTotal)}</Typography></TableCell>
                    </TableRow>
                  )
                }),

                /* ── Subtotal row (only when children exist) ── */
                children.length > 0 && (
                  <TableRow key={`sub-${root.id}`} sx={{ bgcolor: '#f0f4ff' }}>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                        subtotal ({root._label.replace('.', '')} {root.modelName})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={900} fontSize={14} color="primary">{fmt(subtotal)}</Typography>
                    </TableCell>
                  </TableRow>
                ),
              ])}
            </TableBody>
          </Table>

          {(() => {
            const groups = buildItemGroups(order.items || [])
            const itemsTotal = groups.reduce((s, g) => s + g.subtotal, 0)
            const delivery   = Number(order.deliveryFee || 0)
            const grandTotal = itemsTotal + delivery
            const totalMainQty = groups.reduce((s, g) => s + Number(g.root.quantity || 1), 0)
            const totalLines   = groups.length
            return (
            <Box sx={{ mt: 0.75, pr: 1, mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {totalLines} line{totalLines !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 900, fontSize: 12, borderRadius: 99, px: 1, py: 0.1, lineHeight: 1.6 }}>
                  {totalMainQty} item{totalMainQty !== 1 ? 's' : ''} total
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">Raw cost: {fmt(order.totalRawCost)}</Typography>
                {delivery > 0 && (
                  <Typography variant="body2" color="text.secondary">Items: {fmt(itemsTotal)} + Delivery: {fmt(delivery)}</Typography>
                )}
                <Typography fontWeight={900} variant="h5" color="primary">Total: {fmt(grandTotal)}</Typography>
              </Box>
            </Box>
            )
          })()}

          {/* ── Payment Panel ─────────────────────────────────────── */}
          <Divider sx={{ mb: 1.5 }} />

          {/* CASH order */}
          {order.paymentMethod === 'CASH' && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Tracking QR</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}
              {/* Cash block */}
              <Box sx={{ flex: 1, minWidth: 260, bgcolor: '#fff8e1', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="#e65100"
                  sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  💵 Cash Payment
                </Typography>
                <Typography fontWeight={900} sx={{ fontSize: 32, color: '#e65100', lineHeight: 1.1, mb: 1 }}>
                  {fmt(total)}
                </Typography>
                <ChangeCalc label="Customer cash calculator" due={total}
                  color="#e65100" bg="#fff" borderColor="#f59e0b" />
              </Box>
            </Box>
          )}

          {/* BANK_QR order */}
          {order.paymentMethod === 'BANK_QR' && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Tracking QR</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}
              {/* Payment QR */}
              {payQrSrc && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={800} color="#15803d"
                    sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                    💳 Scan to Pay
                  </Typography>
                  <img src={payQrSrc} alt="Payment QR"
                    style={{ width: 180, height: 180, borderRadius: 10, border: '2px solid #bbf7d0', display: 'block' }} />
                  <Typography fontWeight={900} sx={{ fontSize: 28, color: '#15803d', mt: 0.75, lineHeight: 1 }}>
                    {fmt(total)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    ref: {order.orderCode}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* SPLIT order */}
          {order.paymentMethod === 'SPLIT' && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Tracking QR</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}

              {/* QR block */}
              {payQrSrc && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={800} color="#15803d"
                    sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                    💳 QR Portion
                  </Typography>
                  <img src={payQrSrc} alt="Payment QR"
                    style={{ width: 160, height: 160, borderRadius: 10, border: '2px solid #bbf7d0', display: 'block' }} />
                  <Typography fontWeight={900} sx={{ fontSize: 28, color: '#15803d', mt: 0.75, lineHeight: 1 }}>
                    {fmt(splitQr)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    ref: {order.orderCode}
                  </Typography>
                </Box>
              )}

              {/* Cash block */}
              <Box sx={{ flex: 1, minWidth: 220, bgcolor: '#fff8e1', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="#e65100"
                  sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  💵 Cash Portion
                </Typography>
                <Typography fontWeight={900} sx={{ fontSize: 32, color: '#e65100', lineHeight: 1.1, mb: 1.25 }}>
                  {fmt(splitCash)}
                </Typography>
                <ChangeCalc label="Customer cash calculator" due={splitCash}
                  color="#e65100" bg="#fff" borderColor="#f59e0b" />
              </Box>
            </Box>
          )}

          {/* Fallback: tracking QR only (no payment QR) — for any method not handled above */}
          {!['CASH','BANK_QR','SPLIT'].includes(order.paymentMethod) && (qrLoading || tagQr) && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Tracking QR</Typography>
              {qrLoading ? <CircularProgress size={24} /> : (
                <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                  style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid #e0e0e0' }} />
              )}
            </Box>
          )}

        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 0.75, justifyContent: 'space-between' }}>
          {/* ── Left: mutating actions ─────────────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {isPending && (
              <Tooltip title="Edit items on this order">
                <Button variant="outlined" startIcon={<EditIcon />}
                  onClick={() => setEditOpen(true)} sx={{ textTransform: 'none' }}>
                  Edit Order
                </Button>
              </Tooltip>
            )}
            {isConfirmed && (
              <Tooltip title="Revert to Pending — urgent stop">
                <Button variant="outlined" color="warning" startIcon={<UndoIcon />}
                  onClick={() => askConfirm({ title: 'Revert to Pending?', message: 'Revert this confirmed order back to pending status?', confirmLabel: 'Revert', confirmColor: 'warning' }, handleRevert)}
                  sx={{ textTransform: 'none' }}>
                  Revert to Pending
                </Button>
              </Tooltip>
            )}
            {canSwitchToQr && (
              <Tooltip title="Switch to full Bank QR payment and print receipt">
                <Button variant="contained" color="success" startIcon={<QrCode2Icon />}
                  onClick={() => askConfirm({ title: 'Switch to QR Payment?', message: 'Switch this order to Bank QR payment and print the receipt?', confirmLabel: 'Switch & Print', confirmColor: 'success' }, handleSwitchAndPrint)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  QR + Print
                </Button>
              </Tooltip>
            )}
            {canSplit && (
              <Tooltip title="Set a split payment: part by bank QR, part by cash">
                <Button variant="outlined" color="secondary" startIcon={<CallSplitIcon />}
                  onClick={() => { setCashInput(String(Math.round(total / 2))); setSplitOpen(true) }}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Split
                </Button>
              </Tooltip>
            )}
            {canRevertCash && (
              <Tooltip title="Revert payment method back to Cash">
                <Button variant="outlined" color="warning" startIcon={<CurrencyExchangeIcon />}
                  onClick={() => askConfirm({ title: 'Revert to Cash?', message: 'Change this order\'s payment method back to cash?', confirmLabel: '→ Cash', confirmColor: 'warning' }, handleRevertToCash)}
                  sx={{ textTransform: 'none' }}>
                  → Cash
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* ── Right: print actions + close ──────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tooltip title="Show this order on the counter customer display">
              <Button variant="outlined" color="info" startIcon={<MonitorIcon />}
                onClick={() => broadcastToCounter(order, tagQr || null)} sx={{ textTransform: 'none' }}>
                Counter Display
              </Button>
            </Tooltip>
            <Tooltip title="Print order tag with tracking QR — give to customer to track order status">
              <Button variant="outlined" color="secondary"
                startIcon={qrLoading ? <CircularProgress size={14} /> : <QrCode2Icon />}
                onClick={() => tagQr && printOrderTag(order, tagQr)}
                disabled={qrLoading || !tagQr} sx={{ textTransform: 'none' }}>
                Print · Track
              </Button>
            </Tooltip>
            <Button variant="outlined" color="primary" startIcon={<PrintIcon />}
              onClick={() => printOrderReceipt(order, tagQr)} sx={{ textTransform: 'none' }}>
              Print · Pay
            </Button>
            <Tooltip title="Print one cup label per item unit">
              <Button variant="outlined" color="secondary" startIcon={<LabelIcon />}
                onClick={() => printCupLabels(order)} sx={{ textTransform: 'none' }}>
                Cup Labels
              </Button>
            </Tooltip>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {editOpen && (
        <EditOrderDialog open={editOpen} order={order}
          onClose={() => setEditOpen(false)}
          onUpdated={() => { setEditOpen(false); onRefresh?.() }} />
      )}

      {confirmDlg && (
        <ConfirmActionDialog
          open
          title={confirmDlg.title}
          message={confirmDlg.message}
          confirmLabel={confirmDlg.confirmLabel}
          confirmColor={confirmDlg.confirmColor}
          requireReason={confirmDlg.requireReason}
          reasonLabel={confirmDlg.reasonLabel}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}

      {/* ── Split Payment Dialog ──────────────────────────────────── */}
      <Dialog open={splitOpen} onClose={() => setSplitOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={800}>Split Payment</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: <strong>{fmt(total)}</strong> — type in either box, the other adjusts automatically
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center', mb: 2 }}>
            {/* Cash box */}
            <Box sx={{ bgcolor: '#fff7ed', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="warning.dark"
                sx={{ display: 'block', textAlign: 'center', mb: 1, letterSpacing: 1, textTransform: 'uppercase' }}>
                💵 Tiền mặt
              </Typography>
              <TextField type="text" inputMode="numeric" size="small" fullWidth
                value={fmtDots(cashInput)}
                onChange={e => {
                  const v = Math.max(0, Math.min(Math.round(total), Number(stripNonDigits(e.target.value)) || 0))
                  setCashInput(String(v))
                }}
                inputProps={{ maxLength: 15, style: { textAlign: 'center', fontSize: 22, fontWeight: 900, padding: '8px 4px' } }}
                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', '& fieldset': { borderColor: '#f59e0b' }, '&:hover fieldset': { borderColor: '#d97706' }, '&.Mui-focused fieldset': { borderColor: '#d97706' } } }}
              />
            </Box>
            <Typography sx={{ color: '#94a3b8', fontWeight: 900, fontSize: 20, userSelect: 'none' }}>⇄</Typography>
            {/* QR box */}
            <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="success.dark"
                sx={{ display: 'block', textAlign: 'center', mb: 1, letterSpacing: 1, textTransform: 'uppercase' }}>
                💳 Bank QR
              </Typography>
              <TextField type="text" inputMode="numeric" size="small" fullWidth
                value={fmtDots(String(qrPortion))}
                onChange={e => {
                  const qr = Math.max(0, Math.min(Math.round(total), Number(stripNonDigits(e.target.value)) || 0))
                  setCashInput(String(Math.round(total) - qr))
                }}
                inputProps={{ maxLength: 15, style: { textAlign: 'center', fontSize: 22, fontWeight: 900, padding: '8px 4px' } }}
                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', '& fieldset': { borderColor: '#22c55e' }, '&:hover fieldset': { borderColor: '#16a34a' }, '&.Mui-focused fieldset': { borderColor: '#16a34a' } } }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button size="small" variant="outlined" color="warning" onClick={() => setCashInput(String(Math.round(total / 2)))}>Half / Half</Button>
            <Button size="small" variant="outlined" color="success" onClick={() => setCashInput('0')}>All QR</Button>
            <Button size="small" variant="outlined" onClick={() => setCashInput(String(Math.round(total)))}>All Cash</Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSplitOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="success"
            startIcon={splitting ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <CallSplitIcon />}
            onClick={handleSplit} disabled={splitting || cashNum < 0 || cashNum > total}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
