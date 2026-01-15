import React, { useCallback, useEffect, useState } from 'react'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/supplierApi'
import SupplierEditModal from './SupplierEditModal'

export default function SupplierGrid() {
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
      const data = await fetchSuppliers()
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load suppliers', e)
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
        res = await updateSupplier(payload.id, payload)
      } else {
        res = await createSupplier(payload)
      }

      const generatedId = (res && res.id) ? String(res.id) : (payload.id ? String(payload.id) : makeTempId())

      const newRow = {
        id: generatedId,
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
      await deleteSupplier(id)
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
    <div style={{ height: 520, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Suppliers</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Supplier</button>
        </div>
      </div>
      <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} checkboxSelection={false} />

      <SupplierEditModal key={modalKey} open={editOpen} supplier={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}