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
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import TableBarIcon from '@mui/icons-material/TableBar'
import TvIcon from '@mui/icons-material/Tv'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import {
  fetchShopOrders, confirmShopOrder, prepareShopOrder, readyShopOrder,
  completeShopOrder, cancelShopOrder, resetOrderSequence, setShopOrderNumber,
  generateDisplayBoardToken, pickupShopOrder
} from '../../api/shopApi'
import ShopOrderDetailModal from './ShopOrderDetailModal'
import ManualOrderDialog from './ManualOrderDialog'
import QrOrderDialog from './QrOrderDialog'

const BOARD_CHANNEL = 'shop_display_board'
function broadcastReady() {
  try { new BroadcastChannel(BOARD_CHANNEL).postMessage({ type: 'ORDER_READY' }) } catch { /* ignore */ }
}

const STATUS_COLOR  = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }
const STATUS_LABEL  = { PENDING: 'Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready ✓', PICKED_UP: 'Picked Up ✓', COMPLETED: 'Done', CANCELLED: 'Cancelled' }
const STATUSES      = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED', 'CANCELLED']
const fmt           = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const dateFmt       = (v) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(v).toLocaleDateString('vi-VN') : ''

export default function ShopOrderGrid() {
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOrder, setDetailOrder]   = useState(null)
  const [resetOpen, setResetOpen]       = useState(false)
  const [resetTo, setResetTo]           = useState(0)
  const [resetting, setResetting]       = useState(false)
  const [manualOpen, setManualOpen]      = useState(false)
  const [qrOrderOpen, setQrOrderOpen]   = useState(false)
  const [boardOpen, setBoardOpen]       = useState(false)
  const [boardUrl, setBoardUrl]         = useState('')
  const [boardLoading, setBoardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchShopOrders(statusFilter || null)
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load orders') }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const act = async (fn, id) => {
    try { await fn(id); load() } catch (e) { setError(e.message || 'Action failed') }
  }

  const handleOpenBoard = async () => {
    setBoardLoading(true); setBoardOpen(true)
    try {
      const { data } = await generateDisplayBoardToken()
      const base = window.location.origin + '/bom-inventory'
      setBoardUrl(`${base}/shop/board?t=${data.token}`)
    } catch (e) { setError(e.message || 'Failed to generate board URL') }
    setBoardLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(boardUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetOrderSequence(Number(resetTo))
      setResetOpen(false)
      setResetTo(0)
    } catch (e) { setError(e.message || 'Reset failed') }
    setResetting(false)
  }

  // Inline order-number editing via DataGrid processRowUpdate
  const processRowUpdate = useCallback(async (newRow, oldRow) => {
    if (newRow.orderNumber === oldRow.orderNumber) return oldRow
    const num = parseInt(newRow.orderNumber, 10)
    if (isNaN(num) || num < 1) return oldRow
    try {
      const { data } = await setShopOrderNumber(newRow.id, num)
      return data ?? { ...newRow, orderNumber: num }
    } catch (e) {
      setError(e.message || 'Failed to update number')
      return oldRow
    }
  }, [])

  const columns = [
    {
      field: 'orderNumber',
      headerName: '#',
      width: 64,
      editable: true,
      type: 'number',
      headerAlign: 'center',
      align: 'center',
      renderCell: ({ value }) => (
        <Tooltip title="Click to edit number">
          <Box sx={{
            width: 36, height: 36, borderRadius: '50%',
            bgcolor: value ? '#1976d2' : '#e0e0e0',
            color: value ? '#fff' : '#9e9e9e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}>
            {value ?? '–'}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'orderCode',
      headerName: 'Code',
      flex: 1,
      minWidth: 110,
      renderCell: ({ value }) => value
        ? <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>{value}</Typography>
        : null,
    },
    {
      field: 'tableName',
      headerName: 'Table',
      width: 90,
      renderCell: ({ value }) => value
        ? <Chip icon={<TableBarIcon sx={{ fontSize: 14 }} />} label={value} size="small" variant="outlined" color="info" />
        : <Typography variant="caption" color="text.disabled">—</Typography>
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 115,
      renderCell: ({ value }) => (
        <Chip
          label={STATUS_LABEL[value] || value}
          color={STATUS_COLOR[value] || 'default'}
          size="small"
          sx={{ fontWeight: 700, minWidth: 90 }}
        />
      )
    },
    { field: 'fulfillmentType', headerName: 'Type', width: 80,
      renderCell: ({ value }) => {
        const map = { DINE_IN: '🪑 Dine', PICKUP: '🥡 Pick', DELIVERY: '🛵 Del' }
        return <Typography variant="caption">{map[value] || value}</Typography>
      }
    },
    { field: 'customerName', headerName: 'Customer', width: 120,
      renderCell: ({ value }) => <Typography variant="body2" noWrap>{value || '—'}</Typography>
    },
    { field: 'notes', headerName: 'Notes', width: 130,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><Typography variant="caption" noWrap sx={{ maxWidth: 120, display: 'block' }}>{value}</Typography></Tooltip>
        : <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'totalAmount', headerName: 'Total', width: 100,
      renderCell: ({ value }) => <Typography variant="body2" fontWeight={600} color="primary">{fmt(value)}</Typography>
    },
    { field: 'paymentStatus', headerName: 'Paid', width: 72,
      renderCell: ({ value }) => (
        <Chip label={value === 'PAID' ? '✓' : '…'} size="small"
          color={value === 'PAID' ? 'success' : 'default'} variant={value === 'PAID' ? 'filled' : 'outlined'} />
      )
    },
    { field: 'createdAt', headerName: 'Time', width: 130, renderCell: ({ value }) => dateFmt(value) },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 330,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Tooltip title="Detail">
            <IconButton size="small" onClick={() => setDetailOrder(row)}><VisibilityIcon fontSize="small" /></IconButton>
          </Tooltip>
          {row.status === 'PENDING'    && <Button size="small" variant="outlined" onClick={() => act(confirmShopOrder, row.id)}>Confirm</Button>}
          {row.status === 'CONFIRMED'  && <Button size="small" variant="outlined" color="warning" onClick={() => act(prepareShopOrder, row.id)}>Prepare</Button>}
          {row.status === 'PREPARING'  && <Button size="small" variant="outlined" color="success" onClick={() => { act(readyShopOrder, row.id).then(broadcastReady) }}>Ready</Button>}
          {row.status === 'READY' && row.paymentMethod === 'BANK_QR' && (
            <Button size="small" variant="contained" color="info" onClick={() => act(pickupShopOrder, row.id)}>Picked Up</Button>
          )}
          {row.status === 'READY' && row.paymentMethod !== 'BANK_QR' && (
            <Button size="small" variant="contained" color="success" onClick={() => act(completeShopOrder, row.id)}>Complete</Button>
          )}
          {!['PICKED_UP','COMPLETED','CANCELLED'].includes(row.status) && <Button size="small" color="error" onClick={() => act(cancelShopOrder, row.id)}>✕</Button>}
        </Box>
      )
    }
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="small" sx={{ width: 150 }}>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s ? (STATUS_LABEL[s] || s) : 'All'}</MenuItem>)}
        </TextField>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
        <Button startIcon={<AddCircleOutlineIcon />} onClick={() => setManualOpen(true)}
          variant="contained" size="small" color="success" sx={{ textTransform: 'none', fontWeight: 700 }}>
          New Order
        </Button>
        <Button startIcon={<QrCode2Icon />} onClick={() => setQrOrderOpen(true)}
          variant="outlined" size="small" color="primary" sx={{ textTransform: 'none', fontWeight: 700 }}>
          QR Order
        </Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Open display board for customers">
          <Button startIcon={<TvIcon />} onClick={handleOpenBoard} variant="outlined" size="small" color="info">
            Display Board
          </Button>
        </Tooltip>
        <Tooltip title="Reset the order counter (e.g. start of day)">
          <Button startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} variant="outlined" size="small" color="warning">
            Reset Counter
          </Button>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={r => r.id}
          pageSizeOptions={[25, 50, 100]}
          density="compact"
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={e => setError(e.message)}
          sx={{
            '& .MuiDataGrid-cell--editable': { cursor: 'cell' },
            '& .MuiDataGrid-row:hover': { bgcolor: '#f5f9ff' },
          }}
        />
      </Box>

      <ManualOrderDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={load}
      />

      <QrOrderDialog
        open={qrOrderOpen}
        onClose={() => setQrOrderOpen(false)}
      />

      {/* Detail modal */}
      {detailOrder && (
        <ShopOrderDetailModal open order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={load} />
      )}

      {/* Display board dialog */}
      <Dialog open={boardOpen} onClose={() => setBoardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TvIcon color="info" /> Display Board
        </DialogTitle>
        <DialogContent>
          {boardLoading ? (
            <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box>
          ) : boardUrl ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Open this URL on a TV or tablet. It shows in-progress and ready orders and refreshes automatically.
                The link is valid for <strong>24 hours</strong>.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  value={boardUrl} size="small" fullWidth
                  inputProps={{ readOnly: true, style: { fontSize: 13 } }}
                  onClick={e => e.target.select()}
                />
                <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                  <IconButton onClick={handleCopy} color={copied ? 'success' : 'default'}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Button variant="text" size="small" sx={{ mt: 1 }} onClick={() => window.open(boardUrl, '_blank')}>
                Open in new tab →
              </Button>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBoardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset counter dialog */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Reset Order Counter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set the counter to a specific number. The next new order will be <strong>#{Number(resetTo) + 1}</strong>.
          </Typography>
          <TextField
            label="Reset counter to"
            type="number"
            size="small"
            fullWidth
            value={resetTo}
            onChange={e => setResetTo(e.target.value)}
            inputProps={{ min: 0 }}
            helperText="Use 0 to restart from #1"
          />
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
