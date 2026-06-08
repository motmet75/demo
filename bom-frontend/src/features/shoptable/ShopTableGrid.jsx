import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import TableBarIcon from '@mui/icons-material/TableBar'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import {
  fetchShopTables, deleteShopTable, fetchTableQr, fetchActiveOrders,
  completeShopOrder, pickupShopOrder
} from '../../api/shopApi'
import ShopTableEditModal from './ShopTableEditModal'
import ManualOrderDialog from '../shoporder/ManualOrderDialog'

const STATUS_CHIP = {
  PENDING:   { label: 'Placed',     color: 'default' },
  CONFIRMED: { label: 'Confirmed',  color: 'success' },
  PREPARING: { label: 'Preparing',  color: 'warning' },
  READY:     { label: 'Ready ✓',   color: 'info'    },
}

export default function ShopTableGrid() {
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [editTable, setEditTable]   = useState(null)
  const [qrDialog, setQrDialog]     = useState(null)
  const [qrBase64, setQrBase64]     = useState('')
  const [newOrderTable, setNewOrderTable] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tablesRes, ordersRes] = await Promise.all([fetchShopTables(), fetchActiveOrders()])
      const tables = Array.isArray(tablesRes.data) ? tablesRes.data : []
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
      const byTable = {}
      orders.forEach(o => { if (o.tableId) byTable[o.tableId] = o })
      setRows(tables.map(t => ({ ...t, activeOrder: byTable[t.id] || null })))
    } catch { setError('Failed to load tables') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table?')) return
    try { await deleteShopTable(id); load() } catch (e) { setError(e.message || 'Delete failed') }
  }

  const handleQr = async (row) => {
    setQrDialog(row); setQrBase64('')
    try {
      const { data } = await fetchTableQr(row.id)
      setQrBase64(data?.qrBase64 || '')
    } catch { setError('Failed to load QR') }
  }

  const handlePrint = async (row) => {
    try {
      const { data } = await fetchTableQr(row.id)
      const qr = data?.qrBase64 || ''
      const win = window.open('', '_blank', 'width=500,height=600')
      win.document.write(`<!DOCTYPE html><html><head>
        <title>Table QR — ${row.tableName}</title>
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
    } catch { setError('Failed to load QR for printing') }
  }

  const handleClearTable = async (row) => {
    const order = row.activeOrder
    if (!order) return
    if (!window.confirm(`Mark order #${order.orderNumber || order.orderCode} on ${row.tableName} as complete?`)) return
    try {
      if (order.paymentMethod === 'BANK_QR') await pickupShopOrder(order.id)
      else await completeShopOrder(order.id)
      load()
    } catch (e) { setError(e.message || 'Failed to clear table') }
  }

  const columns = [
    {
      field: 'tableName', headerName: 'Table', width: 120,
      renderCell: ({ value, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableBarIcon sx={{ fontSize: 16, color: row.activeOrder ? '#0277bd' : '#bdbdbd' }} />
          <Typography variant="body2" fontWeight={row.activeOrder ? 700 : 400}>{value}</Typography>
        </Box>
      ),
    },
    {
      field: 'activeOrder', headerName: 'Order #', width: 80,
      renderCell: ({ value }) => {
        if (!value) return <Typography variant="caption" color="text.disabled">—</Typography>
        return (
          <Box sx={{
            width: 40, height: 40, borderRadius: '50%', bgcolor: '#1976d2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>
              {value.orderNumber ?? '?'}
            </Typography>
          </Box>
        )
      },
    },
    {
      field: 'orderCode', headerName: 'Code', width: 130,
      renderCell: ({ row }) => {
        const o = row.activeOrder
        if (!o) return null
        return (
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, letterSpacing: 0.5, color: '#37474f' }}>
            {o.orderCode}
          </Typography>
        )
      },
    },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: ({ row }) => {
        const o = row.activeOrder
        if (!o) return <Chip label="Free" size="small" variant="outlined" sx={{ color: '#9e9e9e', borderColor: '#e0e0e0' }} />
        const chip = STATUS_CHIP[o.status] || { label: o.status, color: 'default' }
        return <Chip label={chip.label} size="small" color={chip.color} sx={{ fontWeight: 600 }} />
      },
    },
    {
      field: 'orderTotal', headerName: 'Total', width: 110,
      renderCell: ({ row }) => {
        const o = row.activeOrder
        if (!o) return null
        return (
          <Typography variant="caption" fontWeight={700} color="primary">
            {o.totalAmount ? Number(o.totalAmount).toLocaleString('vi-VN') + ' đ' : '—'}
          </Typography>
        )
      },
    },
    { field: 'isActive', headerName: 'Active', width: 70,
      renderCell: ({ value }) => <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" />,
    },
    {
      field: 'actions', headerName: 'Actions', width: 260, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          {row.activeOrder ? (
            <Tooltip title="Clear table (complete order)">
              <Button
                size="small" variant="contained" color="success"
                startIcon={<CheckCircleOutlineIcon />}
                onClick={() => handleClearTable(row)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, px: 1 }}
              >
                Clear
              </Button>
            </Tooltip>
          ) : (
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
          )}
          <Tooltip title="QR Code"><IconButton size="small" onClick={() => handleQr(row)}><QrCode2Icon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print QR"><IconButton size="small" onClick={() => handlePrint(row)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditTable(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      )
    }
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setEditTable({})}>New Table</Button>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
      </Box>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ flex: 1, minHeight: 300 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={r => r.id}
          pageSizeOptions={[25]}
          density="compact"
          getRowClassName={({ row }) => row.activeOrder ? 'occupied-row' : ''}
          sx={{
            '& .occupied-row': { bgcolor: '#e3f2fd' },
            '& .occupied-row:hover': { bgcolor: '#bbdefb !important' },
          }}
        />
      </Box>

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

      <Dialog open={!!qrDialog} onClose={() => setQrDialog(null)}>
        <DialogTitle>QR Code — {qrDialog?.tableName}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          {qrBase64 ? (
            <>
              <img src={`data:image/png;base64,${qrBase64}`} alt="Table QR" style={{ width: 280, height: 280 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Customers scan this to view the menu</Typography>
            </>
          ) : <Typography>Loading...</Typography>}
        </DialogContent>
        <DialogActions>
          {qrBase64 && (
            <Button onClick={() => {
              const a = document.createElement('a'); a.href = `data:image/png;base64,${qrBase64}`
              a.download = `table-${qrDialog?.tableName || 'qr'}.png`; a.click()
            }}>Download</Button>
          )}
          <Button onClick={() => setQrDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
