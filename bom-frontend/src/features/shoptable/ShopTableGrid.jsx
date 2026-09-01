import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import TableBarIcon from '@mui/icons-material/TableBar'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import {
  fetchShopTables, deleteShopTable, fetchTableQr, fetchShopOrders,
  completeShopOrder, resetOrderSequence
} from '../../api/shopApi'
import ShopTableEditModal from './ShopTableEditModal'
import ShopTableLayoutDesigner from './ShopTableLayoutDesigner'
import ManualOrderDialog from '../shoporder/ManualOrderDialog'
import ShopOrderDetailModal from '../shoporder/ShopOrderDetailModal'

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
const STATUS_CHIP = {
  PENDING:   { label: 'Placed',    color: 'default' },
  CONFIRMED: { label: 'Confirmed', color: 'success' },
  PREPARING: { label: 'Preparing', color: 'warning' },
  READY:     { label: 'Ready',     color: 'info' },
  PICKED_UP: { label: 'Picked Up', color: 'success' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'error' },
}

const fmtMoney = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' VND' : '-'
const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-'
const orderLabel = (order) => order?.orderNumber != null ? `#${order.orderNumber}` : order?.orderCode || '-'
const isActiveOrder = (order) => ACTIVE_STATUSES.has(order?.status)
const isCompletableOrder = (order) => order?.status === 'READY'
const makeSelectionModel = (ids = []) => ({ type: 'include', ids: new Set(ids) })

function selectionIds(model) {
  if (Array.isArray(model)) return model
  if (model?.ids) return Array.from(model.ids)
  return []
}

function statusChip(status, size = 'small') {
  const chip = STATUS_CHIP[status] || { label: status || '-', color: 'default' }
  return <Chip label={chip.label} size={size} color={chip.color} sx={{ fontWeight: 700 }} />
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

export default function ShopTableGrid() {
  const [rows, setRows]                   = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [editTable, setEditTable]         = useState(null)
  const [qrDialog, setQrDialog]           = useState(null)
  const [newOrderTable, setNewOrderTable] = useState(null)
  const [printConfirm, setPrintConfirm]   = useState(null)
  const [ordersDialog, setOrdersDialog]   = useState(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [completingSelected, setCompletingSelected] = useState(false)
  const [resettingSequence, setResettingSequence] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [showTableList, setShowTableList] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tablesRes, ordersRes] = await Promise.all([fetchShopTables(), fetchShopOrders()])
      const tables = Array.isArray(tablesRes.data) ? tablesRes.data : []
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
      setRows(tables.map(table => {
        const tableOrders = sortOrders(orders.filter(order => order.tableId && String(order.tableId) === String(table.id)))
        const activeOrders = tableOrders.filter(isActiveOrder)
        return {
          ...table,
          orders: tableOrders,
          activeOrders,
          activeOrder: activeOrders[0] || null,
          orderCount: tableOrders.length,
          activeOrderCount: activeOrders.length,
        }
      }))
    } catch { setError('Failed to load tables') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table?')) return
    try { await deleteShopTable(id); load() } catch (e) { setError(e.message || 'Delete failed') }
  }

  const handleQr = async (row, forceNew = false) => {
    if (forceNew && !window.confirm(`Generate a new QR for ${row.tableName}? The old printed sticker will stop working.`)) return
    setQrDialog({ table: row, qrBase64: '', activeOrderCount: 0 })
    try {
      const { data } = await fetchTableQr(row.id, forceNew)
      setQrDialog({ table: row, qrBase64: data?.qrBase64 || '', activeOrderCount: data?.activeOrderCount ?? 0 })
    } catch { setError('Failed to load QR') }
  }

  const doPrint = (row, qr) => {
    const win = window.open('', '_blank', 'width=500,height=600')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Table QR - ${row.tableName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #fff; padding: 24px; }
        .box { border: 3px solid #000; border-radius: 16px; padding: 32px 40px; text-align: center; max-width: 360px; width: 100%; }
        h1 { font-size: 42px; font-weight: 900; margin-bottom: 4px; }
        .sub { font-size: 16px; color: #555; margin-bottom: 24px; }
        img { width: 260px; height: 260px; display: block; margin: 0 auto 20px; }
        .footer { font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 12px; margin-top: 4px; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="box">
        <h1>${row.tableName}</h1>
        <p class="sub">Scan to order</p>
        <img src="data:image/png;base64,${qr}" alt="QR" />
        <p class="footer">Point your camera at the QR code</p>
      </div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800) }</script>
    </body></html>`)
    win.document.close()
  }

  const handlePrint = async (row) => {
    try {
      const { data } = await fetchTableQr(row.id)
      const qr = data?.qrBase64 || ''
      const count = data?.activeOrderCount ?? 0
      if (count > 0) {
        setPrintConfirm({ row, qrBase64: qr, activeOrderCount: count })
      } else {
        doPrint(row, qr)
      }
    } catch { setError('Failed to load QR for printing') }
  }

  const resetDailyOrderNumber = async () => {
    if (!window.confirm('Reset last order number to 0 so the next order starts at #1? Use this at the start of a new day.')) return
    setResettingSequence(true); setError('')
    try {
      await resetOrderSequence(0)
      await load()
    } catch (e) {
      setError(e.message || 'Failed to reset order number')
    } finally {
      setResettingSequence(false)
    }
  }

  const openOrders = (row) => {
    setSelectedOrderIds([])
    setOrdersDialog({ table: row, orders: (row.orders || []).filter(order => order.status !== 'COMPLETED') })
  }

  const completeSelectedOrders = async () => {
    if (!ordersDialog) return
    const selected = ordersDialog.orders.filter(order => selectedOrderIds.includes(order.id) && isCompletableOrder(order))
    if (!selected.length) {
      setError('Select at least one Ready order to complete')
      return
    }
    if (!window.confirm(`Complete ${selected.length} selected order${selected.length > 1 ? 's' : ''} for ${ordersDialog.table.tableName}?`)) return
    setCompletingSelected(true)
    try {
      await Promise.all(selected.map(order => completeShopOrder(order.id)))
      const completedIds = new Set(selected.map(order => order.id))
      const now = new Date().toISOString()
      setOrdersDialog(prev => prev ? {
        ...prev,
        orders: prev.orders.map(order => completedIds.has(order.id)
          ? { ...order, status: 'COMPLETED', paymentStatus: 'PAID', completedAt: now }
          : order),
      } : prev)
      setSelectedOrderIds([])
      await load()
    } catch (e) {
      setError(e.message || 'Failed to complete selected orders')
    } finally {
      setCompletingSelected(false)
    }
  }

  const selectedReadyCount = (ordersDialog?.orders || [])
    .filter(order => selectedOrderIds.includes(order.id) && isCompletableOrder(order)).length
  const selectedOrderModel = React.useMemo(() => makeSelectionModel(selectedOrderIds), [selectedOrderIds])

  const columns = [
    {
      field: 'tableName', headerName: 'Table', width: 130,
      renderCell: ({ value, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <TableBarIcon sx={{ fontSize: 16, color: row.activeOrderCount ? '#0277bd' : '#bdbdbd', flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={row.activeOrderCount ? 800 : 500} noWrap>{value}</Typography>
        </Box>
      ),
    },
    {
      field: 'activeOrderCount', headerName: 'Open', width: 80,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color="primary" sx={{ fontWeight: 800 }} />
        : <Chip label="Free" size="small" variant="outlined" sx={{ color: '#78909c', borderColor: '#cfd8dc' }} />,
    },
    {
      field: 'activeOrders', headerName: 'Open Orders', flex: 1, minWidth: 230,
      renderCell: ({ value }) => {
        const list = value || []
        if (!list.length) return <Typography variant="caption" color="text.disabled">No open orders</Typography>
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', overflow: 'hidden' }}>
            {list.slice(0, 3).map(order => (
              <Chip key={order.id} label={`${orderLabel(order)} ${order.status}`} size="small" variant="outlined" sx={{ maxWidth: 110, fontWeight: 700 }} />
            ))}
            {list.length > 3 && <Typography variant="caption" color="text.secondary">+{list.length - 3}</Typography>}
          </Box>
        )
      },
    },
    {
      field: 'latestOrder', headerName: 'Last Order', width: 125,
      valueGetter: (_, row) => row.orders?.[0] || null,
      renderCell: ({ row }) => {
        const order = row.orders?.[0]
        return order ? <Typography variant="caption" fontWeight={800}>{orderLabel(order)}</Typography> : null
      },
    },
    {
      field: 'orderCount', headerName: 'All Orders', width: 90,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{value || 0}</Typography>,
    },
    {
      field: 'isActive', headerName: 'Active', width: 80,
      renderCell: ({ value }) => <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" />,
    },
    {
      field: 'actions', headerName: 'Actions', width: 360, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Button
            size="small" variant="contained" color="primary"
            startIcon={<VisibilityIcon />}
            onClick={() => openOrders(row)}
            sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11, px: 1 }}
          >
            Orders
          </Button>
          <Tooltip title="New order for this table">
            <Button
              size="small" variant="outlined" color="primary"
              startIcon={<NoteAddIcon />}
              onClick={() => setNewOrderTable(row)}
              sx={{ textTransform: 'none', fontSize: 11, px: 1 }}
            >
              Order
            </Button>
          </Tooltip>
          <Tooltip title="QR Code"><IconButton size="small" onClick={() => handleQr(row)}><QrCode2Icon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print QR"><IconButton size="small" onClick={() => handlePrint(row)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditTable(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      )
    }
  ]

  const orderColumns = [
    {
      field: 'orderNumber', headerName: 'Order', width: 95,
      renderCell: ({ row }) => <Typography fontWeight={900}>{orderLabel(row)}</Typography>,
    },
    {
      field: 'status', headerName: 'Status', width: 125,
      renderCell: ({ value }) => statusChip(value),
    },
    {
      field: 'createdAt', headerName: 'Created', width: 150,
      renderCell: ({ value }) => <Typography variant="caption">{dateFmt(value)}</Typography>,
    },
    {
      field: 'customerName', headerName: 'Customer', minWidth: 130, flex: 1,
      renderCell: ({ value }) => <Typography variant="caption" noWrap>{value || '-'}</Typography>,
    },
    {
      field: 'items', headerName: 'Items', width: 70,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{Array.isArray(value) ? value.length : 0}</Typography>,
    },
    {
      field: 'totalAmount', headerName: 'Total', width: 120,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{fmtMoney(value)}</Typography>,
    },
    {
      field: 'paymentStatus', headerName: 'Payment', width: 105,
      renderCell: ({ value }) => <Chip label={value || '-'} size="small" color={value === 'PAID' ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'view', headerName: '', width: 70, sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="View order">
          <IconButton size="small" onClick={() => setDetailOrder(row)}><VisibilityIcon fontSize="small" /></IconButton>
        </Tooltip>
      ),
    },
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setEditTable({})}>New Table</Button>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
        <Button startIcon={resettingSequence ? <CircularProgress size={14} /> : <RestartAltIcon />} onClick={resetDailyOrderNumber} variant="outlined" color="warning" size="small" disabled={resettingSequence}>Reset Order #</Button>
        <Button startIcon={showTableList ? <VisibilityOffIcon /> : <VisibilityIcon />} onClick={() => setShowTableList(v => !v)} variant={showTableList ? "outlined" : "contained"} size="small">{showTableList ? "Hide Table List" : "Show Table List"}</Button>
      </Box>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <ShopTableLayoutDesigner tables={rows} expanded={!showTableList} />
      {showTableList && (
      <Box sx={{ flex: 1, minHeight: 300 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={r => r.id}
          pageSizeOptions={[25, 50]}
          density="compact"
          getRowClassName={({ row }) => row.activeOrderCount ? 'occupied-row' : ''}
          sx={{
            '& .occupied-row': { bgcolor: '#e3f2fd' },
            '& .occupied-row:hover': { bgcolor: '#bbdefb !important' },
          }}
        />
      </Box>
      )}

      {editTable !== null && (
        <ShopTableEditModal
          open
          table={editTable.id ? editTable : null}
          onClose={() => setEditTable(null)}
          onSaved={() => { setEditTable(null); load() }}
        />
      )}

      {newOrderTable && (
        <ManualOrderDialog
          open
          defaultTable={newOrderTable}
          onClose={() => setNewOrderTable(null)}
          onCreated={() => { setNewOrderTable(null); load() }}
        />
      )}

      <Dialog open={!!ordersDialog} onClose={() => setOrdersDialog(null)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TableBarIcon color="primary" />
          <Typography component="span" fontWeight={900}>{ordersDialog?.table?.tableName}</Typography>
          <Chip label={`${ordersDialog?.orders?.length || 0} orders`} size="small" />
          <Chip label={`${(ordersDialog?.orders || []).filter(isActiveOrder).length} open`} size="small" color="primary" variant="outlined" />
        </DialogTitle>
        <DialogContent sx={{ height: 520 }}>
          <DataGrid
            rows={ordersDialog?.orders || []}
            columns={orderColumns}
            getRowId={row => row.id}
            checkboxSelection
            disableRowSelectionOnClick
            isRowSelectable={({ row }) => isCompletableOrder(row)}
            rowSelectionModel={selectedOrderModel}
            onRowSelectionModelChange={model => setSelectedOrderIds(selectionIds(model))}
            pageSizeOptions={[10, 25, 50]}
            density="compact"
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Only Ready orders can be selected for completion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrdersDialog(null)}>Close</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={completingSelected ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
            disabled={!selectedReadyCount || completingSelected}
            onClick={completeSelectedOrders}
          >
            Complete Selected{selectedReadyCount ? ` (${selectedReadyCount})` : ''}
          </Button>
        </DialogActions>
      </Dialog>

      <ShopOrderDetailModal
        open={!!detailOrder}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onRefresh={() => { setDetailOrder(null); load() }}
      />

      <Dialog open={!!qrDialog} onClose={() => setQrDialog(null)}>
        <DialogTitle>QR Code - {qrDialog?.table?.tableName}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', minWidth: 320 }}>
          {qrDialog?.activeOrderCount > 0 && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, textAlign: 'left' }}>
              <strong>Table not clear</strong> - {qrDialog.activeOrderCount} active order{qrDialog.activeOrderCount > 1 ? 's' : ''} still in progress.
              A new session has been started. Clear the table when those orders are done.
            </Alert>
          )}
          {qrDialog?.qrBase64 ? (
            <>
              <img src={`data:image/png;base64,${qrDialog.qrBase64}`} alt="Table QR" style={{ width: 280, height: 280 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>New session - customers scan to order</Typography>
            </>
          ) : <CircularProgress sx={{ my: 4 }} />}
        </DialogContent>
        <DialogActions>
          {qrDialog?.table && (
              <Button color="warning" onClick={() => handleQr(qrDialog.table, true)}>Regenerate</Button>
          )}
          {qrDialog?.qrBase64 && (
            <Button onClick={() => {
              const a = document.createElement('a')
              a.href = `data:image/png;base64,${qrDialog.qrBase64}`
              a.download = `table-${qrDialog.table?.tableName || 'qr'}.png`
              a.click()
            }}>Download</Button>
          )}
          <Button onClick={() => setQrDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!printConfirm} onClose={() => setPrintConfirm(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" /> Table not clear
        </DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{printConfirm?.row?.tableName}</strong> has{' '}
            <strong>{printConfirm?.activeOrderCount}</strong> active order{printConfirm?.activeOrderCount > 1 ? 's' : ''} that
            have not been cleared yet.
          </Typography>
          <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>
            Printing a new QR will start a fresh ordering session. Print anyway?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="warning"
            onClick={() => { doPrint(printConfirm.row, printConfirm.qrBase64); setPrintConfirm(null) }}>
            Print Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
