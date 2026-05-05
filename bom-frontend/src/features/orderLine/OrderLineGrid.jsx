import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { DataGrid, GridActionsCellItem, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import * as XLSX from 'xlsx'
import {
  fetchOrderLines,
  createOrderLine,
  updateOrderLine,
  deleteOrderLine,
} from '../../api/orderLineApi'
import OrderLineEditModal from './OrderLineEditModal'

const LINE_STATUSES = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const LINE_TYPES    = ['', 'MODEL', 'MATERIAL']

const STATUS_COLOR = {
  PENDING:     'default',
  IN_PROGRESS: 'info',
  COMPLETED:   'success',
  CANCELLED:   'error',
}
const TYPE_COLOR = {
  MODEL:    'secondary',
  MATERIAL: 'primary',
}

const numFmt = (v, dp = 4) =>
  v == null ? '' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp })

function dateFmt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? iso : d.toLocaleString()
}

export default function OrderLineGrid({ orderId }) {
  const apiRef = useGridApiRef()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [modalKey,setModalKey] = useState(0)

  const [editOpen,   setEditOpen]   = useState(false)
  const [selected,   setSelected]   = useState(null)  // null → create

  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterType,     setFilterType]     = useState('')
  const [filterText,     setFilterText]     = useState('')

  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // ── load (Adjusted for JPA ManyToOne mapping) ───────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (orderId)      params.orderId    = orderId
      if (filterStatus) params.lineStatus = filterStatus
      if (filterType)   params.lineType   = filterType
      
      const data = await fetchOrderLines(params)
      
      // We map the incoming data to extract order.id into a flat orderId field[cite: 1]
      setRows(data.map(r => ({ 
        ...r, 
        id: String(r.id),
        orderId: r.orderId ?? '' // Accessing JPA @ManyToOne relation[cite: 1]
      })))
    } catch (e) {
      console.error('Failed to load order lines', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [orderId, filterStatus, filterType])

  useEffect(() => { load() }, [load])

  // ── filtered rows ────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows
    const q = filterText.trim().toLowerCase()
    return rows.filter(r =>
      String(r.id ?? '').toLowerCase().includes(q) ||
      String(r.orderId ?? '').toLowerCase().includes(q) ||
      String(r.lineNumber ?? '').includes(q) ||
      String(r.modelId ?? '').toLowerCase().includes(q) ||
      String(r.materialId ?? '').toLowerCase().includes(q) ||
      String(r.notes ?? '').toLowerCase().includes(q)
    )
  }, [rows, filterText])

  const selectedIds = useMemo(() => {
    if (selectionModel.type === 'include') return [...selectionModel.ids]
    return filteredRows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
  }, [selectionModel, filteredRows])

  // ── open / close modal ────────────────────────────────────────────────
  function openCreate() {
    setSelected(null)
    setModalKey(k => k + 1)
    setEditOpen(true)
  }
  function openEdit(row) {
    setSelected(row)
    setModalKey(k => k + 1)
    setEditOpen(true)
  }
  function closeModal() {
    setEditOpen(false)
    setSelected(null)
  }

  // ── save (create / update) ────────────────────────────────────────────
  async function handleSave(payload, id) {
    setSaving(true)
    try {
      if (id) {
        const updated = await updateOrderLine(id, payload)
        setRows(prev => prev.map(r => r.id === id ? { ...updated, id: String(updated.id), orderId: updated.order?.id } : r))
      } else {
        const created = await createOrderLine(payload)
        setRows(prev => [...prev, { ...created, id: String(created.id), orderId: created.order?.id }])
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this order line?')) return
    try {
      await deleteOrderLine(id)
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (ex) {
      alert('Delete failed: ' + (ex?.message ?? ex))
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} order line(s)?`)) return
    const failed = []
    for (const id of selectedIds) {
      try { await deleteOrderLine(id) }
      catch (e) { failed.push(id) }
    }
    await load()
    setSelectionModel({ type: 'include', ids: new Set() })
    if (failed.length) alert(`${failed.length} deletion(s) failed.`)
  }

  // ── export (Includes id and orderId) ─────────────────────────────────
  function exportXlsx(ids) {
    const target = ids?.length ? filteredRows.filter(r => ids.includes(r.id)) : filteredRows
    const ws = XLSX.utils.json_to_sheet(target.map(r => ({
      id:               r.id,
      orderId:          r.orderId, // Flattened from r.order.id[cite: 1]
      lineNumber:       r.lineNumber,
      lineType:         r.lineType,
      lineStatus:       r.lineStatus,
      modelId:          r.modelId ?? '',
      materialId:       r.materialId ?? '',
      quantityOrdered:  r.quantityOrdered,
      quantityProduced: r.quantityProduced,
      quantityDelivered:r.quantityDelivered,
      quantityCancelled:r.quantityCancelled,
      unit:             r.unit,
      unitPrice:        r.unitPrice ?? '',
      bomCalculationId: r.bomCalculationId ?? '',
      notes:            r.notes ?? '',
      createdAt:        dateFmt(r.createdAt),
      updatedAt:        dateFmt(r.updatedAt),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'OrderLines')
    XLSX.writeFile(wb, `order_lines_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── columns ───────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 80,
      getActions: ({ row }) => [
        <GridActionsCellItem
          key="edit"
          icon={<EditIcon fontSize="small" />}
          label="Edit"
          onClick={() => openEdit(row)}
        />,
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon fontSize="small" />}
          label="Delete"
          onClick={() => handleDelete(row.id)}
          sx={{ color: 'error.main' }}
        />,
      ],
    },
    { field: 'id', headerName: 'ID', width: 220 },
    { field: 'orderId', headerName: 'Order ID', width: 220 }, // New field[cite: 1]
    { field: 'lineNumber', headerName: '#', width: 60, type: 'number' },
    {
      field: 'lineType',
      headerName: 'Type',
      width: 100,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color={TYPE_COLOR[value] ?? 'default'} sx={{ fontSize: 11, fontWeight: 700 }} />
        : null,
    },
    {
      field: 'lineStatus',
      headerName: 'Status',
      width: 120,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color={STATUS_COLOR[value] ?? 'default'} sx={{ fontSize: 11 }} />
        : null,
    },
    { field: 'modelId',           headerName: 'Model ID',          width: 260, valueFormatter: v => v ?? '' },
    { field: 'bomCalculationId',           headerName: 'BOM ID',          width: 260, valueFormatter: v => v ?? '' },
    { field: 'materialId',        headerName: 'Material ID',       width: 260, valueFormatter: v => v ?? '' },
    {
      field: 'quantityOrdered',
      headerName: 'Qty Ordered',
      width: 110,
      type: 'number',
      valueFormatter: v => numFmt(v),
    },
    {
      field: 'quantityProduced',
      headerName: 'Qty Produced',
      width: 110,
      type: 'number',
      valueFormatter: v => numFmt(v),
    },
    { field: 'unit',     headerName: 'Unit',      width: 70 },
    {
      field: 'unitPrice',
      headerName: 'Unit Price',
      width: 100,
      type: 'number',
      valueFormatter: v => numFmt(v),
    },
    { field: 'notes',            headerName: 'Notes',       width: 200 },
    {
      field: 'createdAt',
      headerName: 'Created At',
      width: 160,
      valueFormatter: v => dateFmt(v),
    },
    {
      field: 'updatedAt',
      headerName: 'Updated At',
      width: 160,
      valueFormatter: v => dateFmt(v),
    },
  ], []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: '8px 8px 4px 8px', alignItems: 'center' }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate} disabled={loading || saving}>Add Line</Button>
        <Button variant="outlined" size="small" startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
        <Button variant="outlined" size="small" onClick={() => exportXlsx(selectedIds.length > 0 ? selectedIds : null)}>⬇ XLSX{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</Button>
        <Button variant="outlined" color="error" size="small" disabled={selectedIds.length === 0} onClick={handleDeleteSelected}>Delete Selected</Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="subtitle1" fontWeight={700} sx={{ pr: 1 }}>Order Lines</Typography>
      </Box>

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 0, px: '8px', pb: '8px' }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          pageSizeOptions={[25, 50, 100]}
          density="compact"
          checkboxSelection
          apiRef={apiRef}
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          initialState={{
            columns: {
              columnVisibilityModel: {
                id: true, // Visible[cite: 1]
                orderId: true, // Visible[cite: 1]
                updatedAt: false,
              },
            },
            pinnedColumns: { left: ['actions', 'lineNumber'] },
          }}
          sx={{ height: '100%' }}
        />
      </Box>

      <OrderLineEditModal
        key={modalKey}
        open={editOpen}
        orderLine={selected ?? undefined}
        orderId={orderId}
        onClose={closeModal}
        onSave={handleSave}
        saving={saving}
      />
    </Box>
  )
}