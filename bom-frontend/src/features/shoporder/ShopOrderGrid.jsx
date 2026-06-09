import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
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
import {
  fetchShopOrders, fetchActiveOrders, confirmShopOrder, prepareShopOrder, readyShopOrder,
  completeShopOrder, cancelShopOrder, resetOrderSequence, setShopOrderNumber,
  generateDisplayBoardToken, pickupShopOrder, revertShopOrder, markOrderPaid,
  fetchBankConfig, switchToQrPayment, revertToCash, fetchOrderTagQr,
  fetchShopTables, setOrderTable
} from '../../api/shopApi'
import { printCupLabels, printOrderReceipt, printOrderTag } from '../../utils/printOrderReceipt'
import ShopOrderDetailModal from './ShopOrderDetailModal'
import ManualOrderDialog from './ManualOrderDialog'
import QrOrderDialog from './QrOrderDialog'
import EodAuditDialog from './EodAuditDialog'
import ConfirmActionDialog from './ConfirmActionDialog'

const BOARD_CHANNEL = 'shop_display_board'
function broadcastReady() {
  try { new BroadcastChannel(BOARD_CHANNEL).postMessage({ type: 'ORDER_READY' }) } catch { /* */ }
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

function StatusBoard({ status, orders, onAction, onDetail, onPayQr }) {
  // onAction(type, orderId, orderNumber)
  const style = BOARD_STYLE[status] || BOARD_STYLE.CONFIRMED

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
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{since} ago</Typography>
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
              <Stack spacing={0.2} sx={{ mb: 1, minHeight: 32 }}>
                {(order.items || []).map(item => {
                  const opts = parseOpts(item.selectedOptions)
                  const optStr = Object.entries(opts).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('+') : v}`).join(' · ')
                  return (
                    <Box key={item.id}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13, color: style.color }}>
                        {Number(item.quantity)}× {item.modelName}
                      </Typography>
                      {optStr && <Typography variant="caption" sx={{ fontSize: 11, pl: 1.25, display: 'block', color: '#555' }}>{optStr}</Typography>}
                      {item.itemNotes && <Typography variant="caption" sx={{ fontSize: 11, pl: 1.25, fontStyle: 'italic', display: 'block', color: '#c62828', fontWeight: 700 }}>⚠ {item.itemNotes}</Typography>}
                    </Box>
                  )
                })}
              </Stack>

              {order.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontStyle: 'italic', display: 'block', mb: 0.75 }}>Note: {order.notes}</Typography>}

              {/* Action buttons per status */}
              <Stack spacing={0.5}>
                {order.paymentStatus !== 'PAID' && status !== 'PICKED_UP' && (
                  <Button size="small" variant="contained" color="success" fullWidth
                    startIcon={<PaidIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onAction('pay', order.id, order.orderNumber)}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                    Mark as Paid
                  </Button>
                )}
                {status === 'CONFIRMED' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button size="small" variant="contained" color="warning" fullWidth onClick={() => onAction('prepare', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Start Preparing</Button>
                    <Tooltip title="Revert to Pending">
                      <Button size="small" variant="outlined" color="error" onClick={() => onAction('revert', order.id, order.orderNumber)} startIcon={<UndoIcon sx={{ fontSize: 13 }} />} sx={{ textTransform: 'none', fontSize: 11, minWidth: 76 }}>Revert</Button>
                    </Tooltip>
                  </Box>
                )}
                {status === 'PREPARING' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('ready', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Mark Ready ✓</Button>
                    <Tooltip title="Revert to Pending">
                      <Button size="small" variant="outlined" color="error" onClick={() => onAction('revert-from-preparing', order.id, order.orderNumber)} startIcon={<UndoIcon sx={{ fontSize: 13 }} />} sx={{ textTransform: 'none', fontSize: 11, minWidth: 76 }}>Revert</Button>
                    </Tooltip>
                  </Box>
                )}
                {status === 'READY' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {(order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT')
                      ? <Button size="small" variant="contained" color="info" fullWidth onClick={() => onAction('pickup', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Picked Up ✓</Button>
                      : <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('complete', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Complete ✓</Button>
                    }
                  </Box>
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
  )
}

// ── Main ShopOrderGrid ──────────────────────────────────────────────

export default function ShopOrderGrid() {
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
  const [boardLoading, setBoardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [tab, setTab]                   = useState(0)
  const [stockItems, setStockItems]     = useState([])
  const [pendingStockUids, setPendingStockUids] = useState([])
  const [payQrOrder, setPayQrOrder]     = useState(null)
  const [bankConfig, setBankConfig]     = useState(null)
  const [tables, setTables]             = useState([])
  const [selectedRows, setSelectedRows] = useState({ type: 'include', ids: new Set() })
  const [moveTableOpen, setMoveTableOpen] = useState(false)
  const [moveTableTarget, setMoveTableTarget] = useState('')
  const [moving, setMoving]             = useState(false)
  const [eodOpen, setEodOpen]           = useState(false)
  const [confirmDlg, setConfirmDlg]     = useState(null)
  // confirmDlg shape: { title, message, confirmLabel, confirmColor, requireReason, onConfirm }

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
      'revert':                { title: 'Revert to Pending?',   message: 'Revert this confirmed order back to pending?',      confirmLabel: 'Revert',          confirmColor: 'error'   },
      'revert-from-preparing': { title: 'Revert to Pending?',   message: 'Stop preparing and revert this order to pending?',  confirmLabel: 'Revert',          confirmColor: 'error'   },
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
      setBoardUrl(`${window.location.origin}/bom-inventory/shop/board?t=${data.token}`)
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
    if (!selectedRows.ids.size) return
    setMoving(true)
    try {
      await Promise.all(Array.from(selectedRows.ids).map(id => setOrderTable(id, moveTableTarget || null)))
      setMoveTableOpen(false); setMoveTableTarget(''); setSelectedRows({ type: 'include', ids: new Set() })
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

  const processRowUpdate = useCallback(async (newRow, oldRow) => {
    if (newRow.orderNumber === oldRow.orderNumber) return oldRow
    const num = parseInt(newRow.orderNumber, 10)
    if (isNaN(num) || num < 1) return oldRow
    try {
      const { data } = await setShopOrderNumber(newRow.id, num)
      return data ?? { ...newRow, orderNumber: num }
    } catch (e) { setError(e.message || 'Failed to update number'); return oldRow }
  }, [])

  const columns = [
    {
      field: 'orderNumber', headerName: '#', width: 64, editable: true, type: 'number', headerAlign: 'center', align: 'center',
      renderCell: ({ value }) => (
        <Tooltip title="Click to edit number">
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: value ? '#1976d2' : '#e0e0e0', color: value ? '#fff' : '#9e9e9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {value ?? '–'}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'orderCode', headerName: 'Code', width: 130,
      renderCell: ({ value }) => value ? <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>{value}</Typography> : null,
    },
    {
      field: 'tableName', headerName: 'Table', width: 115,
      renderCell: ({ row }) => (
        <Box onClick={e => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <select
            value={row.tableId || ''}
            onChange={e => handleInlineTableChange(row.id, e.target.value)}
            style={{ fontSize: 12, height: 24, border: '1px solid #c4c4c4', borderRadius: 4, padding: '0 6px', minWidth: 100, cursor: 'pointer', background: '#fff', color: '#222' }}
          >
            <option value="">— no table —</option>
            {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
          </select>
        </Box>
      )
    },
    {
      field: 'status', headerName: 'Status', width: 115,
      renderCell: ({ value }) => <Chip label={STATUS_LABEL[value] || value} color={STATUS_COLOR[value] || 'default'} size="small" sx={{ fontWeight: 700, minWidth: 90 }} />
    },
    {
      field: 'fulfillmentType', headerName: 'Type', width: 80,
      renderCell: ({ value }) => { const map = { DINE_IN: '🪑 Dine', PICKUP: '🥡 Pick', DELIVERY: '🛵 Del' }; return <Typography variant="caption">{map[value] || value}</Typography> }
    },
    { field: 'customerName', headerName: 'Customer', width: 120, renderCell: ({ value }) => <Typography variant="body2" noWrap>{value || '—'}</Typography> },
    { field: 'staffName', headerName: 'Staff', width: 100, renderCell: ({ value }) => <Typography variant="caption" color="text.secondary" noWrap>{value || '—'}</Typography> },
    {
      field: 'notes', headerName: 'Notes', width: 130,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><Typography variant="caption" noWrap sx={{ maxWidth: 120, display: 'block' }}>{value}</Typography></Tooltip>
        : <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'totalAmount', headerName: 'Total', width: 100, renderCell: ({ value }) => <Typography variant="body2" fontWeight={600} color="primary">{fmt(value)}</Typography> },
    {
      field: 'paymentStatus', headerName: 'Payment', width: 100,
      renderCell: ({ value }) => value === 'PAID'
        ? <Chip icon={<PaidIcon sx={{ fontSize: 14 }} />} label="PAID" size="small" color="success" sx={{ fontWeight: 800, fontSize: 12 }} />
        : <Chip label="UNPAID" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700, fontSize: 12 }} />
    },
    { field: 'createdAt', headerName: 'Time', width: 130, renderCell: ({ value }) => dateFmt(value) },
    {
      field: 'actions', headerName: 'Actions', width: 470, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Tooltip title="Detail"><IconButton size="small" onClick={() => setDetailOrder(row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print Receipt (Pay)"><IconButton size="small" color="primary" onClick={() => printOrderReceipt(row)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print Tracking Tag"><IconButton size="small" color="secondary" onClick={() => handlePrintTrack(row)}><ConfirmationNumberIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print cup labels"><IconButton size="small" onClick={() => printCupLabels(row)}><LabelIcon fontSize="small" /></IconButton></Tooltip>
          {row.paymentStatus !== 'PAID' && row.status !== 'CANCELLED' && (
            <Tooltip title="Payment QR">
              <IconButton size="small" color="primary" onClick={() => handlePayQr(row)}><QrCode2Icon fontSize="small" /></IconButton>
            </Tooltip>
          )}
          {row.paymentMethod === 'CASH' && !['COMPLETED','PICKED_UP','CANCELLED'].includes(row.status) && (
            <Tooltip title="Switch to QR payment and print receipt">
              <Button size="small" variant="outlined" color="success"
                startIcon={<QrCode2Icon sx={{ fontSize: 13 }} />}
                onClick={() => askConfirm({ title: 'Switch to QR payment?', message: 'Switch this order to Bank QR and print receipt?', confirmLabel: 'Switch & Print', confirmColor: 'success' }, () => handleSwitchAndPrint(row))}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, px: 0.75, minWidth: 0 }}>
                → QR
              </Button>
            </Tooltip>
          )}
          {(row.paymentMethod === 'BANK_QR' || row.paymentMethod === 'SPLIT') && !['COMPLETED','PICKED_UP','CANCELLED'].includes(row.status) && (
            <Tooltip title="Revert to cash payment">
              <Button size="small" variant="outlined" color="warning"
                onClick={() => askConfirm({ title: 'Revert to Cash?', message: 'Change payment method back to cash?', confirmLabel: '→ Cash', confirmColor: 'warning' }, () => handleRevertToCash(row))}
                sx={{ textTransform: 'none', fontSize: 11, px: 0.75, minWidth: 0 }}>
                → Cash
              </Button>
            </Tooltip>
          )}
          {row.status === 'PENDING' && (
            <Button size="small" variant="outlined"
              onClick={() => askConfirm({ title: 'Confirm Order?', message: `Confirm order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Confirm', confirmColor: 'primary' }, () => act(confirmShopOrder, row.id))}>
              Confirm
            </Button>
          )}
          {row.status === 'CONFIRMED' && (
            <Button size="small" variant="outlined" color="warning"
              onClick={() => askConfirm({ title: 'Start Preparing?', message: `Start preparing order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Start', confirmColor: 'warning' }, () => act(prepareShopOrder, row.id))}>
              Prepare
            </Button>
          )}
          {row.status === 'CONFIRMED' && (
            <Tooltip title="Revert to Pending">
              <Button size="small" variant="outlined" color="error" startIcon={<UndoIcon sx={{ fontSize: 13 }} />}
                onClick={() => askConfirm({ title: 'Revert to Pending?', message: 'Revert order back to pending status?', confirmLabel: 'Revert', confirmColor: 'error' }, () => act(revertShopOrder, row.id))}>
                Revert
              </Button>
            </Tooltip>
          )}
          {row.status === 'PREPARING' && (
            <Button size="small" variant="outlined" color="success"
              onClick={() => askConfirm({ title: 'Mark as Ready?', message: `Mark order #${row.orderNumber ?? row.orderCode} as ready?`, confirmLabel: 'Mark Ready', confirmColor: 'success' }, async () => { await act(readyShopOrder, row.id); broadcastReady() })}>
              Ready
            </Button>
          )}
          {row.status === 'READY' && (row.paymentMethod === 'BANK_QR' || row.paymentMethod === 'SPLIT') && (
            <Button size="small" variant="contained" color="info"
              onClick={() => askConfirm({ title: 'Mark as Picked Up?', message: 'Confirm customer has picked up this order?', confirmLabel: 'Picked Up', confirmColor: 'primary' }, () => act(pickupShopOrder, row.id))}>
              Picked Up
            </Button>
          )}
          {row.status === 'READY' && row.paymentMethod !== 'BANK_QR' && row.paymentMethod !== 'SPLIT' && (
            <Button size="small" variant="contained" color="success"
              onClick={() => askConfirm({ title: 'Complete Order?', message: `Complete order #${row.orderNumber ?? row.orderCode}?`, confirmLabel: 'Complete', confirmColor: 'success' }, () => act(completeShopOrder, row.id))}>
              Complete
            </Button>
          )}
          {row.paymentStatus !== 'PAID' && !['PICKED_UP','COMPLETED','CANCELLED'].includes(row.status) && (
            <Tooltip title="Mark as paid">
              <Button size="small" variant="outlined" color="success" startIcon={<PaidIcon sx={{ fontSize: 13 }} />}
                onClick={() => askConfirm({ title: 'Mark as Paid?', message: `Mark order #${row.orderNumber ?? row.orderCode} as paid?`, confirmLabel: 'Mark Paid', confirmColor: 'success' }, () => act(markOrderPaid, row.id))}
                sx={{ fontWeight: 700, minWidth: 0, px: 0.75 }}>
                Paid
              </Button>
            </Tooltip>
          )}
          {!['PICKED_UP','COMPLETED','CANCELLED'].includes(row.status) && (
            <Button size="small" color="error" onClick={() => handleCancel(row)}>✕</Button>
          )}
        </Box>
      )
    }
  ]

  const tabBadge = (label, count, color = 'primary') => (
    <Badge badgeContent={count || null} color={color} max={99}
      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
      <span style={{ paddingRight: count ? 10 : 0 }}>{label}</span>
    </Badge>
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
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
          {selectedRows.ids.size > 0 && (
            <Button
              startIcon={<DriveFileMoveIcon />}
              onClick={() => { setMoveTableTarget(''); setMoveTableOpen(true) }}
              variant="contained" size="small" color="info"
              sx={{ textTransform: 'none', fontWeight: 700 }}>
              Move {selectedRows.ids.size} order{selectedRows.ids.size > 1 ? 's' : ''} → Table
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<TvIcon />} onClick={handleOpenBoard} variant="outlined" size="small" color="info">Display Board</Button>
          <Tooltip title="Open the counter customer-facing display in a new tab">
            <Button startIcon={<MonitorIcon />}
              onClick={() => window.open(window.location.origin + '/bom-inventory/shop/counter', '_blank')}
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
            <Box sx={{ height: '100%', p: 1.5, boxSizing: 'border-box' }}>
              <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id}
                pageSizeOptions={[25, 50, 100]} density="compact"
                checkboxSelection disableRowSelectionOnClick
                rowSelectionModel={selectedRows}
                onRowSelectionModelChange={ids => setSelectedRows(ids)}
                processRowUpdate={processRowUpdate} onProcessRowUpdateError={e => setError(e.message)}
                sx={{ height: '100%', '& .MuiDataGrid-cell--editable': { cursor: 'cell' }, '& .MuiDataGrid-row:hover': { bgcolor: '#f5f9ff' } }}
              />
            </Box>
          )}
          {tab === 1 && <StatusBoard status="CONFIRMED"  orders={confirmedOrders} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 2 && <StatusBoard status="PREPARING"  orders={preparingOrders} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 3 && <StatusBoard status="READY"      orders={readyOrders}     onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 4 && <StatusBoard status="PICKED_UP"  orders={pickedUpOrders}  onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
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
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TvIcon color="info" /> Display Board</DialogTitle>
        <DialogContent>
          {boardLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box> : boardUrl ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Open on a TV or tablet. Shows in-progress and ready orders, auto-refreshes. Valid 24 hours.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField value={boardUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 13 } }} onClick={e => e.target.select()} />
                <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                  <IconButton onClick={() => { navigator.clipboard.writeText(boardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} color={copied ? 'success' : 'default'}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Button variant="text" size="small" sx={{ mt: 1 }} onClick={() => window.open(boardUrl, '_blank')}>Open in new tab →</Button>
            </>
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
        <DialogTitle fontWeight={700}>Move {selectedRows.ids.size} Order{selectedRows.ids.size > 1 ? 's' : ''} to Table</DialogTitle>
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
    </Box>
  )
}
