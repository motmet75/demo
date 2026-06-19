import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Badge from '@mui/material/Badge'
import Stack from '@mui/material/Stack'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import TableBarIcon from '@mui/icons-material/TableBar'
import TvIcon from '@mui/icons-material/Tv'
import MonitorIcon from '@mui/icons-material/Monitor'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import UndoIcon from '@mui/icons-material/Undo'
import KitchenIcon from '@mui/icons-material/Kitchen'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import LabelIcon from '@mui/icons-material/Label'
import PaidIcon from '@mui/icons-material/Paid'
import PrintIcon from '@mui/icons-material/Print'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import {
  fetchShopOrders, fetchActiveOrders, confirmShopOrder, prepareShopOrder, readyShopOrder,
  completeShopOrder, cancelShopOrder, resetOrderSequence, setShopOrderNumber,
  generateDisplayBoardToken, pickupShopOrder, revertShopOrder, markOrderPaid,
  fetchBankConfig, switchToQrPayment, revertToCash, fetchOrderTagQr,
  fetchShopTables, setOrderTable, fetchPickupQr, fetchOrdersByToken,
  fetchStaffCalls, dismissStaffCall,
} from '../../api/shopApi'
import { printCupLabels, printOrderReceipt, printOrderTag, printCombinedReceipt } from '../../utils/printOrderReceipt'
import ShopOrderDetailModal from './ShopOrderDetailModal'
import ManualOrderDialog from './ManualOrderDialog'
import QrOrderDialog from './QrOrderDialog'
import EodAuditDialog from './EodAuditDialog'
import ConfirmActionDialog from './ConfirmActionDialog'
import { useAppContext } from '../../context/AppContext'
import { fetchModels } from '../../api/modelApi'

const BOARD_CHANNEL = 'shop_display_board'
function broadcastReady() {
  try { new BroadcastChannel(BOARD_CHANNEL).postMessage({ type: 'ORDER_READY' }) } catch { /* */ }
}

function playStaffCallSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    ;[0, 0.28].forEach(offset => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = 880
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.45, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.45)
      osc.start(now + offset); osc.stop(now + offset + 0.45)
    })
  } catch { /* browser may block without user gesture */ }
}

const STATUS_COLOR  = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }
const STATUS_LABEL  = { PENDING: 'Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready ✓', PICKED_UP: 'Picked Up ✓', COMPLETED: 'Done', CANCELLED: 'Cancelled' }
const STATUSES      = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED', 'CANCELLED']
const fmt           = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const dateFmt       = (v) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(v).toLocaleDateString('vi-VN') : ''
const elapsed       = (v) => {
  if (!v) return ''
  const m = Math.floor((Date.now() - new Date(v)) / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

// ── Stock panel ─────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <Typography variant="caption" color="text.secondary"
      sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function StockPanel({ items, onUseInOrder, onClear, onRemoveItem }) {
  const [selectedUids, setSelectedUids] = useState(new Set())

  const available = items.filter(i => !i.utilizedOrderCode)
  const utilized  = items.filter(i =>  i.utilizedOrderCode)
  const queued    = available.filter(i => selectedUids.has(i.uid))
  const queueTotal = queued.reduce((s, i) => s + i.qty * Number(i.sellingPrice || 0), 0)

  const toggle = (uid) => setSelectedUids(prev => {
    const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next
  })

  const handleCreate = () => {
    if (!queued.length) return
    onUseInOrder(queued)
    setSelectedUids(new Set())
  }

  return (
    <Box sx={{ width: 256, flexShrink: 0, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fffde7' }}>

      {/* Header */}
      <Box sx={{ p: 1.25, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, fontSize: 12 }}>
          Cancelled Stock
        </Typography>
        {available.length > 0 && (
          <Chip label={available.length} size="small" color="warning"
            sx={{ height: 16, fontSize: 10, mr: 0.5, '& .MuiChip-label': { px: 0.75 } }} />
        )}
        <Tooltip title="Clear all">
          <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Item list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.75 }}>

        {/* Available */}
        {available.length > 0 && (
          <>
            <SectionLabel>Available — tap + to select</SectionLabel>
            <Stack spacing={0.5} sx={{ mb: utilized.length ? 1.5 : 0 }}>
              {available.map(item => {
                const sel = selectedUids.has(item.uid)
                return (
                  <Box key={item.uid} sx={{
                    bgcolor: sel ? '#dbeafe' : '#fff',
                    border: `1.5px solid ${sel ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 1.25, px: 0.75, pt: 0.5, pb: 0.4,
                    transition: 'all 0.12s',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={700} display="block" noWrap>{item.modelName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {item.qty > 1 ? `×${item.qty}  ` : ''}{fmt(item.sellingPrice)}
                        </Typography>
                        {item.itemNotes && (
                          <Typography variant="caption"
                            sx={{ fontSize: 10, color: '#dc2626', fontStyle: 'italic', display: 'block' }} noWrap>
                            ⚠ {item.itemNotes}
                          </Typography>
                        )}
                        <Typography variant="caption"
                          sx={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', display: 'block', mt: 0.1 }}>
                          from {item.cancelledFromOrderCode}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                        <Tooltip title={sel ? 'Deselect' : 'Select for new order'}>
                          <IconButton size="small" onClick={() => toggle(item.uid)}
                            sx={{ p: 0.25, color: sel ? '#2563eb' : '#9ca3af' }}>
                            {sel
                              ? <CheckCircleIcon sx={{ fontSize: 15 }} />
                              : <AddShoppingCartIcon sx={{ fontSize: 15 }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove">
                          <IconButton size="small" onClick={() => { onRemoveItem(item.uid); setSelectedUids(p => { const n = new Set(p); n.delete(item.uid); return n }) }}
                            sx={{ p: 0.125, color: '#d1d5db', '&:hover': { color: '#dc2626' } }}>
                            <CloseIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </>
        )}

        {/* Utilized */}
        {utilized.length > 0 && (
          <>
            <SectionLabel>Utilized ({utilized.length})</SectionLabel>
            <Stack spacing={0.5}>
              {utilized.map(item => (
                <Box key={item.uid} sx={{
                  bgcolor: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 1.25, px: 0.75, pt: 0.5, pb: 0.4, opacity: 0.85,
                }}>
                  <Typography variant="caption" fontWeight={600} display="block" noWrap color="text.secondary">
                    {item.modelName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {item.qty > 1 ? `×${item.qty}  ` : ''}{fmt(item.sellingPrice)}
                  </Typography>
                  {item.itemNotes && (
                    <Typography variant="caption"
                      sx={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', display: 'block' }} noWrap>
                      {item.itemNotes}
                    </Typography>
                  )}
                  <Typography variant="caption"
                    sx={{ fontSize: 9, fontFamily: 'monospace', display: 'block', color: '#16a34a', fontWeight: 700, mt: 0.1 }}>
                    ✓ → {item.utilizedOrderCode}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {items.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', textAlign: 'center', mt: 2 }}>
            No cancelled stock
          </Typography>
        )}
      </Box>

      {/* Create order from selection */}
      {queued.length > 0 && (
        <Box sx={{ borderTop: '1px solid #e0e0e0', p: 1 }}>
          <Typography variant="caption" color="primary" fontWeight={700}
            sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
            Selected ({queued.length})
          </Typography>
          <Stack spacing={0.2} sx={{ mb: 0.75 }}>
            {queued.map(i => (
              <Typography key={i.uid} variant="caption" noWrap sx={{ fontSize: 11 }}>
                {i.qty > 1 ? `${i.qty}× ` : ''}{i.modelName}
              </Typography>
            ))}
            <Typography variant="caption" color="primary" fontWeight={800} sx={{ fontSize: 12 }}>
              {fmt(queueTotal)}
            </Typography>
          </Stack>
          <Button variant="contained" size="small" fullWidth startIcon={<AddCircleOutlineIcon />}
            onClick={handleCreate}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
            Create Order
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ── Status Board (shared by all board tabs) ─────────────────────────

const BOARD_STYLE = {
  CONFIRMED:  { headerBg: '#e3f2fd', border: '#1976d2',  cardBg: '#f0f7ff',  color: '#1565c0',  numColor: '#1976d2' },
  PREPARING:  { headerBg: '#fff3e0', border: '#ff9800',  cardBg: '#fffaf0',  color: '#e65100',  numColor: '#ef6c00' },
  READY:      { headerBg: '#e8f5e9', border: '#4caf50',  cardBg: '#f0fdf4',  color: '#2e7d32',  numColor: '#388e3c', animate: true },
  PICKED_UP:  { headerBg: '#e3f2fd', border: '#0288d1',  cardBg: '#f0f9ff',  color: '#01579b',  numColor: '#0288d1' },
}

function StatusBoard({ status, orders, modelImageMap = {}, onAction, onDetail, onPayQr, onPickupQr, onSwitchQr, onRevertCash }) {
  // onAction(type, orderId, orderNumber)
  const style = BOARD_STYLE[status] || BOARD_STYLE.CONFIRMED
  const [imagePreview, setImagePreview] = useState(null)

  if (!orders.length) {
    const icons = { CONFIRMED: <KitchenIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PREPARING: <HourglassTopIcon sx={{ fontSize: 44, opacity: 0.18 }} />, READY: <CheckCircleIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PICKED_UP: <LocalShippingIcon sx={{ fontSize: 44, opacity: 0.18 }} /> }
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        {icons[status]}
        <Typography variant="body2" sx={{ mt: 1 }}>No {status.toLowerCase().replace('_', ' ')} orders</Typography>
      </Box>
    )
  }

  return (
    <>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5, p: 1.5 }}>
      {orders.map(order => {
        const since = elapsed(order.confirmedAt || order.createdAt)
        return (
          <Card key={order.id} elevation={2} sx={{
            borderRadius: 2, border: `2px solid ${style.border}`, bgcolor: style.cardBg,
            animation: style.animate ? 'pulse 3s ease-in-out infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { boxShadow: `0 0 0 0 ${style.border}22` }, '50%': { boxShadow: `0 0 0 6px ${style.border}22` } },
          }}>
            <CardContent sx={{ pb: '8px !important', pt: 1.5, px: 1.5 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.75 }}>
                <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: style.numColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, flexShrink: 0, mr: 1 }}>
                  {order.orderNumber ?? '?'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.25 }}>
                    {order.tableName && <Chip icon={<TableBarIcon sx={{ fontSize: 12 }} />} label={order.tableName} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                    {order.paymentStatus === 'PAID'
                      ? <Chip icon={<PaidIcon sx={{ fontSize: 12 }} />} label="PAID" size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
                      : <Chip label="UNPAID" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                    }
                  </Box>
                  {order.customerName && <Typography variant="caption" display="block" noWrap>{order.customerName}</Typography>}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{since} ago</Typography>
                    {(() => {
                      const roots = (order.items || []).filter(it => !it.parentItemId)
                      const totalQty = roots.reduce((s, it) => s + Number(it.quantity || 1), 0)
                      return totalQty > 0 ? (
                        <Box sx={{ bgcolor: style.numColor, color: '#fff', fontWeight: 900, fontSize: 11, borderRadius: 99, px: 0.75, py: 0.1, lineHeight: 1.6 }}>
                          {totalQty} item{totalQty > 1 ? 's' : ''}
                        </Box>
                      ) : null
                    })()}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <Tooltip title="Print cup labels">
                    <IconButton size="small" onClick={() => printCupLabels(order)} sx={{ p: 0.25, color: style.color }}>
                      <LabelIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {order.paymentStatus !== 'PAID' && (
                    <Tooltip title="Payment QR">
                      <IconButton size="small" onClick={() => onPayQr(order)} sx={{ p: 0.25, color: '#1565c0' }}>
                        <QrCode2Icon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="View detail">
                    <IconButton size="small" onClick={() => onDetail(order)} sx={{ p: 0.25 }}>
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Divider sx={{ mb: 0.75 }} />

              {/* Items */}
              <Stack spacing={0.3} sx={{ mb: 1, minHeight: 32 }}>
                {(() => {
                  const allItems = order.items || []
                  const roots = allItems.filter(it => !it.parentItemId)
                  return roots.map((root, rIdx) => {
                    const children = allItems.filter(it => it.parentItemId === root.id)
                    const opts = parseOpts(root.selectedOptions)
                    const fmtV = v => Array.isArray(v) ? v.join('+') : (typeof v === 'object' && v !== null ? Object.entries(v).map(([lbl, qty]) => qty > 1 ? `${lbl}×${qty}` : lbl).join('+') : v)
                    const optStr = Object.entries(opts).map(([k, v]) => `${k}: ${fmtV(v)}`).join(' · ')
                    return (
                      <Box key={root.id || rIdx} sx={{ mb: 0.5 }}>
                        {/* Root item */}
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', flexShrink: 0 }}>
                            {rIdx + 1}.
                          </Typography>
                          <Typography sx={{ fontSize: 22, fontWeight: 900, color: style.color, lineHeight: 1, flexShrink: 0 }}>
                            {Number(root.quantity)}×
                          </Typography>
                          <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#111', lineHeight: 1.2 }}>
                            {root.modelName}
                          </Typography>
                        </Box>
                        {optStr && <Typography sx={{ fontSize: 13, pl: 2, display: 'block', color: '#555', lineHeight: 1.4 }}>{optStr}</Typography>}
                        {root.itemNotes && <Typography sx={{ fontSize: 13, pl: 2, fontStyle: 'italic', display: 'block', color: '#c62828', fontWeight: 700 }}>⚠ {root.itemNotes}</Typography>}
                        {/* Child / topping items */}
                        {children.map((child, ci) => {
                          const img = modelImageMap[child.modelId]
                          return (
                            <Box key={child.id || ci} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 3, pl: 1, mt: 0.3, borderLeft: `3px solid ${style.border}` }}>
                              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, flexShrink: 0, minWidth: 20 }}>
                                {rIdx + 1}.{ci + 1}
                              </Typography>
                              {img && (
                                <Box component="img" src={img} alt={child.modelName}
                                  onClick={() => setImagePreview({ imageUrl: img, modelName: child.modelName })}
                                  onError={e => { e.target.style.display = 'none' }}
                                  sx={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 1, flexShrink: 0, cursor: 'pointer', border: '1px solid #e2e8f0' }} />
                              )}
                              <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#111', lineHeight: 1, flexShrink: 0 }}>
                                {Number(child.quantity)}×
                              </Typography>
                              <Typography onClick={() => img && setImagePreview({ imageUrl: img, modelName: child.modelName })}
                                sx={{ fontSize: 14, fontWeight: 700, color: '#374151', flex: 1, ...(img ? { cursor: 'pointer', '&:hover': { color: '#1976d2', textDecoration: 'underline dotted' } } : {}) }}>
                                {child.modelName}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    )
                  })
                })()}
              </Stack>

              {order.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontStyle: 'italic', display: 'block', mb: 0.75 }}>Note: {order.notes}</Typography>}

              {/* Action buttons per status */}
              <Stack spacing={0.5}>
                {/* Payment method switch */}
                {!['PICKED_UP', 'COMPLETED', 'CANCELLED'].includes(status) && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {order.paymentMethod === 'CASH' && (
                      <Button size="small" variant="outlined" color="success" fullWidth
                        startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                        onClick={() => onSwitchQr(order)}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
                        → QR Pay
                      </Button>
                    )}
                    {(order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT') && (
                      <Button size="small" variant="outlined" color="warning" fullWidth
                        onClick={() => onRevertCash(order)}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
                        → Cash
                      </Button>
                    )}
                  </Box>
                )}
                {order.paymentStatus !== 'PAID' && status !== 'PICKED_UP' && (
                  <Button size="small" variant="contained" color="success" fullWidth
                    startIcon={<PaidIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onAction('pay', order.id, order.orderNumber)}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                    Mark as Paid
                  </Button>
                )}
                {status === 'CONFIRMED' && (
                  <Button size="small" variant="contained" color="warning" fullWidth onClick={() => onAction('prepare', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Start Preparing</Button>
                )}
                {status === 'PREPARING' && (
                  <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('ready', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Mark Ready ✓</Button>
                )}
                {status === 'READY' && (
                  <Stack spacing={0.5}>
                    <Button size="small" variant="outlined" color="warning" fullWidth
                      startIcon={<QrCode2Icon sx={{ fontSize: 13 }} />}
                      onClick={() => onPickupQr(order)}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                      Pickup QR
                    </Button>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {(order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT')
                        ? <Button size="small" variant="contained" color="info" fullWidth onClick={() => onAction('pickup', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Picked Up ✓</Button>
                        : <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('complete', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Complete ✓</Button>
                      }
                    </Box>
                  </Stack>
                )}
                {status === 'PICKED_UP' && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                    Picked up {order.completedAt ? dateFmt(order.completedAt) : ''}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )
      })}
    </Box>

    {/* ── Sub-item image preview ── */}
    <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {imagePreview && (
        <>
          <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
            <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
              sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
            <IconButton size="small" onClick={() => setImagePreview(null)}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography fontWeight={800} sx={{ fontSize: 17 }}>{imagePreview.modelName}</Typography>
          </Box>
        </>
      )}
    </Dialog>
    </>
  )
}

// ── OrderCard ───────────────────────────────────────────────────────

const CARD_STYLE = {
  PENDING:   { border: '#f59e0b', bg: '#fffbeb', num: '#d97706' },
  CONFIRMED: { border: '#3b82f6', bg: '#eff6ff', num: '#2563eb' },
  PREPARING: { border: '#f97316', bg: '#fff7ed', num: '#ea580c' },
  READY:     { border: '#22c55e', bg: '#f0fdf4', num: '#16a34a', pulse: true },
  PICKED_UP: { border: '#0ea5e9', bg: '#f0f9ff', num: '#0284c7' },
  COMPLETED: { border: '#94a3b8', bg: '#f8fafc', num: '#64748b' },
  CANCELLED: { border: '#fca5a5', bg: '#fff5f5', num: '#ef4444' },
}

function OrderCard({ order, tables, actions, modelImageMap = {}, selected, onSelect }) {
  const [editNum, setEditNum]       = useState(false)
  const [numVal, setNumVal]         = useState(String(order.orderNumber ?? ''))
  const [imagePreview, setImagePreview] = useState(null)

  const s       = CARD_STYLE[order.status] || CARD_STYLE.CONFIRMED
  const isQr    = order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT'
  const isActive = !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
  const roots    = (order.items || []).filter(it => !it.parentItemId)
  const childMap = {}
  ;(order.items || []).filter(it => it.parentItemId).forEach(it => {
    const k = String(it.parentItemId)
    if (!childMap[k]) childMap[k] = []
    childMap[k].push(it)
  })

  const commitNum = () => {
    const n = parseInt(numVal, 10)
    if (!isNaN(n) && n > 0 && n !== order.orderNumber) actions.setOrderNumber(order.id, n)
    setEditNum(false)
  }

  return (
    <>
    <Box sx={{
      border: `2px solid ${selected ? '#6366f1' : s.border}`,
      borderRadius: 2, bgcolor: s.bg,
      display: 'flex', flexDirection: 'column',
      opacity: order.status === 'CANCELLED' ? 0.65 : 1,
      animation: s.pulse ? 'ocPulse 3s ease-in-out infinite' : 'none',
      '@keyframes ocPulse': { '0%,100%': { boxShadow: `0 0 0 0 ${s.border}33` }, '50%': { boxShadow: `0 0 0 6px ${s.border}33` } },
      '&:hover': { boxShadow: `0 2px 12px ${s.border}55` },
      transition: 'box-shadow 0.15s',
    }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, p: 1.25, pb: 0.5 }}>

        {/* Selection checkbox */}
        <Checkbox
          size="small" checked={selected} onChange={onSelect}
          sx={{ p: 0.25, mt: 0.5, color: s.num, '&.Mui-checked': { color: '#6366f1' } }}
        />

        {/* Order number circle — click to edit */}
        {editNum ? (
          <Box component="input"
            type="number" value={numVal} autoFocus
            onChange={e => setNumVal(e.target.value)}
            onBlur={commitNum}
            onKeyDown={e => { if (e.key === 'Enter') commitNum(); if (e.key === 'Escape') { setNumVal(String(order.orderNumber ?? '')); setEditNum(false) } }}
            sx={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${s.num}`, textAlign: 'center', fontWeight: 900, fontSize: 15, color: s.num, background: 'white', outline: 'none', p: 0, flexShrink: 0 }}
          />
        ) : (
          <Tooltip title="Click to edit order #">
            <Box onClick={() => { setNumVal(String(order.orderNumber ?? '')); setEditNum(true) }} sx={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              bgcolor: s.num, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, cursor: 'pointer',
              '&:hover': { filter: 'brightness(0.85)' },
            }}>
              {order.orderNumber ?? '?'}
            </Box>
          </Tooltip>
        )}

        {/* Status / meta */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center', mb: 0.3 }}>
            <Chip label={STATUS_LABEL[order.status] || order.status} color={STATUS_COLOR[order.status] || 'default'} size="small"
              sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
            {order.fulfillmentType && (() => { const m = { DINE_IN: '🪑', PICKUP: '🥡', DELIVERY: '🛵' }; return <Typography sx={{ fontSize: 13 }}>{m[order.fulfillmentType] || ''}</Typography> })()}
            {order.tableName && <Chip icon={<TableBarIcon sx={{ fontSize: 11 }} />} label={order.tableName} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
            {order.paymentStatus === 'PAID'
              ? <Chip icon={<PaidIcon sx={{ fontSize: 11, ml: '4px !important' }} />} label="PAID" size="small" color="success" sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
              : <Chip label="UNPAID" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
            }
            {order.paymentMethod === 'BANK_QR' && <Chip label="QR" size="small" color="info" sx={{ height: 18, fontSize: 10 }} />}
            {order.paymentMethod === 'SPLIT' && <Chip label="Split" size="small" color="secondary" sx={{ height: 18, fontSize: 10 }} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {order.customerName && <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b', flex: 1 }} noWrap>{order.customerName}</Typography>}
            <Typography sx={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{elapsed(order.confirmedAt || order.createdAt)} ago</Typography>
          </Box>
          {order.staffName && <Typography sx={{ fontSize: 10, color: '#94a3b8' }} noWrap>by {order.staffName}</Typography>}
        </Box>

        {/* Icon cluster */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="View detail">
              <IconButton size="small" onClick={() => actions.detail(order)} sx={{ p: 0.35 }}><VisibilityIcon sx={{ fontSize: 15 }} /></IconButton>
            </Tooltip>
            <Tooltip title="Print Receipt">
              <IconButton size="small" color="primary" onClick={() => printOrderReceipt(order)} sx={{ p: 0.35 }}><PrintIcon sx={{ fontSize: 15 }} /></IconButton>
            </Tooltip>
            {order.sourceToken && (
              <Tooltip title="Combined Receipt">
                <IconButton size="small" color="secondary" onClick={() => actions.combinedReceipt(order.sourceToken)} sx={{ p: 0.35 }}><PeopleAltIcon sx={{ fontSize: 15 }} /></IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="Show Tracking QR for Customer">
              <IconButton size="small" onClick={() => actions.showTrackQr(order)} sx={{ p: 0.35, color: '#0288d1' }}>
                <QrCode2Icon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print Tracking Tag">
              <IconButton size="small" color="secondary" onClick={() => actions.printTag(order)} sx={{ p: 0.35 }}><ConfirmationNumberIcon sx={{ fontSize: 15 }} /></IconButton>
            </Tooltip>
            <Tooltip title="Print Cup Labels">
              <IconButton size="small" onClick={() => printCupLabels(order)} sx={{ p: 0.35 }}><LabelIcon sx={{ fontSize: 15 }} /></IconButton>
            </Tooltip>
            {order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && (
              <Tooltip title="Payment QR">
                <IconButton size="small" color="primary" onClick={() => actions.payQr(order)} sx={{ p: 0.35 }}><QrCode2Icon sx={{ fontSize: 15 }} /></IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Table selector + order code ── */}
      <Box sx={{ px: 1.25, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <TableBarIcon sx={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }} />
        <Box component="select"
          value={order.tableId || ''}
          onChange={e => actions.setTable(order.id, e.target.value)}
          sx={{ fontSize: 11, height: 22, border: '1px solid #cbd5e1', borderRadius: 1, px: 0.5, flex: 1, cursor: 'pointer', bgcolor: 'white', color: '#334155' }}
        >
          <option value="">No table</option>
          {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
        </Box>
        <Typography sx={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>{order.orderCode}</Typography>
      </Box>

      <Divider />

      {/* ── Items ── */}
      <Box sx={{ px: 1.25, py: 0.75, flex: 1 }}>
        {roots.length === 0
          ? <Typography sx={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>No items</Typography>
          : roots.slice(0, 7).map((root, rIdx) => {
              const children = childMap[String(root.id)] || []
              const opts = parseOpts(root.selectedOptions)
              const fmtV = v => Array.isArray(v) ? v.join('+') : (typeof v === 'object' && v !== null ? Object.entries(v).map(([lbl, qty]) => qty > 1 ? `${lbl}×${qty}` : lbl).join('+') : v)
              const optStr = Object.entries(opts).map(([k, v]) => `${k}: ${fmtV(v)}`).join(' · ')
              return (
                <Box key={root.id || rIdx} sx={{ mb: 0.6 }}>
                  <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'baseline' }}>
                    <Typography sx={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, flexShrink: 0 }}>{rIdx + 1}.</Typography>
                    <Typography sx={{ fontSize: 22, fontWeight: 900, color: s.num, lineHeight: 1, flexShrink: 0 }}>{Number(root.quantity)}×</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#111', lineHeight: 1.2, flex: 1 }}>{root.modelName}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748b', flexShrink: 0, pl: 0.5 }}>{fmt(root.lineTotal)}</Typography>
                  </Box>
                  {optStr && <Typography sx={{ fontSize: 13, pl: 2.5, color: '#555', display: 'block', lineHeight: 1.4 }}>{optStr}</Typography>}
                  {root.itemNotes && <Typography sx={{ fontSize: 13, pl: 2.5, fontStyle: 'italic', color: '#b91c1c', fontWeight: 700, display: 'block' }}>⚠ {root.itemNotes}</Typography>}
                  {children.map((child, ci) => {
                    const img = modelImageMap[child.modelId]
                    return (
                      <Box key={child.id || ci} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 2.5, pl: 0.75, mt: 0.3, borderLeft: `2px solid ${s.border}` }}>
                        <Typography sx={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>{rIdx+1}.{ci+1}</Typography>
                        {img && (
                          <Box component="img" src={img} alt={child.modelName}
                            onClick={() => setImagePreview({ imageUrl: img, modelName: child.modelName })}
                            onError={e => { e.target.style.display = 'none' }}
                            sx={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 1, flexShrink: 0, cursor: 'pointer', border: '1px solid #e2e8f0' }} />
                        )}
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#374151', lineHeight: 1, flexShrink: 0 }}>{Number(child.quantity)}×</Typography>
                        <Typography onClick={() => img && setImagePreview({ imageUrl: img, modelName: child.modelName })}
                          sx={{ fontSize: 14, fontWeight: 700, color: '#374151', flex: 1, ...(img ? { cursor: 'pointer', '&:hover': { color: '#1976d2', textDecoration: 'underline dotted' } } : {}) }}>
                          {child.modelName}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              )
            })
        }
        {roots.length > 7 && <Typography sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>+{roots.length - 7} more…</Typography>}
      </Box>

      {/* ── Notes + total ── */}
      <Box sx={{ px: 1.25, pb: 0.75 }}>
        {order.notes && <Typography sx={{ fontSize: 11, fontStyle: 'italic', color: '#64748b', mb: 0.25 }}>📝 {order.notes}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>{dateFmt(order.createdAt)}</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: s.num }}>{fmt(order.totalAmount)}</Typography>
        </Box>
      </Box>

      <Divider />

      {/* ── Actions ── */}
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>

        {/* Payment method swap */}
        {(order.paymentMethod === 'CASH' || isQr) && isActive && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {order.paymentMethod === 'CASH' && (
              <Button size="small" variant="outlined" color="success" startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                onClick={() => actions.switchToQr(order)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.25 }}>
                → QR Pay
              </Button>
            )}
            {isQr && (
              <Button size="small" variant="outlined" color="warning"
                onClick={() => actions.revertCash(order)}
                sx={{ textTransform: 'none', fontSize: 11, flex: isQr && order.paymentMethod !== 'CASH' ? 1 : 0, py: 0.25, px: 1 }}>
                → Cash
              </Button>
            )}
          </Box>
        )}

        {order.status === 'PENDING' && order.customerEditing && (
          <Chip label="✏ Customer is editing…" size="small" color="warning" sx={{ fontWeight: 700, fontSize: 10 }} />
        )}

        {/* Primary status transition */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {order.status === 'PENDING' && (
            <Button size="small" variant="contained" color="primary" fullWidth
              disabled={Boolean(order.customerEditing)}
              onClick={() => actions.confirm(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              Confirm Order
            </Button>
          )}
          {order.status === 'CONFIRMED' && (
            <Button size="small" variant="contained" color="warning" fullWidth
              onClick={() => actions.prepare(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              Start Preparing
            </Button>
          )}
          {order.status === 'PREPARING' && (
            <Button size="small" variant="contained" color="success" fullWidth
              onClick={() => actions.ready(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              Mark Ready ✓
            </Button>
          )}
          {order.status === 'READY' && (
            <>
              <Button size="small" variant="outlined" color="warning"
                startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                onClick={() => actions.pickupQr(order)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.5 }}>
                Pickup QR
              </Button>
              {isQr
                ? <Button size="small" variant="contained" color="info" onClick={() => actions.pickup(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, flex: 1 }}>Picked Up ✓</Button>
                : <Button size="small" variant="contained" color="success" onClick={() => actions.complete(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, flex: 1 }}>Complete ✓</Button>
              }
            </>
          )}
          {(order.status === 'PICKED_UP' || order.status === 'COMPLETED') && (
            <Typography sx={{ fontSize: 11, color: '#64748b', textAlign: 'center', flex: 1, py: 0.5 }}>
              ✅ {order.status === 'PICKED_UP' ? 'Picked up' : 'Completed'} · {dateFmt(order.completedAt || order.readyAt)}
            </Typography>
          )}
          {order.status === 'CANCELLED' && (
            <Typography sx={{ fontSize: 11, color: '#ef4444', textAlign: 'center', flex: 1, py: 0.5, fontWeight: 700 }}>
              ✕ Cancelled{order.cancelReason ? ` — ${order.cancelReason}` : ''}
            </Typography>
          )}
        </Box>

        {/* Mark paid + Cancel */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {order.paymentStatus !== 'PAID' && isActive && (
            <Button size="small" variant="outlined" color="success" startIcon={<PaidIcon sx={{ fontSize: 12 }} />}
              onClick={() => actions.markPaid(order)}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.25 }}>
              Mark Paid
            </Button>
          )}
          {isActive && (
            <Button size="small" color="error" onClick={() => actions.cancel(order)}
              sx={{ textTransform: 'none', fontSize: 12, px: 1.5, flexShrink: 0 }}>
              ✕ Cancel
            </Button>
          )}
        </Box>
      </Box>
    </Box>

    {/* ── Sub-item image preview ── */}
    <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {imagePreview && (
        <>
          <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
            <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
              sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
            <IconButton size="small" onClick={() => setImagePreview(null)}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography fontWeight={800} sx={{ fontSize: 17 }}>{imagePreview.modelName}</Typography>
          </Box>
        </>
      )}
    </Dialog>
    </>
  )
}

// ── OrderCardGrid ────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'By status' },
  { value: 'number', label: 'By order #' },
  { value: 'total',  label: 'By total ↓' },
]
const STATUS_SORT_ORDER = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, PICKED_UP: 4, COMPLETED: 5, CANCELLED: 6 }

function OrderCardGrid({ rows, loading, tables, actions, modelImageMap = {}, selectedIds, onToggleSelect }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  const filtered = useMemo(() => {
    let list = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        String(r.orderNumber || '').includes(q) ||
        (r.orderCode || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.tableName || '').toLowerCase().includes(q) ||
        (r.staffName || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.items || []).some(it => (it.modelName || '').toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (sortBy === 'status') return (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9)
      if (sortBy === 'number') return (a.orderNumber ?? 9999) - (b.orderNumber ?? 9999)
      if (sortBy === 'total')  return Number(b.totalAmount || 0) - Number(a.totalAmount || 0)
      return 0
    })
  }, [rows, search, sortBy])

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', gap: 1, alignItems: 'center', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        <TextField size="small" placeholder="Search order #, customer, item, table…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1 }} inputProps={{ style: { fontSize: 13 } }} />
        <TextField select size="small" label="Sort" value={sortBy} onChange={e => setSortBy(e.target.value)} sx={{ width: 140 }}>
          {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <Typography sx={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{filtered.length} orders</Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
        {filtered.length === 0
          ? <Box sx={{ textAlign: 'center', py: 8 }}><Typography color="text.secondary">No orders found</Typography></Box>
          : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1.5 }}>
              {filtered.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tables={tables}
                  actions={actions}
                  modelImageMap={modelImageMap}
                  selected={selectedIds.has(order.id)}
                  onSelect={() => onToggleSelect(order.id)}
                />
              ))}
            </Box>
          )
        }
      </Box>
    </Box>
  )
}

// ── Main ShopOrderGrid ──────────────────────────────────────────────

export default function ShopOrderGrid() {
  const { tenantId: ctxTenantId, companyId: ctxCompanyId } = useAppContext()
  const [rows, setRows]                 = useState([])
  const [boardRows, setBoardRows]       = useState([])   // for board tabs — unfiltered
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOrder, setDetailOrder]   = useState(null)
  const [resetOpen, setResetOpen]       = useState(false)
  const [resetTo, setResetTo]           = useState(0)
  const [resetting, setResetting]       = useState(false)
  const [manualOpen, setManualOpen]     = useState(false)
  const [manualDefaults, setManualDefaults] = useState(null)
  const [qrOrderOpen, setQrOrderOpen]   = useState(false)
  const [boardOpen, setBoardOpen]       = useState(false)
  const [boardUrl, setBoardUrl]         = useState('')
  const [customerBoardUrl, setCustomerBoardUrl] = useState('')
  const [boardLoading, setBoardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [copiedCustomer, setCopiedCustomer] = useState(false)
  const [tab, setTab]                   = useState(0)
  const [stockItems, setStockItems]     = useState([])
  const [pendingStockUids, setPendingStockUids] = useState([])
  const [payQrOrder, setPayQrOrder]     = useState(null)
  const [bankConfig, setBankConfig]     = useState(null)
  const [tables, setTables]             = useState([])
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [moveTableOpen, setMoveTableOpen] = useState(false)
  const [moveTableTarget, setMoveTableTarget] = useState('')
  const [moving, setMoving]             = useState(false)
  const [eodOpen, setEodOpen]           = useState(false)
  const [confirmDlg, setConfirmDlg]     = useState(null)
  // confirmDlg shape: { title, message, confirmLabel, confirmColor, requireReason, onConfirm }
  const [pickupQrOrder, setPickupQrOrder] = useState(null)  // { id, orderNumber, orderCode, qrBase64 }
  const [trackQrOrder, setTrackQrOrder]   = useState(null)  // { order, qrBase64, loading }
  const [combinedToken, setCombinedToken] = useState(null)  // token string — opens CombinedReceiptDialog
  const [modelImageMap, setModelImageMap] = useState({})   // { [modelId]: imageUrl }
  const [staffCalls, setStaffCalls]       = useState([])   // pending staff calls
  const seenCallIdsRef = React.useRef(new Set())

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchShopOrders(statusFilter || null)
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load orders') }
    setLoading(false)
  }, [statusFilter])

  const loadBoard = useCallback(async () => {
    try {
      const [activeRes, pickedRes] = await Promise.all([
        fetchActiveOrders(),
        fetchShopOrders('PICKED_UP'),
      ])
      const all = [
        ...(Array.isArray(activeRes.data) ? activeRes.data : []),
        ...(Array.isArray(pickedRes.data) ? pickedRes.data : []),
      ]
      setBoardRows(all)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => {
    fetchShopTables().then(({ data }) => setTables(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])
  useEffect(() => {
    fetchModels().then(list => {
      const map = {}
      ;(Array.isArray(list) ? list : []).forEach(m => { if (m.imageUrl) map[m.id] = m.imageUrl })
      setModelImageMap(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const { res, data } = await fetchStaffCalls()
        if (cancelled || !res.ok) return
        const calls = Array.isArray(data) ? data : []
        setStaffCalls(calls)
        calls.forEach(c => {
          if (!seenCallIdsRef.current.has(c.id)) {
            seenCallIdsRef.current.add(c.id)
            playStaffCallSound()
          }
        })
      } catch { /* silent */ }
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const reload = () => { load(); loadBoard() }

  // Derived per-status slices for board tabs
  const confirmedOrders = boardRows.filter(r => r.status === 'CONFIRMED')
  const preparingOrders = boardRows.filter(r => r.status === 'PREPARING')
  const readyOrders     = boardRows.filter(r => r.status === 'READY')
  const pickedUpOrders  = boardRows.filter(r => r.status === 'PICKED_UP')

  const act = async (fn, id) => {
    try { await fn(id); reload() } catch (e) { setError(e.message || 'Action failed') }
  }

  const askConfirm = (cfg, fn) => setConfirmDlg({ ...cfg, onConfirm: async (reason) => { setConfirmDlg(null); await fn(reason) } })

  const handleBoardAction = (type, id, orderNum) => {
    const configs = {
      'prepare':               { title: 'Start Preparing?',     message: `Start preparing order #${orderNum}?`,              confirmLabel: 'Start Preparing', confirmColor: 'warning' },
      'revert':                { title: 'Revert to Waiting Confirm?',   message: 'Revert this confirmed order back to waiting confirm?',      confirmLabel: 'Revert',          confirmColor: 'error'   },
      'revert-from-preparing': { title: 'Revert to Waiting Confirm?',   message: 'Stop preparing and revert this order to waiting confirm?',  confirmLabel: 'Revert',          confirmColor: 'error'   },
      'ready':                 { title: 'Mark as Ready?',       message: `Mark order #${orderNum} as ready for pickup?`,      confirmLabel: 'Mark Ready',      confirmColor: 'success' },
      'complete':              { title: 'Complete Order?',      message: `Complete order #${orderNum}?`,                     confirmLabel: 'Complete',        confirmColor: 'success' },
      'pickup':                { title: 'Mark as Picked Up?',   message: 'Confirm customer has picked up this order?',        confirmLabel: 'Picked Up',       confirmColor: 'primary' },
      'pay':                   { title: 'Mark as Paid?',        message: `Mark order #${orderNum} as paid?`,                 confirmLabel: 'Mark Paid',       confirmColor: 'success' },
    }
    const cfg = configs[type]
    if (!cfg) return
    const fns = {
      'prepare': prepareShopOrder,
      'revert': revertShopOrder,
      'revert-from-preparing': revertShopOrder,
      'ready': async (i) => { await readyShopOrder(i); broadcastReady() },
      'complete': completeShopOrder,
      'pickup': pickupShopOrder,
      'pay': markOrderPaid,
    }
    askConfirm(cfg, async () => {
      try { await fns[type](id); reload() } catch (e) { setError(e.message || 'Action failed') }
    })
  }

  const doCancelOrder = async (row, reason) => {
    try {
      await cancelShopOrder(row.id, reason)
      if (row.items?.length) {
        const newStock = row.items.map(item => ({
          uid: crypto.randomUUID(),
          modelId: item.modelId, modelName: item.modelName,
          sellingPrice: item.unitPrice, qty: Number(item.quantity),
          selectedOptions: parseOpts(item.selectedOptions) || {},
          itemNotes: item.itemNotes || '',
          cancelledFromOrderCode: row.orderCode,
          utilizedOrderCode: null,
        }))
        setStockItems(prev => [...prev, ...newStock])
      }
      reload()
    } catch (e) { setError(e.message || 'Failed to cancel') }
  }

  const handleUseInOrder = (queueItems) => {
    setPendingStockUids(queueItems.map(i => i.uid))
    setManualDefaults(queueItems)
    setManualOpen(true)
  }

  const handleCancel = (row) => askConfirm({
    title: `Cancel Order #${row.orderNumber ?? row.orderCode}?`,
    message: 'This will permanently cancel the order. Items will be moved to the stock panel.',
    confirmLabel: 'Cancel Order',
    confirmColor: 'error',
    requireReason: true,
    reasonLabel: 'Reason for cancellation',
  }, (reason) => doCancelOrder(row, reason))

  const handleOpenBoard = async () => {
    setBoardLoading(true); setBoardOpen(true)
    try {
      const { data } = await generateDisplayBoardToken()
      const base = `${window.location.origin}/bom-inventory`
      setBoardUrl(`${base}/shop/board?t=${data.token}`)
      setCustomerBoardUrl(`${base}/shop/customer-board?t=${data.token}`)
    } catch (e) { setError(e.message || 'Failed to generate board URL') }
    setBoardLoading(false)
  }

  const handleReset = async () => {
    setResetting(true)
    try { await resetOrderSequence(Number(resetTo)); setResetOpen(false); setResetTo(0) }
    catch (e) { setError(e.message || 'Reset failed') }
    setResetting(false)
  }

  const handleSwitchAndPrint = async (row) => {
    try {
      const { res, data } = await switchToQrPayment(row.id)
      if (!res.ok) { setError(data?.message || 'Failed to switch payment method'); return }
      printOrderReceipt(data)
      reload()
    } catch (e) { setError(e.message || 'Failed to switch payment method') }
  }

  const handleRevertToCash = async (row) => {
    try {
      const { res, data } = await revertToCash(row.id)
      if (!res.ok) { setError(data?.message || 'Failed to revert payment'); return }
      reload()
    } catch (e) { setError(e.message || 'Failed to revert payment') }
  }

  const handleMoveTable = async () => {
    if (!selectedRows.size) return
    setMoving(true)
    try {
      await Promise.all(Array.from(selectedRows).map(id => setOrderTable(id, moveTableTarget || null)))
      setMoveTableOpen(false); setMoveTableTarget(''); setSelectedRows(new Set())
      reload()
    } catch (e) { setError(e.message || 'Failed to move orders') }
    setMoving(false)
  }

  const handleInlineTableChange = async (orderId, tableId) => {
    try { await setOrderTable(orderId, tableId || null); reload() }
    catch (e) { setError(e.message || 'Failed to set table') }
  }

  const handlePrintTrack = async (row) => {
    try {
      const { data } = await fetchOrderTagQr(row.id)
      printOrderTag(row, data?.qrBase64 || null)
    } catch (e) { setError(e.message || 'Failed to fetch tracking QR') }
  }

  const handlePayQr = async (order) => {
    let config = bankConfig
    if (!config) {
      try {
        const { data } = await fetchBankConfig()
        setBankConfig(data || {})
        config = data || {}
      } catch { setError('Failed to load bank config'); return }
    }
    setPayQrOrder(order)
  }

  const handlePickupQr = async (row) => {
    try {
      const { data } = await fetchPickupQr(row.id)
      setPickupQrOrder({ id: row.id, orderNumber: row.orderNumber, orderCode: row.orderCode, qrBase64: data.qrBase64 })
    } catch (e) { setError('Failed to generate pickup QR: ' + (e.message || e)) }
  }

  const handleShowTrackQr = async (row) => {
    setTrackQrOrder({ order: row, qrBase64: null, loading: true })
    try {
      const { data } = await fetchOrderTagQr(row.id)
      setTrackQrOrder({ order: row, qrBase64: data?.qrBase64 || null, loading: false })
    } catch (e) {
      setTrackQrOrder(prev => prev ? { ...prev, loading: false } : null)
      setError('Failed to fetch tracking QR')
    }
  }

  const cardActions = {
    detail:          (row) => setDetailOrder(row),
    combinedReceipt: (token) => setCombinedToken(token),
    payQr:           handlePayQr,
    printTag:        handlePrintTrack,
    setTable:        handleInlineTableChange,
    setOrderNumber:  async (id, num) => {
      const n = parseInt(num, 10)
      if (isNaN(n) || n < 1) return
      try { await setShopOrderNumber(id, n); reload() }
      catch (e) { setError(e.message || 'Failed to update number') }
    },
    confirm:    (row) => askConfirm({ title: 'Confirm Order?', message: `Confirm order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Confirm', confirmColor: 'primary' }, () => act(confirmShopOrder, row.id)),
    prepare:    (row) => askConfirm({ title: 'Start Preparing?', message: `Start preparing order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Start', confirmColor: 'warning' }, () => act(prepareShopOrder, row.id)),
    ready:      (row) => askConfirm({ title: 'Mark as Ready?', message: `Mark order #${row.orderNumber ?? row.orderCode} as ready?`, confirmLabel: 'Mark Ready', confirmColor: 'success' }, async () => { await act(readyShopOrder, row.id); broadcastReady() }),
    complete:   (row) => askConfirm({ title: 'Complete Order?', message: `Complete order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Complete', confirmColor: 'success' }, () => act(completeShopOrder, row.id)),
    pickup:     (row) => askConfirm({ title: 'Mark as Picked Up?', message: 'Confirm customer has picked up this order?', confirmLabel: 'Picked Up', confirmColor: 'primary' }, () => act(pickupShopOrder, row.id)),
    markPaid:   (row) => askConfirm({ title: 'Mark as Paid?', message: `Mark order #${row.orderNumber ?? row.orderCode} as paid?`, confirmLabel: 'Mark Paid', confirmColor: 'success' }, () => act(markOrderPaid, row.id)),
    cancel:     handleCancel,
    switchToQr: (row) => askConfirm({ title: 'Switch to QR payment?', message: 'Switch this order to Bank QR and print receipt?', confirmLabel: 'Switch & Print', confirmColor: 'success' }, () => handleSwitchAndPrint(row)),
    revertCash: (row) => askConfirm({ title: 'Revert to Cash?', message: 'Change payment method back to cash?', confirmLabel: '→ Cash', confirmColor: 'warning' }, () => handleRevertToCash(row)),
    pickupQr:    handlePickupQr,
    showTrackQr: handleShowTrackQr,
  }

  const tabBadge = (label, count, color = 'primary') => (
    <Badge badgeContent={count || null} color={color} max={99}
      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
      <span style={{ paddingRight: count ? 10 : 0 }}>{label}</span>
    </Badge>
  )

  const handleDismissCall = async (id) => {
    try { await dismissStaffCall(id) } catch { /* silent */ }
    setStaffCalls(prev => prev.filter(c => c.id !== id))
    seenCallIdsRef.current.delete(id)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

      {/* ── Staff call banner ──────────────────────────────── */}
      {staffCalls.length > 0 && (
        <Box sx={{ flexShrink: 0, bgcolor: '#fff3e0', borderBottom: '2px solid #ff5722', px: 2, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {staffCalls.map(call => (
            <Box key={call.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <SupportAgentIcon sx={{ color: '#ff5722', fontSize: 20, flexShrink: 0 }} />
              <Typography fontWeight={800} sx={{ color: '#bf360c', fontSize: 13, flexShrink: 0 }}>
                Gọi nhân viên
              </Typography>
              {call.tableId && (
                <Chip label={`Bàn ${call.tableId}`} size="small" color="warning" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />
              )}
              <Chip
                label={call.reason === 'payment' ? 'Thanh toán' : 'Hỗ trợ khác'}
                size="small"
                sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#ff5722', color: '#fff' }}
              />
              {call.note && (
                <Typography variant="caption" sx={{ color: '#555', fontStyle: 'italic', flex: 1 }}>{call.note}</Typography>
              )}
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {call.createdAt ? new Date(call.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </Typography>
              <Tooltip title="Đã xử lý">
                <IconButton size="small" onClick={() => handleDismissCall(call.id)}
                  sx={{ color: '#ff5722', p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {stockItems.length > 0 && (
        <StockPanel
          items={stockItems}
          onUseInOrder={handleUseInOrder}
          onClear={() => setStockItems([])}
          onRemoveItem={uid => setStockItems(prev => prev.filter(i => i.uid !== uid))}
        />
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
          <TextField select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="small" sx={{ width: 148 }}>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s ? (STATUS_LABEL[s] || s) : 'All'}</MenuItem>)}
          </TextField>
          <Button startIcon={<RefreshIcon />} onClick={reload} variant="outlined" size="small">Refresh</Button>
          <Button startIcon={<AddCircleOutlineIcon />} onClick={() => { setManualDefaults(null); setManualOpen(true) }}
            variant="contained" size="small" color="success" sx={{ textTransform: 'none', fontWeight: 700 }}>New Order</Button>
          <Button startIcon={<QrCode2Icon />} onClick={() => setQrOrderOpen(true)}
            variant="outlined" size="small" color="primary" sx={{ textTransform: 'none', fontWeight: 700 }}>QR Order</Button>
          {selectedRows.size > 0 && (
            <Button
              startIcon={<DriveFileMoveIcon />}
              onClick={() => { setMoveTableTarget(''); setMoveTableOpen(true) }}
              variant="contained" size="small" color="info"
              sx={{ textTransform: 'none', fontWeight: 700 }}>
              Move {selectedRows.size} order{selectedRows.size > 1 ? 's' : ''} → Table
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<TvIcon />} onClick={handleOpenBoard} variant="outlined" size="small" color="info">Display Board</Button>
          <Tooltip title="Open the counter customer-facing display in a new tab">
            <Button startIcon={<MonitorIcon />}
              onClick={() => {
                const base = window.location.origin + '/bom-inventory/shop/counter'
                const q = ctxTenantId && ctxCompanyId ? `?tenantId=${ctxTenantId}&companyId=${ctxCompanyId}` : ''
                window.open(base + q, '_blank')
              }}
              variant="outlined" size="small" color="secondary" sx={{ textTransform: 'none' }}>
              Counter
            </Button>
          </Tooltip>
          <Button startIcon={<AssessmentIcon />} onClick={() => setEodOpen(true)} variant="outlined" size="small" color="secondary" sx={{ textTransform: 'none', fontWeight: 700 }}>EOD Audit</Button>
          <Button startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} variant="outlined" size="small" color="warning">Reset Counter</Button>
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mx: 1.5, mt: 0.5 }}>{error}</Alert>}

        {/* Tabs */}
        <Box sx={{ borderBottom: '1px solid #e0e0e0', px: 1.5, flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
            <Tab label="Orders"                                                                           sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Production',  confirmedOrders.length, 'primary')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Processing',  preparingOrders.length, 'warning')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Ready',       readyOrders.length,     'success')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Picked Up',   pickedUpOrders.length,  'info')}                         sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {tab === 0 && (
            <OrderCardGrid
              rows={rows}
              loading={loading}
              tables={tables}
              actions={cardActions}
              modelImageMap={modelImageMap}
              selectedIds={selectedRows}
              onToggleSelect={id => setSelectedRows(prev => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
              })}
            />
          )}
          {tab === 1 && <StatusBoard status="CONFIRMED"  orders={confirmedOrders} modelImageMap={modelImageMap} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} />}
          {tab === 2 && <StatusBoard status="PREPARING"  orders={preparingOrders} modelImageMap={modelImageMap} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} />}
          {tab === 3 && <StatusBoard status="READY"      orders={readyOrders}     modelImageMap={modelImageMap} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} />}
          {tab === 4 && <StatusBoard status="PICKED_UP"  orders={pickedUpOrders}  modelImageMap={modelImageMap} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} />}
        </Box>
      </Box>

      {/* Dialogs */}
      <ManualOrderDialog
        open={manualOpen}
        onClose={() => { setManualOpen(false); setManualDefaults(null); setPendingStockUids([]) }}
        onCreated={(createdOrder) => {
          if (pendingStockUids.length && createdOrder?.orderCode) {
            setStockItems(prev => prev.map(i =>
              pendingStockUids.includes(i.uid)
                ? { ...i, utilizedOrderCode: createdOrder.orderCode }
                : i
            ))
          }
          setPendingStockUids([])
          reload()
        }}
        defaultItems={manualDefaults}
      />
      <EodAuditDialog open={eodOpen} onClose={() => setEodOpen(false)} />
      <QrOrderDialog open={qrOrderOpen} onClose={() => setQrOrderOpen(false)} />
      {detailOrder && (
        <ShopOrderDetailModal open order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={() => { reload(); setDetailOrder(null) }} />
      )}

      <Dialog open={boardOpen} onClose={() => setBoardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TvIcon color="info" /> Display Boards</DialogTitle>
        <DialogContent>
          {boardLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box> : boardUrl ? (
            <Stack spacing={2.5}>

              {/* Staff board */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <TvIcon fontSize="small" color="info" />
                  <Typography variant="body2" fontWeight={700}>Staff Board</Typography>
                  <Typography variant="caption" color="text.secondary">— full detail (kitchen / bar)</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField value={boardUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 12 } }} onClick={e => e.target.select()} />
                  <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                    <IconButton onClick={() => { navigator.clipboard.writeText(boardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} color={copied ? 'success' : 'default'} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Button variant="text" size="small" sx={{ mt: 0.5 }} onClick={() => window.open(boardUrl, '_blank')}>Open in new tab →</Button>
              </Box>

              {/* Customer board + Link Device QR */}
              <Box sx={{ bgcolor: '#f0fdf4', borderRadius: 2, p: 1.5, border: '1px solid #bbf7d0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <PeopleAltIcon fontSize="small" sx={{ color: '#16a34a' }} />
                  <Typography variant="body2" fontWeight={700} color="#16a34a">Customer Board</Typography>
                  <Typography variant="caption" color="text.secondary">— order numbers (waiting area TV)</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField value={customerBoardUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 12 } }} onClick={e => e.target.select()} />
                  <Tooltip title={copiedCustomer ? 'Copied!' : 'Copy URL'}>
                    <IconButton onClick={() => { navigator.clipboard.writeText(customerBoardUrl); setCopiedCustomer(true); setTimeout(() => setCopiedCustomer(false), 2000) }} color={copiedCustomer ? 'success' : 'default'} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Button variant="text" size="small" color="success" sx={{ mt: 0.5 }} onClick={() => window.open(customerBoardUrl, '_blank')}>Open in new tab →</Button>

                {/* ── Link Device QR ── */}
                <Box sx={{
                  mt: 1.5,
                  bgcolor: '#022c22',
                  border: '2px solid #16a34a',
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                }}>
                  {/* QR code image — generated from the customer board URL */}
                  <Box sx={{
                    bgcolor: '#fff',
                    borderRadius: 1.5,
                    p: 0.75,
                    flexShrink: 0,
                    border: '2px solid #4ade80',
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(customerBoardUrl)}`}
                      alt="Customer Board QR"
                      style={{ width: 160, height: 160, display: 'block' }}
                    />
                  </Box>
                  {/* Instructions */}
                  <Box>
                    <Typography sx={{ fontWeight: 800, color: '#4ade80', fontSize: 14, mb: 0.75 }}>
                      📱 Link a Device
                    </Typography>
                    <Typography sx={{ color: '#86efac', fontSize: 12, lineHeight: 1.6 }}>
                      Scan this QR with a phone or tablet to mirror the customer board live.
                    </Typography>
                    <Typography sx={{ color: '#4ade80', fontSize: 11, mt: 0.75, lineHeight: 1.5, fontStyle: 'italic' }}>
                      Counter tip: open on your counter phone and show it to customers so they can track their order.
                    </Typography>
                    <Button
                      size="small" variant="outlined"
                      startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
                      onClick={() => { navigator.clipboard.writeText(customerBoardUrl); setCopiedCustomer(true); setTimeout(() => setCopiedCustomer(false), 2000) }}
                      sx={{ mt: 1, borderColor: '#4ade80', color: '#4ade80', fontWeight: 700, fontSize: 11, textTransform: 'none', '&:hover': { borderColor: '#22c55e', bgcolor: '#14532d' } }}>
                      {copiedCustomer ? 'Copied!' : 'Copy link'}
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">Both links use the same token and are valid for 24 hours.</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setBoardOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Payment QR dialog — generate VietQR (qr_only, no logo in center) for any unpaid order */}
      {payQrOrder && (() => {
        const cfg = bankConfig
        const qrUrl = cfg?.bankBin && cfg?.bankAccountNumber
          ? `https://img.vietqr.io/image/${cfg.bankBin}-${cfg.bankAccountNumber}-qr_only.png`
            + `?amount=${Math.round(Number(payQrOrder.totalAmount || 0))}`
            + `&addInfo=${encodeURIComponent(payQrOrder.orderCode || '')}`
            + `&accountName=${encodeURIComponent(cfg.bankAccountName || '')}`
          : null
        return (
          <Dialog open onClose={() => setPayQrOrder(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon color="primary" />
                <Typography fontWeight={700}>Payment QR</Typography>
              </Box>
              <IconButton size="small" onClick={() => setPayQrOrder(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              {qrUrl ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#15803d" sx={{ mb: 1 }}>
                    Scan to Pay · VietQR
                  </Typography>
                  <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                    <img src={qrUrl} alt="VietQR payment"
                      style={{ width: 200, height: 200, display: 'block', borderRadius: 6 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={900} color="primary" sx={{ mt: 1.25 }}>
                    {fmt(payQrOrder.totalAmount)}
                  </Typography>
                  {payQrOrder.orderNumber && (
                    <Typography variant="body2" fontWeight={700} color="text.secondary">
                      Order #{payQrOrder.orderNumber}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    ref: {payQrOrder.orderCode}
                  </Typography>
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No bank account configured. Set it up in <strong>Bank Account Setup</strong> first.
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button onClick={() => setPayQrOrder(null)} sx={{ textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Move to Table dialog */}
      <Dialog open={moveTableOpen} onClose={() => setMoveTableOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Move {selectedRows.size} Order{selectedRows.size > 1 ? 's' : ''} to Table</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the target table. Choose "No table" to unassign.
          </Typography>
          <TextField select label="Target table" size="small" fullWidth
            value={moveTableTarget}
            onChange={e => setMoveTableTarget(e.target.value)}>
            <MenuItem value=""><em>No table</em></MenuItem>
            {tables.map(t => <MenuItem key={t.id} value={t.id}>{t.tableName}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveTableOpen(false)} disabled={moving}>Cancel</Button>
          <Button onClick={handleMoveTable} variant="contained" color="info" disabled={moving}
            startIcon={moving ? <CircularProgress size={14} /> : <DriveFileMoveIcon />}>
            {moving ? 'Moving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {/* Pickup QR dialog */}
      {pickupQrOrder && (() => {
        const { orderNumber, orderCode, qrBase64 } = pickupQrOrder
        const origin = window.location.origin + '/bom-inventory'
        const pickupUrl = `${origin}/shop/pickup/${orderCode}` + (ctxTenantId && ctxCompanyId ? `?tenantId=${ctxTenantId}&companyId=${ctxCompanyId}` : '')
        return (
          <Dialog open onClose={() => setPickupQrOrder(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
              Pickup QR — Order #{orderNumber ?? orderCode}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center', pb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Customer scans this QR → counter screen shows payment QR automatically
              </Typography>
              {qrBase64 && (
                <Box sx={{ bgcolor: '#fff', display: 'inline-block', p: 1, borderRadius: 2, border: '2px solid #e0e0e0', mb: 2 }}>
                  <img src={`data:image/png;base64,${qrBase64}`} alt="Pickup QR" style={{ width: 220, height: 220, display: 'block' }} />
                </Box>
              )}
              <TextField
                value={pickupUrl}
                size="small" fullWidth
                inputProps={{ readOnly: true, style: { fontSize: 11 } }}
                onClick={e => e.target.select()}
                sx={{ mb: 1 }}
              />
              <Button variant="outlined" size="small" onClick={() => navigator.clipboard.writeText(pickupUrl)} startIcon={<ContentCopyIcon />}>
                Copy Link
              </Button>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPickupQrOrder(null)}>Close</Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Tracking QR dialog — show QR to customer (view only, includes session token) */}
      {trackQrOrder && (() => {
        const { order, qrBase64, loading } = trackQrOrder
        const origin = window.location.origin + '/bom-inventory'
        const trackUrl = order.sourceToken
          ? `${origin}/shop/order/${order.orderCode}?t=${encodeURIComponent(order.sourceToken)}`
          : `${origin}/shop/order/${order.orderCode}`
        return (
          <Dialog open onClose={() => setTrackQrOrder(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon sx={{ color: '#0288d1' }} />
                <Typography fontWeight={800} variant="h6">Track Order</Typography>
              </Box>
              <IconButton size="small" onClick={() => setTrackQrOrder(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0, textAlign: 'center' }}>
              {order.orderNumber != null && (
                <Typography sx={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: '#0288d1', letterSpacing: -2, mb: 0.5 }}>
                  #{order.orderNumber}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Customer scans to track order · view only
              </Typography>
              {loading ? (
                <Box sx={{ py: 4 }}><CircularProgress /></Box>
              ) : qrBase64 ? (
                <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #e1f5fe', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', mb: 1.5 }}>
                  <img src={`data:image/png;base64,${qrBase64}`} alt="Tracking QR"
                    style={{ width: 220, height: 220, display: 'block' }} />
                </Box>
              ) : (
                <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>Failed to load tracking QR</Alert>
              )}
              <TextField
                value={trackUrl}
                size="small" fullWidth
                inputProps={{ readOnly: true, style: { fontSize: 11 } }}
                onClick={e => e.target.select()}
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1 }}>
              <Button onClick={() => setTrackQrOrder(null)} sx={{ textTransform: 'none' }}>Close</Button>
              <Button
                variant="contained" startIcon={<PrintIcon />}
                onClick={() => printOrderTag(order, qrBase64)}
                disabled={!qrBase64 || loading}
                sx={{ fontWeight: 700, textTransform: 'none', flex: 1, bgcolor: '#0288d1', '&:hover': { bgcolor: '#0277bd' } }}>
                Print QR Note
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Reset Order Counter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Next new order will be <strong>#{Number(resetTo) + 1}</strong>.
          </Typography>
          <TextField label="Reset counter to" type="number" size="small" fullWidth value={resetTo}
            onChange={e => setResetTo(e.target.value)} inputProps={{ min: 0 }} helperText="Use 0 to restart from #1" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
          <Button onClick={handleReset} variant="contained" color="warning" disabled={resetting}>
            {resetting ? 'Resetting…' : `Reset to ${resetTo}`}
          </Button>
        </DialogActions>
      </Dialog>

      {combinedToken && (
        <CombinedReceiptDialog
          token={combinedToken}
          onClose={() => setCombinedToken(null)}
          onRefresh={reload}
        />
      )}
      </Box>
    </Box>
  )
}

// ── Combined Receipt Dialog ──────────────────────────────────────────
function CombinedReceiptDialog({ token, onClose, onRefresh }) {
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [paying, setPaying]       = useState(false)
  const [switching, setSwitching] = useState(false)  // 'toQr' | 'toCash' | false
  const [bankConfig, setBankConfig] = useState(null)

  const fmtAmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'

  const reload = () => {
    setLoading(true)
    fetchOrdersByToken(token)
      .then(({ res, data }) => {
        if (!res.ok) { setError(data?.error || 'Failed to load'); return }
        setOrders(data || [])
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBankConfig().then(({ data }) => setBankConfig(data || {})).catch(() => {})
  }, [])

  const activeOrders  = orders.filter(o => o.status !== 'CANCELLED')
  const unpaidOrders  = activeOrders.filter(o => o.paymentStatus !== 'PAID')
  const switchableToQr = activeOrders.filter(o =>
    o.paymentStatus !== 'PAID' && o.paymentMethod === 'CASH' &&
    !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(o.status)
  )
  const switchableToCash = activeOrders.filter(o =>
    o.paymentStatus !== 'PAID' &&
    (o.paymentMethod === 'BANK_QR' || o.paymentMethod === 'SPLIT') &&
    !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(o.status)
  )
  const grandTotal    = activeOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
  const unpaidTotal   = unpaidOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)

  // After switching to QR, show the combined QR for the unpaid total
  const anyQrPay = activeOrders.some(o =>
    o.paymentMethod === 'BANK_QR' || o.paymentMethod === 'SPLIT'
  )
  const payQrUrl = bankConfig?.bankBin && bankConfig?.bankAccountNumber && anyQrPay
    ? `https://img.vietqr.io/image/${bankConfig.bankBin}-${bankConfig.bankAccountNumber}-qr_only.png`
      + `?amount=${Math.round(unpaidTotal)}`
      + `&addInfo=${encodeURIComponent(token?.substring(0, 12) || 'combined')}`
      + `&accountName=${encodeURIComponent(bankConfig.bankAccountName || '')}`
    : null

  const handleMarkAllPaid = async () => {
    if (!unpaidOrders.length) return
    setPaying(true)
    try {
      for (const o of unpaidOrders) await markOrderPaid(o.id)
      onRefresh(); onClose()
    } catch { setError('Failed to mark orders paid') }
    setPaying(false)
  }

  const handleSwitchAllToQr = async () => {
    if (!switchableToQr.length) return
    setSwitching('toQr')
    try {
      for (const o of switchableToQr) {
        const { res, data } = await switchToQrPayment(o.id)
        if (!res.ok) throw new Error(data?.message || `Failed for order #${o.orderNumber}`)
      }
      reload()
      onRefresh()
    } catch (e) { setError(e.message || 'Failed to switch to QR') }
    setSwitching(false)
  }

  const handleSwitchAllToCash = async () => {
    if (!switchableToCash.length) return
    setSwitching('toCash')
    try {
      for (const o of switchableToCash) {
        const { res, data } = await revertToCash(o.id)
        if (!res.ok) throw new Error(data?.message || `Failed for order #${o.orderNumber}`)
      }
      reload()
      onRefresh()
    } catch (e) { setError(e.message || 'Failed to switch to cash') }
    setSwitching(false)
  }

  const handlePrintWithQr = () => {
    printCombinedReceipt(orders, {
      payQrUrl,
      unpaidTotal,
      tokenRef: token?.substring(0, 12) || 'combined',
    })
  }

  const STATUS_CHIP = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleAltIcon color="secondary" />
          <Typography fontWeight={800}>Combined Receipt</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && !error && (
          <>
            {/* Payment method switch bar */}
            {(switchableToQr.length > 0 || switchableToCash.length > 0) && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                {switchableToQr.length > 0 && (
                  <Button size="small" variant="outlined" color="success" fullWidth
                    startIcon={switching === 'toQr' ? <CircularProgress size={14} color="inherit" /> : <QrCode2Icon sx={{ fontSize: 14 }} />}
                    onClick={handleSwitchAllToQr}
                    disabled={!!switching}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                    → QR Pay ({switchableToQr.length})
                  </Button>
                )}
                {switchableToCash.length > 0 && (
                  <Button size="small" variant="outlined" color="warning" fullWidth
                    startIcon={switching === 'toCash' ? <CircularProgress size={14} color="inherit" /> : null}
                    onClick={handleSwitchAllToCash}
                    disabled={!!switching}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                    → Cash ({switchableToCash.length})
                  </Button>
                )}
              </Box>
            )}

            {/* Order list */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {orders.map((order) => {
                const num         = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
                const roots       = (order.items || []).filter(i => !i.parentItemId)
                const isCancelled = order.status === 'CANCELLED'
                const isQr        = order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT'
                return (
                  <Box key={order.id} sx={{
                    border: `1px solid ${isQr && !isCancelled ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: 1.5,
                    opacity: isCancelled ? 0.5 : 1,
                    bgcolor: isCancelled ? '#fafafa' : isQr ? '#f0fdf4' : '#fff',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                      bgcolor: isCancelled ? '#f5f5f5' : isQr ? '#dcfce7' : '#f8fafc',
                      borderRadius: '6px 6px 0 0' }}>
                      <Typography fontWeight={900} sx={{ fontSize: 18, minWidth: 34,
                        textDecoration: isCancelled ? 'line-through' : 'none', color: '#334155' }}>
                        {num}
                      </Typography>
                      <Chip label={order.status} color={STATUS_CHIP[order.status] || 'default'}
                        size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                      {order.tableName && (
                        <Chip label={`Table ${order.tableName}`} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                      )}
                      {isQr && !isCancelled && (
                        <Chip label="💳 QR" size="small" color="success" sx={{ fontWeight: 800, fontSize: 10 }} />
                      )}
                      <Box sx={{ flex: 1 }} />
                      <Typography fontWeight={800} color={isCancelled ? 'text.disabled' : 'primary'}
                        sx={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                        {fmtAmt(order.totalAmount)}
                      </Typography>
                      {order.paymentStatus === 'PAID' && (
                        <Chip label="Paid" color="success" size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                      )}
                    </Box>
                    <Box sx={{ px: 2, py: 0.75 }}>
                      {roots.slice(0, 4).map(item => (
                        <Typography key={item.id} variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                          {item.quantity}× {item.modelName}
                        </Typography>
                      ))}
                      {roots.length > 4 && (
                        <Typography variant="caption" color="text.secondary">+{roots.length - 4} more…</Typography>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* QR Pay panel — shown when any active order is on QR pay */}
            {payQrUrl && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                <Box sx={{ bgcolor: '#fff', borderRadius: 1.5, p: 0.75, border: '2px solid #4ade80', flexShrink: 0 }}>
                  <img src={payQrUrl} alt="QR Pay" style={{ width: 100, height: 100, display: 'block' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#15803d', fontSize: 13 }}>💳 QR Payment</Typography>
                  <Typography sx={{ fontWeight: 900, color: '#15803d', fontSize: 20, lineHeight: 1.2 }}>
                    {fmtAmt(unpaidTotal)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Unpaid total · scan to pay</Typography>
                </Box>
              </Box>
            )}

            {/* Grand total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''}
                {orders.length > activeOrders.length ? ` (${orders.length - activeOrders.length} cancelled)` : ''}
              </Typography>
              <Typography fontWeight={900} sx={{ fontSize: 20 }} color="primary">
                {fmtAmt(grandTotal)}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
        <Button variant="outlined" startIcon={<PrintIcon />}
          onClick={() => printCombinedReceipt(orders)}
          disabled={loading || !orders.length}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          Print
        </Button>
        {/* Print receipt + QR together — only when there's a QR pay URL */}
        {payQrUrl && (
          <Button variant="outlined" color="success"
            startIcon={<PrintIcon />}
            onClick={handlePrintWithQr}
            disabled={loading || !orders.length}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Print + QR
          </Button>
        )}
        {unpaidOrders.length > 0 && (
          <Button variant="contained" color="success"
            startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <PaidIcon />}
            onClick={handleMarkAllPaid} disabled={paying}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Mark All Paid ({unpaidOrders.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
