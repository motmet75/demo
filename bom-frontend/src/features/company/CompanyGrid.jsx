import React, { useCallback, useEffect, useState } from 'react'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '../../api/companyApi'
import CompanyEditModal from './CompanyEditModal'
import { useAppContext } from '../../context/AppContext'

export default function CompanyGrid() {
  const { tenantId } = useAppContext()
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
      if (!tenantId) {
        // no tenant selected -> nothing to show
        setRows([])
        return
      }
      const data = await getCompanies(tenantId)
      if (Array.isArray(data)) {
        setRows(data.map(r => ({ id: r.id != null ? String(r.id) : '', uuid: r.id != null ? String(r.id) : '', code: r.companyCode ?? r.code ?? '', name: r.companyName ?? r.name ?? '', __raw: r })))
      } else {
        setRows([])
      }
    } catch (err) {
      console.error('Failed to load companies', err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }

  const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2,9)}`

  const handleSave = async (payload) => {
    if (saving) return
    setSaving(true)
    try {
      // ensure tenantId is included for company creation when available
      if (!payload.tenantId && tenantId) payload.tenantId = tenantId

      let res
      if (payload.id) {
        res = await updateCompany(payload.id, payload)
      } else {
        res = await createCompany(payload)
      }

      const generatedId = (res && res.id) ? String(res.id) : (payload.id ? String(payload.id) : makeTempId())

      const newRow = {
        id: generatedId,
        uuid: generatedId,
        code: res && (res.companyCode || res.code) ? (res.companyCode || res.code) : payload.code,
        name: res && (res.companyName || res.name) ? (res.companyName || res.name) : payload.name
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
    if (!window.confirm('Delete this company?')) return
    setDeletingId(id)
    try {
      await deleteCompany(id)
      setRows(prev => prev.filter(r => r.id !== id))
      alert('Company deleted')
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
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 140, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => handleDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
    ] }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Companies</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Company</button>
        </div>
      </div>

      <div style={{ padding: '0 8px 8px 8px' }}>
        {/* placeholder for controls if needed */}
      </div>

      <div style={{ flex: 'none', height: 'auto', minHeight: 0 }}>
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} checkboxSelection={false} sx={{ height: '100%' }} />
        </div>
      </div>

      <CompanyEditModal key={modalKey} open={editOpen} company={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}