import React, { useEffect, useState, useCallback } from 'react'
import { GridActionsCellItem, DataGrid, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchMaterials, updateMaterial, deleteMaterial } from '../../api/materialApi'
import { apiFetch } from '../../api/client'
import MaterialEditModal from './MaterialEditModal'
import * as XLSX from 'xlsx'

export default function MaterialGrid({ refreshKey }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const apiRef = useGridApiRef()
  // grid height control: when `auto` grid fills remaining viewport, otherwise uses px value
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('materials_manual_height')
      return v === null ? false : v === 'true'
    } catch {
      return false
    }
 })
  
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('materials_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch {
      return 520
    }
  }) // px when manual

  // persist grid height controls
  useEffect(() => {
    try {
      localStorage.setItem('materials_manual_height', String(manualHeight))
      localStorage.setItem('materials_grid_height', String(gridHeight))
    } catch {
      // ignore storage errors
    }
  }, [manualHeight, gridHeight])

  // dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null) // selected material object for editing
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null) // id currently being deleted
  const [modalKey, setModalKey] = useState(0) // key to force remount of modal when opening

  // selection state for multi-select export
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // Pagination: controlled model so records-per-page is adjustable and persisted
  const [paginationModel, setPaginationModel] = useState(() => {
    const defaultSize = 10
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = parseInt(localStorage.getItem('materials_page_size'), 10)
        if (Number.isFinite(saved) && saved > 0) return { pageSize: saved, page: 0 }
      }
    } catch {
      /* ignore and fall back to default */ void 0
    }
    return { pageSize: defaultSize, page: 0 }
  })

  // filter state
  const [filterUuid, setFilterUuid] = useState('')
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

  // Helper: convert a Date to the value required by datetime-local input (YYYY-MM-DDTHH:mm)
  const toDatetimeLocal = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    if (preset === 'today') {
      setFilterCreatedFrom(toDatetimeLocal(todayStart))
      setFilterCreatedTo(toDatetimeLocal(todayEnd))
    } else if (preset === 'yesterday') {
      const ys = new Date(todayStart); ys.setDate(ys.getDate() - 1)
      const ye = new Date(todayEnd);   ye.setDate(ye.getDate() - 1)
      setFilterCreatedFrom(toDatetimeLocal(ys))
      setFilterCreatedTo(toDatetimeLocal(ye))
    } else if (preset === 'this_week') {
      const day = now.getDay() // 0=Sun
      const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - day)
      setFilterCreatedFrom(toDatetimeLocal(weekStart))
      setFilterCreatedTo(toDatetimeLocal(todayEnd))
    } else if (preset.startsWith('last_')) {
      const days = parseInt(preset.replace('last_', ''), 10)
      const from = new Date(todayStart); from.setDate(from.getDate() - (days - 1))
      setFilterCreatedFrom(toDatetimeLocal(from))
      setFilterCreatedTo(toDatetimeLocal(todayEnd))
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMaterials()

      // Normalize response to an array. Handle common envelope formats.
      let list = []
      if (Array.isArray(data)) {
        list = data
      } else if (data && typeof data === 'object') {
        list = data.data || data.items || data.content || []
      } else {
        list = []
      }

      if (!Array.isArray(list)) {
        // fallback to empty array if still not an array
        console.warn('fetchMaterials did not return an array. Received:', data)
        list = []
      }

      // Include price, description and uuid from the API so edit modal receives them
      // Normalize ids to strings to avoid selection type mismatches
      setRows(list.map((r) => ({
        id: r.id == null ? '' : String(r.id),
        uuid: r.id == null ? '' : String(r.id),
        materialCode: r.materialCode,
        materialName: r.materialName,
        unit: r.unit,
        materialType: r.materialType,
        price: r.price,
        description: r.description,
        isActive: r.isActive,
        createdAt: r.createdAt
      })))
    } catch (e) {
      console.error('Failed to load materials', e)
      // Don't show an alert for missing context — the user just hasn't selected a company yet
      const msg = e && e.message ? e.message : ''
      if (!msg.includes('tenant') && !msg.includes('company')) {
        try {
          alert('Failed to load materials: ' + (msg || 'Unknown error'))
        } catch {
          /* ignore alert failures */ void 0
        }
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const handleOpenEdit = (row) => {
    // open modal with a deep-cloned object to avoid binding/mutation of the original row
    setSelected(JSON.parse(JSON.stringify(row)))
    setModalKey(k => k + 1)
    setEditOpen(true)
  }

  const handleCloseEdit = () => {
    setEditOpen(false)
    setSelected(null)
  }

  // called by MaterialEditModal when user saves
  const handleSaveFromModal = async (updatedMaterial) => {
    if (!updatedMaterial) return
    if (saving) return
    setSaving(true)
    try {
      const res = await updateMaterial(updatedMaterial.id, updatedMaterial)

      // build a row object compatible with the grid
      const newRow = {
        id: (res && res.id) || updatedMaterial.id,
        uuid: (res && res.id) || updatedMaterial.id,
        materialCode: (res && res.materialCode) ?? updatedMaterial.materialCode,
        materialName: (res && res.materialName) ?? updatedMaterial.materialName,
        unit: (res && res.unit) ?? updatedMaterial.unit,
        materialType: (res && res.materialType) ?? updatedMaterial.materialType,
        price: (res && (res.price !== undefined ? res.price : undefined)) ?? updatedMaterial.price,
        description: (res && (res.description !== undefined ? res.description : undefined)) ?? updatedMaterial.description
        ,
        isActive: (res && (res.isActive !== undefined ? res.isActive : undefined)) ?? updatedMaterial.isActive,
        createdAt: (res && (res.createdAt !== undefined ? res.createdAt : undefined)) ?? updatedMaterial.createdAt
      }

      setRows(prev => prev.map(r => (r.id === newRow.id ? newRow : r)))
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

  const onDelete = async (id) => {
    if (deletingId) return // another delete in progress
    if (!window.confirm('Delete this material?')) return
    setDeletingId(id)
    try {
      await deleteMaterial(id)
      // remove deleted row immutably
      setRows(prev => prev.filter(r => r.id !== id))
      // show success message
      alert('Material deleted successfully')
    } catch (e) {
      console.error(e)
      alert('Delete failed: ' + (e && e.message ? e.message : 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected material(s)?`)) return
    setDeletingId('bulk')
    const failed = []
    for (const id of selectedIds) {
      try {
        await deleteMaterial(id)
      } catch (e) {
        console.error('Failed to delete', id, e)
        failed.push(id)
      }
    }
    const deleted = selectedIds.filter(id => !failed.includes(id))
    setRows(prev => prev.filter(r => !deleted.includes(r.id)))
    setSelectionModel({ type: 'include', ids: new Set() })
    setDeletingId(null)
    if (failed.length > 0) {
      alert(`Deleted ${deleted.length} item(s). Failed to delete ${failed.length} item(s).`)
    } else {
      alert(`Deleted ${deleted.length} material(s) successfully.`)
    }
  }

  // update page size and persist selection
  const handlePaginationModelChange = (newModel) => {
    // normalize to object shape { page, pageSize }
    const model = newModel && typeof newModel === 'object' ? newModel : paginationModel
    setPaginationModel(model)
    try {
      if (typeof window !== 'undefined' && window.localStorage && model && model.pageSize) {
        localStorage.setItem('materials_page_size', String(model.pageSize))
      }
    } catch {
      /* ignore storage errors */ void 0
    }
  }

  const columns = [
    // Hidden UUID column to carry the UUID value with each row (submitted to backend)
    { field: 'uuid', headerName: 'UUID', width: 200, hide: true, flex: 1 },
    { field: 'materialCode', headerName: 'Code', width: 150, editable: false, resizable: true },
    { field: 'materialName', headerName: 'Name', flex: 1, editable: false, resizable: true, minWidth: 150 },
    { field: 'unit', headerName: 'Unit', width: 120, editable: false, resizable: true },
    { field: 'materialType', headerName: 'Type', width: 160, editable: false, resizable: true },
    { field: 'description', headerName: 'Description', flex: 1, editable: false, minWidth: 200, resizable: true },
    { field: 'createdAt', headerName: 'Created At', width: 180, editable: false, resizable: true,
      valueFormatter: (value) => value ? new Date(value).toLocaleString() : '' },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 120, resizable: false, getActions: (params) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleOpenEdit(params.row)}
          showInMenu={false}
          disabled={!!saving || !!deletingId}
        />, 
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => onDelete(params.id)}
          showInMenu={false}
          disabled={!!deletingId || !!saving || (deletingId && deletingId !== params.id)}
        />
      ]
    }
  ]

  const filteredRows = rows.filter(r => {
    const s = (v) => (v == null ? '' : String(v)).toLowerCase()
    if (filterUuid && !s(r.id).includes(filterUuid.toLowerCase())) return false
    if (filterCode && !s(r.materialCode).includes(filterCode.toLowerCase())) return false
    if (filterName && !s(r.materialName).includes(filterName.toLowerCase())) return false
    if (filterUnit && !s(r.unit).includes(filterUnit.toLowerCase())) return false
    if (filterType && !s(r.materialType).includes(filterType.toLowerCase())) return false
    if (filterDescription && !s(r.description).includes(filterDescription.toLowerCase())) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const rowDate = r.createdAt ? new Date(r.createdAt) : null
      if (!rowDate || isNaN(rowDate)) return false
      if (filterCreatedFrom && rowDate < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && rowDate > new Date(filterCreatedTo))   return false
    }
    return true
  })

  // Derive selectedIds scoped to filteredRows only.
  // When DataGrid fires a select-all (type:'exclude', ids=empty), convert it to an
  // explicit include of all currently filtered row IDs so selection never escapes the filter.
  const filteredIds = new Set(filteredRows.map(r => r.id))
  const selectedIds = selectionModel.type === 'exclude'
    ? filteredRows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => filteredIds.has(id))

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      // Select-all fired by DataGrid header checkbox — clamp to filtered IDs only
      const excluded = model.ids ?? new Set()
      const newIds = new Set(filteredRows.map(r => r.id).filter(id => !excluded.has(id)))
      setSelectionModel({ type: 'include', ids: newIds })
    } else {
      setSelectionModel(model)
    }
  }

  // export helpers: selected rows to worksheet and trigger download
  const exportRows = async (ids, format = 'xlsx') => {
    try {
      if (!ids || ids.length === 0) {
        alert('No rows selected for export')
        return
      }

      // Build UUID payload — row.id is the UUID (set during load normalization)
      const idSet = new Set(ids.map(String))
      const rowsToExport = rows.filter(r => idSet.has(String(r.id)))

      const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      const payloadIds = rowsToExport
        .map(r => String(r.id ?? r.uuid ?? '').trim())
        .filter(s => uuidRe.test(s))

      if (payloadIds.length === 0) {
        alert('No valid material IDs found for export')
        return
      }

      if (format === 'xlsx') {
        const res = await apiFetch('/sapi/bom/materials/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadIds)
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error('Export failed: ' + res.status + ' ' + text)
        }
        const blob = await res.blob()
        const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition')
        let filename = 'materials_export.xlsx'
        if (cd) { const m = /filename="?([^";]+)"?/.exec(cd); if (m && m[1]) filename = m[1] }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = filename
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        return
      }

      // CSV — client-side via XLSX
      const data = rowsToExport.map(r => ({
        ID: r.id,
        Code: r.materialCode,
        Name: r.materialName,
        Unit: r.unit,
        Type: r.materialType,
        Price: r.price,
        Description: r.description,
        Active: r.isActive,
        CreatedAt: r.createdAt
      }))
      const worksheet = XLSX.utils.json_to_sheet(data)
      const csv = XLSX.utils.sheet_to_csv(worksheet)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'materials_export.csv'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
      alert('Export failed: ' + (e && e.message ? e.message : 'Unknown error'))
    }
  }

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto height is on
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      {/* Controls and header occupy natural height; grid container below will fill the rest when auto */}
      <div style={{ padding: 8 }}>
        <h2 style={{ margin: '0 0 8px 0' }}>Materials</h2>

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
      </div>

      {/* Export controls and top small toolbar */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        {/* Top control: records-per-page selector (persists to localStorage) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <label htmlFor="page-size-select">Records per page:&nbsp;</label>
            <select
              id="page-size-select"
              value={paginationModel.pageSize}
              onChange={(e) => handlePaginationModelChange({ ...paginationModel, pageSize: Number(e.target.value), page: 0 })}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div style={{ color: '#666', fontSize: 12 }}>
            {rows.length} records
          </div>
        </div>

        {/* Export controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => load()} disabled={loading} title="Refresh">🔄 Refresh</button>
          <button
            type="button"
            onClick={() => exportRows(selectedIds, 'xlsx')}
            disabled={selectedIds.length === 0}
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={() => exportRows(selectedIds, 'csv')}
            disabled={selectedIds.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0 || !!deletingId}
            style={{ color: selectedIds.length > 0 ? '#d32f2f' : undefined, borderColor: selectedIds.length > 0 ? '#d32f2f' : undefined }}
          >
            Delete Selected ({selectedIds.length})
          </button>
          <div style={{ color: '#333', fontSize: 13 }}>
            Selected: {selectedIds.length}
          </div>
        </div>

        {/* Filter fields */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
          {[
            { label: 'UUID',        value: filterUuid,        set: setFilterUuid,        width: 220 },
            { label: 'Code',        value: filterCode,        set: setFilterCode,        width: 120 },
            { label: 'Name',        value: filterName,        set: setFilterName,        width: 160 },
            { label: 'Unit',        value: filterUnit,        set: setFilterUnit,        width: 100 },
            { label: 'Type',        value: filterType,        set: setFilterType,        width: 120 },
            { label: 'Description', value: filterDescription, set: setFilterDescription, width: 160 },
          ].map(({ label, value, set, width }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: 11, color: '#666' }}>{label}</label>
              <input
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={`Filter ${label}`}
                style={{ width, fontSize: 12, padding: '3px 6px', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {/* Created At datetime range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#666' }}>Quick Range</label>
            <select
              value={createdRangePreset}
              onChange={e => applyCreatedRangePreset(e.target.value)}
              style={{ fontSize: 12, padding: '3px 6px', boxSizing: 'border-box', height: 24 }}
            >
              <option value="">— All —</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_7">Last 7 Days</option>
              <option value="last_14">Last 14 Days</option>
              <option value="last_30">Last 30 Days</option>
              <option value="last_60">Last 60 Days</option>
              <option value="last_90">Last 90 Days</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#666' }}>Created From</label>
            <input
              type="datetime-local"
              value={filterCreatedFrom}
              onChange={e => { setCreatedRangePreset(''); setFilterCreatedFrom(e.target.value) }}
              style={{ fontSize: 12, padding: '3px 6px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#666' }}>Created To</label>
            <input
              type="datetime-local"
              value={filterCreatedTo}
              onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }}
              style={{ fontSize: 12, padding: '3px 6px', boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="button"
            onClick={() => { setFilterUuid(''); setFilterCode(''); setFilterName(''); setFilterUnit(''); setFilterType(''); setFilterDescription(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('') }}
            style={{ alignSelf: 'flex-end', fontSize: 12, padding: '4px 10px' }}
          >
            Clear
          </button>
          <div style={{ alignSelf: 'flex-end', color: '#666', fontSize: 12 }}>
            {filteredRows.length} / {rows.length}
          </div>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            apiRef={apiRef}
            sx={{
              '& .MuiDataGrid-columnSeparator': {
                visibility: 'visible',
              },
              '& .MuiDataGrid-columnHeaders': {
                borderBottom: '1px solid #e0e0e0',
              },
              '& .MuiDataGrid-cell': {
                borderRight: '1px solid #e0e0e0',
              },
              '& .MuiDataGrid-row': {
                borderBottom: '1px solid #f0f0f0',
              },
              height: '100%'
            }}
            loading={loading}
            pageSizeOptions={[10, 25, 50]}
            paginationMode="client"
            paginationModel={paginationModel}
            onPaginationModelChange={handlePaginationModelChange}
            checkboxSelection={true}
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={handleSelectionModelChange}
            // allow row click to change selection (clicking row will select it)
            disableRowSelectionOnClick={false}
            // enable column resizing - allow user to resize columns by dragging
            columnResizeMode="interactive"
          />
        </div>
      </div>
 
 
       
 
       {/* Edit modal integrated */}
       <MaterialEditModal
         key={modalKey}
         open={editOpen}
         material={selected}
         onClose={handleCloseEdit}
         onSave={handleSaveFromModal}
         saving={saving}
       />
    </div>
   )
 }