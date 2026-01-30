import React, { useCallback, useEffect, useState } from 'react'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/supplierApi'
import SupplierEditModal from './SupplierEditModal'
import { useAppContext } from '../../context/AppContext'

export default function SupplierGrid() {
  const { tenantId, companyId } = useAppContext()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [modalKey, setModalKey] = useState(0)

  // grid height controls
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('suppliers_manual_height')
      return v === null ? false : v === 'true'
    } catch (e) { return false }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('suppliers_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch (e) { return 520 }
  })

  useEffect(() => {
    try {
      localStorage.setItem('suppliers_manual_height', String(manualHeight))
      localStorage.setItem('suppliers_grid_height', String(gridHeight))
    } catch (e) { /* ignore */ }
  }, [manualHeight, gridHeight])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSuppliers({ tenantId, companyId })
      if (Array.isArray(data)) {
        setRows(data.map(r => ({
          id: r.id != null ? String(r.id) : '',
          uuid: r.id != null ? String(r.id) : '',
          code: r.code ?? r.supplierCode ?? '',
          name: r.name ?? r.supplierName ?? '',
          contactName: r.contactName ?? '',
          phone: r.phone ?? '',
          email: r.email ?? '',
          __raw: r
        })))
      } else {
        setRows([])
      }
    } catch {
      console.error('Failed to load suppliers')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, companyId])

  useEffect(() => { load() }, [load])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }

  const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`

  const handleSave = async (payload) => {
    if (saving) return

    // require tenant and company context
    if (!tenantId || !companyId) {
      const msg = 'Please select Tenant and Company before saving a supplier.'
      console.warn(msg)
      alert(msg)
      throw new Error(msg)
    }

    setSaving(true)
    try {
      let res
      if (payload.id) {
        res = await updateSupplier(payload.id, payload, { tenantId, companyId })
      } else {
        res = await createSupplier(payload, { tenantId, companyId })
      }

      const generatedId = (res && res.id) ? String(res.id) : (payload.id ? String(payload.id) : makeTempId())

      const newRow = {
        id: generatedId,
        uuid: generatedId,
        code: res && (res.code || res.supplierCode) ? (res.code || res.supplierCode) : payload.code,
        name: res && (res.name || res.supplierName) ? (res.name || res.supplierName) : payload.name,
        contactName: res && (res.contactName) ? res.contactName : payload.contactName,
        phone: res && res.phone ? res.phone : payload.phone,
        email: res && res.email ? res.email : payload.email
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
    if (!window.confirm('Delete this supplier?')) return
    setDeletingId(id)
    try {
      await deleteSupplier(id, { tenantId, companyId })
      setRows(prev => prev.filter(r => r.id !== id))
      alert('Supplier deleted')
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
    { field: 'contactName', headerName: 'Contact', width: 200 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'email', headerName: 'Email', width: 200 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 140, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => handleDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
    ] }
  ]

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Suppliers</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Supplier</button>
        </div>
      </div>

      {/* Height control: toggle auto/manual and slider/number for manual px height */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!manualHeight} onChange={(e) => setManualHeight(!e.target.checked)} /> Auto height
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>Manual height (px):</span>
            <input
              type="range"
              min={200}
              max={1200}
              step={10}
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value))}
              disabled={!manualHeight}
            />
            <input
              type="number"
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value || 0))}
              disabled={!manualHeight}
              style={{ width: 80 }}
            />
          </label>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} checkboxSelection={false} sx={{ height: '100%' }} />
        </div>
      </div>

      <SupplierEditModal key={modalKey} open={editOpen} supplier={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}