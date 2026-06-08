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
import { fetchShopTables, deleteShopTable, fetchTableQr } from '../../api/shopApi'
import ShopTableEditModal from './ShopTableEditModal'

export default function ShopTableGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editTable, setEditTable] = useState(null)
  const [qrDialog, setQrDialog] = useState(null)
  const [qrBase64, setQrBase64] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchShopTables()
      setRows(Array.isArray(data) ? data : [])
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

  const columns = [
    { field: 'tableName', headerName: 'Table Name', flex: 1 },
    { field: 'isActive', headerName: 'Active', width: 80, renderCell: ({ value }) => <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" /> },
    {
      field: 'actions', headerName: 'Actions', width: 160, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
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
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ flex: 1, minHeight: 300 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id} pageSizeOptions={[25]} density="compact" />
      </Box>

      {editTable !== null && (
        <ShopTableEditModal open table={editTable.id ? editTable : null} onClose={() => setEditTable(null)} onSaved={() => { setEditTable(null); load() }} />
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
