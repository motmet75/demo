import React, { useEffect, useState, useCallback } from 'react'
import { GridActionsCellItem, DataGrid, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchMaterials, updateMaterial, deleteMaterial } from '../../api/materialApi'
import MaterialEditModal from './MaterialEditModal'
import * as XLSX from 'xlsx'

export default function MaterialGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const apiRef = useGridApiRef()
  // grid height control: when `auto` grid fills remaining viewport, otherwise uses px value
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('materials_manual_height')
      return v === null ? false : v === 'true'
    } catch (e) {
      return false
    }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('materials_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch (e) {
      return 520
    }
  }) // px when manual

  // persist grid height controls
  useEffect(() => {
    try {
      localStorage.setItem('materials_manual_height', String(manualHeight))
      localStorage.setItem('materials_grid_height', String(gridHeight))
    } catch (e) {
      // ignore storage errors
    }
  }, [manualHeight, gridHeight])

  // normalize selection shapes (MUI versions return different shapes)
  const normalizeSelection = (sel) => {
    if (sel == null) return []
    try {
      if (Array.isArray(sel)) return sel.map(s => {
        if (s == null) return ''
        if (typeof s === 'object') {
          // objects may have id or rowId
          if ('id' in s) return String(s.id)
          if ('rowId' in s) return String(s.rowId)
          // maybe [id, ...] tuple
          if (Array.isArray(s) && s.length > 0) return String(s[0])
          // fallback to JSON so we at least return something predictable
          try { return String(s.toString()) } catch { return JSON.stringify(s) }
        }
        return String(s)
      })
      // Map -> take keys
      if (sel instanceof Map) return Array.from(sel.keys()).map(k => String(k))
      // plain object map { id: true }
      if (typeof sel === 'object' && !sel[Symbol.iterator]) {
        return Object.keys(sel).filter(k => !!sel[k]).map(String)
      }
      // iterable (Set of ids, or entries)
      if (typeof sel === 'object' && sel[Symbol.iterator]) {
        const arr = Array.from(sel)
        // entries like [[id, true], [id2, true]] -> take first element
        if (arr.length > 0 && Array.isArray(arr[0]) && arr[0].length >= 1) {
          return arr.map(e => String(e[0]))
        }
        return arr.map(s => String(s))
      }
      return [String(sel)]
    } catch {
      return Array.isArray(sel) ? sel.map(s => String(s)) : [String(sel)]
    }
  }

  // dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null) // selected material object for editing
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null) // id currently being deleted
  const [modalKey, setModalKey] = useState(0) // key to force remount of modal when opening

  // selection state for multi-select export
  const [selectionModel, setSelectionModel] = useState([])

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
      // Show a basic error to the user
      try {
        alert('Failed to load materials: ' + (e && e.message ? e.message : 'Unknown error'))
      } catch {
        /* ignore alert failures */ void 0
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
    { field: 'uuid', headerName: 'UUID', width: 200, hide: true },
    { field: 'materialCode', headerName: 'Code', width: 150, editable: false, resizable: true },
    { field: 'materialName', headerName: 'Name', flex: 1, editable: false, resizable: true, minWidth: 150 },
    { field: 'unit', headerName: 'Unit', width: 120, editable: false, resizable: true },
    { field: 'materialType', headerName: 'Type', width: 160, editable: false, resizable: true },
    { field: 'price', headerName: 'Price', width: 150, editable: false, type: 'number', resizable: true },
    { field: 'description', headerName: 'Description', flex: 1, editable: false, minWidth: 200, resizable: true },
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

  // export helpers: selected rows to worksheet and trigger download
  const exportRows = async (selectedIds, format = 'xlsx') => {
    try {
      // debug: show selectionModel and apiRef methods availability
      console.debug('exportRows called', { selectionModel, hasApiRef: !!(apiRef && apiRef.current), hasGetSelectedRows: !!(apiRef && apiRef.current && typeof apiRef.current.getSelectedRows === 'function'), hasGetRowSelectionModel: !!(apiRef && apiRef.current && typeof apiRef.current.getRowSelectionModel === 'function'), passedSelectedIds: selectedIds })

      let rowsToExport = []
      let payloadIds = []

      // 1) Prefer API method that returns selected rows (Map) if available
      if (apiRef && apiRef.current) {
        try {
          if (typeof apiRef.current.getSelectedRows === 'function') {
            const selectedMap = apiRef.current.getSelectedRows()
            if (selectedMap && selectedMap.size > 0) {
              const arr = Array.from(selectedMap.values())
              rowsToExport = arr
              payloadIds = arr.map(r => (r && r.uuid ? String(r.uuid).trim() : String(r.id).trim()))
            }
          }
        } catch {
          // ignore and continue to other fallbacks
        }

        // 2) If no Map available, try getting the selection model and resolve rows locally
        if ((!payloadIds || payloadIds.length === 0) && typeof apiRef.current.getRowSelectionModel === 'function') {
          try {
            const selModel = apiRef.current.getRowSelectionModel()
            const selIds = normalizeSelection(selModel)
            if (selIds && selIds.length > 0) {
              // build lookup maps to resolve ids quickly
              const rowsById = new Map(rows.map(r => [String(r.id), r]))
              const rowsByUuid = new Map(rows.map(r => [String(r.uuid), r]))

              const matched = selIds
                .map(id => rowsByUuid.get(String(id)) || rowsById.get(String(id)) || (Number.isFinite(Number(id)) ? rows[Number(id)] : undefined))
                .filter(Boolean)
              if (matched && matched.length > 0) {
                rowsToExport = matched
                payloadIds = matched.map(r => (r && r.uuid ? String(r.uuid).trim() : String(r.id).trim()))
              } else {
                // If selection seems numeric (row indices), map indices
                const maybeIndices = selIds.map(s => Number(s)).filter(n => Number.isFinite(n) && n >= 0 && n < rows.length)
                if (maybeIndices.length > 0) {
                  rowsToExport = maybeIndices.map(i => rows[i])
                  payloadIds = rowsToExport.map(r => (r && r.uuid ? String(r.uuid).trim() : String(r.id).trim()))
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // 3) Final fallback: use selectedIds argument passed from UI (normalized)
      if ((!payloadIds || payloadIds.length === 0)) {
        const sids = (selectedIds || []).map(s => (s == null ? '' : String(s)))

        // try matching by uuid or id
        const matched = rows.filter(r => sids.includes(String(r.uuid)) || sids.includes(String(r.id)))
        if (matched && matched.length > 0) {
          rowsToExport = matched
          payloadIds = matched.map(r => (r && r.uuid ? String(r.uuid).trim() : String(r.id).trim()))
        } else {
          // numeric index fallback
          const maybeIndices = (selectedIds || []).map(s => Number(s)).filter(n => Number.isFinite(n) && n >= 0 && n < rows.length)
          if (maybeIndices.length > 0) {
            rowsToExport = maybeIndices.map(i => rows[i])
            payloadIds = rowsToExport.map(r => (r && r.uuid ? String(r.uuid).trim() : String(r.id).trim()))
          }
        }
      }

      // Validate UUIDs (server expects UUIDs)
      const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      payloadIds = (payloadIds || []).map(s => (s == null ? '' : String(s).trim())).filter(s => uuidRe.test(s))

      if (!payloadIds || payloadIds.length === 0) {
        console.debug('exportRows: no valid UUID payloadIds', { selectedIds, selectionModel, rowsToExport })
        alert('No valid material IDs selected for export')
        return
      }

      // proceed to fetch/stream or client-side CSV as before
      if (format === 'xlsx') {
        try {
          const res = await fetch('/bom/api/materials/export', {
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
          let filename = 'materials_selected_export.xlsx'
          if (cd) {
            const match = /filename="?([^";]+)"?/.exec(cd)
            if (match && match[1]) filename = match[1]
          }

          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        } catch (e) {
          console.error('Server export failed', e)
          alert('Server export failed: ' + (e && e.message ? e.message : 'Unknown error'))
        }
        return
      }

      // CSV client-side fallback remains unchanged
      const data = rowsToExport.map(r => ({
        ID: r.id,
        UUID: r.uuid,
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
      if (format === 'csv') {
        if (rowsToExport.length === 0) {
          try {
            const res = await fetch('/bom/api/materials/export', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadIds)
            })
            if (!res.ok) throw new Error('Export failed: ' + res.status)
            const arrayBuffer = await res.arrayBuffer()
            const wb = XLSX.read(arrayBuffer, { type: 'array' })
            const firstSheetName = wb.SheetNames[0]
            const csv = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheetName])
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'materials_export.csv'
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          } catch (e) {
            console.error('Server CSV fallback failed', e)
            alert('CSV export failed: ' + (e && e.message ? e.message : 'Unknown error'))
          }
        } else {
          const csv = XLSX.utils.sheet_to_csv(worksheet)
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'materials_export.csv'
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        }
      }
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
          <button
            type="button"
            onClick={() => exportRows(selectionModel, 'xlsx')}
            disabled={(selectionModel?.length || 0) === 0}
          >
            Export XLSX
          </button>
          <button
            type="button"
            onClick={() => exportRows(selectionModel, 'csv')}
            disabled={(selectionModel?.length || 0) === 0}
          >
            Export CSV
          </button>
          <div style={{ color: '#333', fontSize: 13 }}>
            Selected: {selectionModel ? selectionModel.length : 0}
          </div>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            apiRef={apiRef}
            selectionModel={selectionModel}
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
            // capture selection changes from any DataGrid API shape and normalize to string ids
            onRowSelectionModelChange={(newSel) => setSelectionModel(normalizeSelection(newSel))}
            onSelectionModelChange={(newSel) => setSelectionModel(normalizeSelection(newSel))}
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
