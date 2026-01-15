import React, { useEffect, useState, useCallback } from 'react'
import { GridActionsCellItem, DataGrid, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchModels, createModel, updateModel, deleteModel } from '../../api/modelApi'
import ModelEditModal from './ModelEditModal'

export default function ModelGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const apiRef = useGridApiRef()

  const normalizeSelection = (sel) => {
    if (sel == null) return []
    try {
      if (Array.isArray(sel)) return sel.map(s => (s == null ? '' : String(s)))
      if (sel instanceof Map) return Array.from(sel.keys()).map(k => String(k))
      if (typeof sel === 'object' && !sel[Symbol.iterator]) return Object.keys(sel).filter(k => !!sel[k]).map(String)
      if (typeof sel === 'object' && sel[Symbol.iterator]) return Array.from(sel).map(s => String(s))
      return [String(sel)]
    } catch {
      return Array.isArray(sel) ? sel.map(s => String(s)) : [String(sel)]
    }
  }

  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [modalKey, setModalKey] = useState(0)
  const [selectionModel, setSelectionModel] = useState([])
  const [paginationModel, setPaginationModel] = useState({ pageSize: 10, page: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchModels()
      let list = Array.isArray(data) ? data : (data && (data.data || data.items || data.content)) || []
      if (!Array.isArray(list)) list = []
      setRows(list.map(r => ({ id: r.id == null ? '' : String(r.id), modelCode: r.modelCode, modelName: r.modelName, isActive: r.isActive })) )
    } catch (e) {
      console.error('Failed to load models', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }

  const handleSaveFromModal = async (updatedModel) => {
    if (!updatedModel) return
    if (saving) return
    setSaving(true)
    try {
      let res
      // if id present -> update, otherwise create
      if (updatedModel.id) {
        res = await updateModel(updatedModel.id, updatedModel)
      } else {
        res = await createModel(updatedModel)
      }

      const newRow = {
        id: (res && res.id) || updatedModel.id,
        modelCode: (res && res.modelCode) ?? updatedModel.modelCode,
        modelName: (res && res.modelName) ?? updatedModel.modelName,
        isActive: (res && (res.isActive !== undefined ? res.isActive : undefined)) ?? updatedModel.isActive
      }

      // if it's a new row, append; otherwise replace
      setRows(prev => {
        const exists = prev.some(r => r.id === newRow.id)
        if (exists) return prev.map(r => (r.id === newRow.id ? newRow : r))
        return [newRow, ...prev]
      })

      handleCloseEdit()
      return newRow
    } catch (e) {
      console.error(e)
      alert('Failed to save changes: ' + (e && e.message ? e.message : 'Unknown error'))
      throw e
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id) => { if (deletingId) return; if (!window.confirm('Delete this model?')) return; setDeletingId(id); try { await deleteModel(id); setRows(prev => prev.filter(r => r.id !== id)); alert('Model deleted successfully') } catch (e) { console.error(e); alert('Delete failed: ' + (e && e.message ? e.message : 'Unknown error')) } finally { setDeletingId(null) } }

  const columns = [
    { field: 'modelCode', headerName: 'Code', width: 150 },
    { field: 'modelName', headerName: 'Name', flex: 1 },
    { field: 'isActive', headerName: 'Active', width: 120 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 120, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => onDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
    ] }
  ]

  return (
    <div style={{ height: 520, width: '100%' }}>
      <h2>Models</h2>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Model</button>
      </div>
      <DataGrid rows={rows} columns={columns} apiRef={apiRef} selectionModel={selectionModel} onSelectionModelChange={(s) => setSelectionModel(normalizeSelection(s))} checkboxSelection loading={loading} pageSizeOptions={[10,25,50]} paginationModel={paginationModel} onPaginationModelChange={(m) => setPaginationModel(m)} />

      <ModelEditModal key={modalKey} open={editOpen} model={selected} onClose={handleCloseEdit} onSave={handleSaveFromModal} saving={saving} />
    </div>
  )
}