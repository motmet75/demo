import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { useAppContext } from '../../context/AppContext'
import { fetchMovements, recordMovementIn, recordMovementOut, recordMovementTransfer, recordMovementAdjustment, deleteMovement } from '../../api/inventoryMovementApi'
import { fetchMaterials } from '../../api/materialApi'
import { fetchWarehouses } from '../../api/warehouseApi'

const MOVEMENT_TYPES = ['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'IMPORT', 'IMPORT_UPDATE']
const TYPE_COLORS = { IN: 'success', OUT: 'error', TRANSFER: 'info', ADJUSTMENT: 'warning', IMPORT: 'default', IMPORT_UPDATE: 'default' }

const EMPTY_FORM = {
  movementType: 'IN',
  materialId: '',
  fromWarehouseId: '',
  toWarehouseId: '',
  warehouseId: '',
  quantity: '',
  unit: 'pcs',
  batchNo: '',
  reason: '',
  createdBy: 'system',
  notes: ''
}

export default function InventoryMovementPage() {
  const { tenantId, companyId } = useAppContext()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('')
  const [paginationModel, setPaginationModel] = useState({ pageSize: 25, page: 0 })

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true)
    try {
      const data = await fetchMovements({ tenantId, companyId, movementType: filterType || undefined })
      setRows(Array.isArray(data) ? data.map(r => ({ ...r, id: r.id })) : [])
    } catch (e) {
      console.error('Failed to load movements', e)
    } finally {
      setLoading(false)
    }
  }, [tenantId, companyId, filterType])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!tenantId || !companyId) return
    Promise.all([fetchMaterials(), fetchWarehouses ? fetchWarehouses() : Promise.resolve([])])
      .then(([mats, whs]) => { setMaterials(Array.isArray(mats) ? mats : []); setWarehouses(Array.isArray(whs) ? whs : []) })
      .catch(() => {})
  }, [tenantId, companyId])

  function handleChange(field) { return (e) => setForm(prev => ({ ...prev, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const opts = { tenantId, companyId }
      const qty = parseFloat(form.quantity)
      if (isNaN(qty) || qty <= 0) { setError('Quantity must be a positive number'); setSaving(false); return }
      const base = { materialId: form.materialId, quantity: qty, unit: form.unit, batchNo: form.batchNo || undefined, reason: form.reason || undefined, createdBy: form.createdBy || 'system', notes: form.notes || undefined }
      if (form.movementType === 'IN') {
        await recordMovementIn({ ...base, warehouseId: form.warehouseId }, opts)
      } else if (form.movementType === 'OUT') {
        await recordMovementOut({ ...base, warehouseId: form.warehouseId }, opts)
      } else if (form.movementType === 'TRANSFER') {
        await recordMovementTransfer({ ...base, fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId }, opts)
      } else if (form.movementType === 'ADJUSTMENT') {
        await recordMovementAdjustment({ ...base, warehouseId: form.warehouseId }, opts)
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (ex) {
      setError(ex?.message || 'Failed to record movement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this movement record?')) return
    try { await deleteMovement(id); setRows(prev => prev.filter(r => r.id !== id)) }
    catch (ex) { alert('Delete failed: ' + (ex?.message || ex)) }
  }

  const matMap = Object.fromEntries(materials.map(m => [m.id, m]))
  const whMap = Object.fromEntries(warehouses.map(w => [w.id, w]))

  const columns = [
    { field: 'createdAt', headerName: 'Date', width: 170, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '' },
    { field: 'movementType', headerName: 'Type', width: 130, renderCell: ({ value }) => <Chip label={value} color={TYPE_COLORS[value] || 'default'} size="small" /> },
    { field: 'materialId', headerName: 'Material', width: 180, valueGetter: (value, row) => row?.material ? `${row.material.materialCode ?? ''} — ${row.material.materialName ?? ''}` : (row && matMap[row.materialId] ? `${matMap[row.materialId].materialCode}` : value ?? '') },
    { field: 'fromWarehouseId', headerName: 'From WH', width: 130, valueGetter: (value, row) => row?.fromWarehouse ? row.fromWarehouse.code : (row && whMap[row.fromWarehouseId] ? whMap[row.fromWarehouseId].code : '') },
    { field: 'toWarehouseId', headerName: 'To WH', width: 130, valueGetter: (value, row) => row?.toWarehouse ? row.toWarehouse.code : (row && whMap[row.toWarehouseId] ? whMap[row.toWarehouseId].code : '') },
    { field: 'quantity', headerName: 'Qty', width: 100, type: 'number' },
    { field: 'unit', headerName: 'Unit', width: 80 },
    { field: 'batchNo', headerName: 'Batch', width: 120 },
    { field: 'reason', headerName: 'Reason', width: 150 },
    { field: 'referenceType', headerName: 'Ref Type', width: 120 },
    {
      field: 'referenceId', headerName: 'Ref ID', width: 300,
      valueGetter: (value) => value ? String(value) : '',
      renderCell: ({ value }) => value
        ? <span title={value} style={{ fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' }} onClick={() => navigator.clipboard?.writeText(value)}>{value}</span>
        : ''
    },
    { field: 'status', headerName: 'Status', width: 110 },
    { field: 'createdBy', headerName: 'By', width: 100 },
    { field: 'notes', headerName: 'Notes', flex: 1 },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => row.movementType !== 'IMPORT' && row.movementType !== 'IMPORT_UPDATE' ? <Button size="small" color="error" onClick={() => handleDelete(row.id)}>Del</Button> : null }
  ]

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h2 style={{ margin: 0 }}>Inventory Movements</h2>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField select label="Filter by type" value={filterType} onChange={e => setFilterType(e.target.value)} size="small" sx={{ width: 160 }}>
            <MenuItem value="">All Types</MenuItem>
            {MOVEMENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={() => { setForm(EMPTY_FORM); setError(''); setDialogOpen(true) }}>+ Record Movement</Button>
        </Box>
      </Box>

      <Box sx={{ height: 600 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[25, 50, 100]} paginationModel={paginationModel} onPaginationModelChange={setPaginationModel} density="compact" />
      </Box>

      {/* Record Movement Dialog */}
      <Dialog open={dialogOpen} onClose={saving ? undefined : () => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Record Inventory Movement</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField select label="Movement Type" value={form.movementType} onChange={handleChange('movementType')} required disabled={saving} size="small">
              {['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>

            <TextField select label="Material" value={form.materialId} onChange={handleChange('materialId')} required disabled={saving} size="small">
              {materials.map(m => <MenuItem key={m.id} value={m.id}>{m.materialCode} — {m.materialName}</MenuItem>)}
            </TextField>

            {(form.movementType === 'IN' || form.movementType === 'OUT' || form.movementType === 'ADJUSTMENT') && (
              <TextField select label="Warehouse" value={form.warehouseId} onChange={handleChange('warehouseId')} required disabled={saving} size="small">
                {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.code} — {w.name}</MenuItem>)}
              </TextField>
            )}

            {form.movementType === 'TRANSFER' && (<>
              <TextField select label="From Warehouse" value={form.fromWarehouseId} onChange={handleChange('fromWarehouseId')} required disabled={saving} size="small">
                {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.code} — {w.name}</MenuItem>)}
              </TextField>
              <TextField select label="To Warehouse" value={form.toWarehouseId} onChange={handleChange('toWarehouseId')} required disabled={saving} size="small">
                {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.code} — {w.name}</MenuItem>)}
              </TextField>
            </>)}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Quantity" value={form.quantity} onChange={handleChange('quantity')} required disabled={saving} size="small" type="number" inputProps={{ step: 'any', min: 0 }} sx={{ flex: 1 }} />
              <TextField label="Unit" value={form.unit} onChange={handleChange('unit')} disabled={saving} size="small" sx={{ width: 90 }} />
            </Box>
            <TextField label="Batch No" value={form.batchNo} onChange={handleChange('batchNo')} disabled={saving} size="small" />
            <TextField label="Reason" value={form.reason} onChange={handleChange('reason')} disabled={saving} size="small" />
            <TextField label="Created By" value={form.createdBy} onChange={handleChange('createdBy')} disabled={saving} size="small" />
            <TextField label="Notes" value={form.notes} onChange={handleChange('notes')} disabled={saving} size="small" multiline rows={2} />

            {error && <Box sx={{ color: 'error.main', fontSize: 13 }}>{error}</Box>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={18} /> : 'Record'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
