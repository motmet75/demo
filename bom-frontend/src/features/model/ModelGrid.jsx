import React, { useEffect, useState, useCallback } from 'react'
import { GridActionsCellItem, DataGrid, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchModels, createModel, updateModel, deleteModel } from '../../api/modelApi'
import ModelEditModal from './ModelEditModal'
import ModelBomDialog from './ModelBomDialog'

export default function ModelGrid({ reloadSignal }) {
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
  const [bomOpen, setBomOpen] = useState(false)
  const [bomModel, setBomModel] = useState(null)

  // grid height control: when `auto` grid fills remaining viewport, otherwise uses px value
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('models_manual_height')
      return v === null ? false : v === 'true'
    } catch {
      return false
    }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('models_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch {
      return 520
    }
  }) // px when manual

  // persist grid height controls
  useEffect(() => {
    try {
      localStorage.setItem('models_manual_height', String(manualHeight))
      localStorage.setItem('models_grid_height', String(gridHeight))
    } catch {
      // ignore storage errors
    }
  }, [manualHeight, gridHeight])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchModels()
      let list = Array.isArray(data) ? data : (data && (data.data || data.items || data.content)) || []
      if (!Array.isArray(list)) list = []
      setRows(list.map(r => ({ id: r.id == null ? '' : String(r.id), uuid: r.id == null ? '' : String(r.id), modelCode: r.modelCode, modelName: r.modelName, isActive: r.isActive, hsCode: r.hsCode ?? '', coCriteria: r.coCriteria ?? '' })) )
    } catch {
      console.error('Failed to load models')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // load on mount and when reloadSignal changes
  useEffect(() => { load() }, [load, reloadSignal])

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
        uuid: (res && res.id) || updatedModel.id,
        modelCode: (res && res.modelCode) ?? updatedModel.modelCode,
        modelName: (res && res.modelName) ?? updatedModel.modelName,
        isActive: (res && (res.isActive !== undefined ? res.isActive : undefined)) ?? updatedModel.isActive,
        hsCode: (res && res.hsCode) ?? updatedModel.hsCode ?? '',
        coCriteria: (res && res.coCriteria) ?? updatedModel.coCriteria ?? ''
      }

      // if it's a new row, append; otherwise replace
      setRows(prev => {
        const exists = prev.some(r => r.id === newRow.id)
        if (exists) return prev.map(r => (r.id === newRow.id ? newRow : r))
        return [newRow, ...prev]
      })

      handleCloseEdit()
      return newRow
    } catch {
      console.error('Failed to save changes')
      alert('Failed to save changes')
      throw new Error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id) => { if (deletingId) return; if (!window.confirm('Delete this model?')) return; setDeletingId(id); try { await deleteModel(id); setRows(prev => prev.filter(r => r.id !== id)); alert('Model deleted successfully') } catch { console.error('Delete failed'); alert('Delete failed') } finally { setDeletingId(null) } }

  const openBomForModel = (row) => { setBomModel(row); setBomOpen(true) }
  const closeBom = () => { setBomOpen(false); setBomModel(null) }

  const columns = [
    { field: 'uuid', headerName: 'UUID', width: 220, hide: true },
    { field: 'modelCode', headerName: 'Code', width: 150 },
    { field: 'modelName', headerName: 'Name', flex: 1 },
    { field: 'hsCode', headerName: 'HS Code', width: 120 },
    { field: 'coCriteria', headerName: 'CO Criteria', width: 120 },
    { field: 'isActive', headerName: 'Active', width: 90 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 180, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => onDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />,
      <GridActionsCellItem icon={<span style={{padding:4,border:'1px solid #ccc',borderRadius:4,fontSize:11}}>BOM</span>} label="View BOM" onClick={() => openBomForModel(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />
    ] }
  ]

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto height is on
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Controls and header occupy natural height; grid container below will fill the rest when auto */}
      <div style={{ padding: 8 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Models</h2>

        {/* Height control: toggle auto/manual and slider/number for manual px height */}
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

        <div style={{ marginBottom: 8 }}>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Model</button>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid rows={rows} columns={columns} apiRef={apiRef} selectionModel={selectionModel} onSelectionModelChange={(s) => setSelectionModel(normalizeSelection(s))} checkboxSelection loading={loading} pageSizeOptions={[10,25,50]} paginationModel={paginationModel} onPaginationModelChange={(m) => setPaginationModel(m)} sx={{ height: '100%' }} />
        </div>
      </div>

      <ModelEditModal key={modalKey} open={editOpen} model={selected} onClose={handleCloseEdit} onSave={handleSaveFromModal} saving={saving} />
      <ModelBomDialog open={bomOpen} onClose={closeBom} model={bomModel} />
    </div>
  )
}