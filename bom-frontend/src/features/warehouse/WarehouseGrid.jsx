import React, { useCallback, useEffect, useState } from 'react'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../../api/warehouseApi'
import WarehouseEditModal from './WarehouseEditModal'

export default function WarehouseGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [modalKey, setModalKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWarehouses()
      if (Array.isArray(data)) {
        setRows(data.map(r => ({
          // ensure id and uuid are strings for DataGrid and downstream logic
          id: r.id != null ? String(r.id) : '',
          uuid: r.id != null ? String(r.id) : '',
          code: (r.code ?? r.warehouseCode ?? r.warehouseCode) || '',
          name: (r.name ?? r.warehouseName ?? r.warehouseName) || '',
          location: r.location ?? '',
          isActive: (r.isActive !== undefined ? r.isActive : (r.active !== undefined ? r.active : true)),
          __raw: r
        })))
      } else {
        setRows([])
      }
    } catch (e) {
      console.error('Failed to load warehouses', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }

  const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`

  const handleSave = async (payload) => {
    if (saving) return
    setSaving(true)
    try {
      let res
      if (payload.id) {
        res = await updateWarehouse(payload.id, payload)
      } else {
        res = await createWarehouse(payload)
      }

      const generatedId = (res && res.id) ? String(res.id) : (payload.id ? String(payload.id) : makeTempId())

      const newRow = {
        id: generatedId,
        uuid: generatedId,
        code: res && (res.code || res.code) ? (res.code || res.code) : payload.code,
        name: res && (res.name || res.name) ? (res.name || res.name) : payload.name,
        location: res && res.location ? res.location : payload.location,
        // avoid mixing logical operators with '??' — use a simple conditional for clarity
        isActive: (res && res.isActive !== undefined) ? res.isActive : payload.isActive
      }

      setRows(prev => {
        const exists = prev.some(r => r.id === newRow.id)
        if (exists) return prev.map(r => (r.id === newRow.id ? newRow : r))
        return [newRow, ...prev]
      })

      setEditOpen(false)
      return newRow
    } catch (err) {
      console.error('Save failed', err)
      alert(err.message || 'Save failed')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (deletingId) return
    if (!window.confirm('Delete this warehouse?')) return
    setDeletingId(id)
    try {
      await deleteWarehouse(id)
      setRows(prev => prev.filter(r => r.id !== id))
      alert('Warehouse deleted')
    } catch (err) {
      console.error('Delete failed', err)
      alert(err.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const columns = [
    { field: 'uuid', headerName: 'UUID', width: 220, hide: true },
    { field: 'code', headerName: 'Code', width: 150 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'location', headerName: 'Location', width: 200 },
    { field: 'isActive', headerName: 'Active', width: 100 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 140, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => handleDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
    ] }
  ]

  return (
    <div style={{ height: 520, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Warehouses</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Warehouse</button>
        </div>
      </div>
      <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} checkboxSelection={false} />

      <WarehouseEditModal key={modalKey} open={editOpen} warehouse={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}