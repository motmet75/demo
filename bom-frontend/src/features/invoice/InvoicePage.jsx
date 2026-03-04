import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAppContext } from '../../context/AppContext'
import { fetchInvoices, createInvoice, updateInvoice, deleteInvoice } from '../../api/invoiceApi'

const TYPE_COLOR = { PURCHASE: 'info', SALE: 'success' }
const STATUS_COLOR = { DRAFT: 'default', ISSUED: 'primary', PAID: 'success', CANCELLED: 'error' }
const INVOICE_TYPES = ['', 'PURCHASE', 'SALE']
const STATUSES = ['', 'DRAFT', 'ISSUED', 'PAID', 'CANCELLED']

const EMPTY_FORM = {
  invoiceType: 'PURCHASE', invoiceNumber: '', partyName: '', invoiceDate: '', dueDate: '',
  currency: 'USD', subtotal: '', taxAmount: '', totalAmount: '', status: 'DRAFT', notes: ''
}

export default function InvoicePage() {
  const { tenantId, companyId } = useAppContext()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalRows, setTotalRows] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [pagination, setPagination] = useState({ page: 0, pageSize: 20 })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      const result = await fetchInvoices(
        { invoiceType: filterType || undefined, status: filterStatus || undefined,
          page: pagination.page, size: pagination.pageSize },
        { tenantId, companyId })
      setRows((result.content || []).map(r => ({ ...r, id: r.id })))
      setTotalRows(result.totalElements || 0)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tenantId, companyId, filterType, filterStatus, pagination.page, pagination.pageSize])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditRow(null); setForm(EMPTY_FORM); setDialogOpen(true) }
  const openEdit = (row) => {
    setEditRow(row)
    setForm({
      invoiceType: row.invoiceType || 'PURCHASE',
      invoiceNumber: row.invoiceNumber || '',
      partyName: row.partyName || '',
      invoiceDate: row.invoiceDate || '',
      dueDate: row.dueDate || '',
      currency: row.currency || 'USD',
      subtotal: row.subtotal ?? '',
      taxAmount: row.taxAmount ?? '',
      totalAmount: row.totalAmount ?? '',
      status: row.status || 'DRAFT',
      notes: row.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        subtotal: form.subtotal !== '' ? Number(form.subtotal) : 0,
        taxAmount: form.taxAmount !== '' ? Number(form.taxAmount) : 0,
        totalAmount: form.totalAmount !== '' ? Number(form.totalAmount) : 0,
      }
      if (editRow) {
        const updated = await updateInvoice(editRow.id, payload, { tenantId, companyId })
        setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, id: updated.id } : r))
      } else {
        const created = await createInvoice(payload, { tenantId, companyId })
        setRows(prev => [{ ...created, id: created.id }, ...prev])
        setTotalRows(t => t + 1)
      }
      setDialogOpen(false)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return
    try {
      await deleteInvoice(id, { tenantId, companyId })
      setRows(prev => prev.filter(r => r.id !== id))
      setTotalRows(t => t - 1)
    } catch (e) { setError(e.message) }
  }

  const columns = [
    { field: 'invoiceNumber', headerName: 'Invoice #', width: 160, renderCell: ({ value }) =>
      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</span> },
    { field: 'invoiceType', headerName: 'Type', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={TYPE_COLOR[value] || 'default'} /> },
    { field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} variant="outlined" /> },
    { field: 'partyName', headerName: 'Party', width: 180 },
    { field: 'invoiceDate', headerName: 'Date', width: 120 },
    { field: 'dueDate',     headerName: 'Due',  width: 120 },
    { field: 'currency',    headerName: 'CCY',  width: 70 },
    { field: 'subtotal',    headerName: 'Subtotal',    width: 120, type: 'number',
      valueFormatter: v => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '' },
    { field: 'taxAmount',   headerName: 'Tax',         width: 100, type: 'number',
      valueFormatter: v => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '' },
    { field: 'totalAmount', headerName: 'Total',       width: 130, type: 'number',
      valueFormatter: v => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '' },
    { field: 'notes', headerName: 'Notes', flex: 1 },
    { field: '_actions', headerName: '', width: 100, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      )}
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Invoices</Typography>
        <TextField select label="Type" value={filterType} onChange={e => setFilterType(e.target.value)}
          size="small" sx={{ minWidth: 130 }}>
          {INVOICE_TYPES.map(t => <MenuItem key={t} value={t}>{t || 'All Types'}</MenuItem>)}
        </TextField>
        <TextField select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          size="small" sx={{ minWidth: 130 }}>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
        </TextField>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
          disabled={!tenantId || !companyId}>New Invoice</Button>
      </Box>

      {(!tenantId || !companyId) && <Alert severity="warning" sx={{ mb: 2 }}>Select Tenant and Company to manage invoices.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataGrid rows={rows} columns={columns} loading={loading}
        rowCount={totalRows} paginationMode="server"
        paginationModel={pagination} onPaginationModelChange={setPagination}
        pageSizeOptions={[10, 20, 50]} disableRowSelectionOnClick autoHeight
        sx={{ background: '#fff', borderRadius: 2 }} />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? 'Edit Invoice' : 'New Invoice'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField select label="Type" value={form.invoiceType}
              onChange={e => setForm(f => ({ ...f, invoiceType: e.target.value }))}
              size="small" sx={{ flex: 1 }} disabled={!!editRow}>
              <MenuItem value="PURCHASE">PURCHASE</MenuItem>
              <MenuItem value="SALE">SALE</MenuItem>
            </TextField>
            <TextField select label="Status" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))} size="small" sx={{ flex: 1 }}>
              {STATUSES.filter(Boolean).map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Box>
          <TextField label="Invoice Number *" value={form.invoiceNumber} size="small"
            onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} disabled={!!editRow} />
          <TextField label="Party Name" value={form.partyName} size="small"
            onChange={e => setForm(f => ({ ...f, partyName: e.target.value }))} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Invoice Date" type="date" value={form.invoiceDate} size="small"
              InputLabelProps={{ shrink: true }} sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
            <TextField label="Due Date" type="date" value={form.dueDate} size="small"
              InputLabelProps={{ shrink: true }} sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Currency" value={form.currency} size="small" sx={{ width: 80 }}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
            <TextField label="Subtotal" type="number" value={form.subtotal} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
            <TextField label="Tax" type="number" value={form.taxAmount} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, taxAmount: e.target.value }))} />
            <TextField label="Total" type="number" value={form.totalAmount} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} />
          </Box>
          <TextField label="Notes" value={form.notes} size="small" multiline rows={2}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.invoiceNumber}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
