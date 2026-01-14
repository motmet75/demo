import React, { useEffect, useState, useCallback } from 'react'
import { GridActionsCellItem, DataGrid } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchMaterials, updateMaterial, deleteMaterial } from '../../api/materialApi'
import MaterialEditModal from './MaterialEditModal'

export default function MaterialGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  // dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null) // selected material object for editing
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null) // id currently being deleted
  const [modalKey, setModalKey] = useState(0) // key to force remount of modal when opening

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

      // Include price and description from the API so edit modal receives them
      setRows(list.map(r => ({ id: r.id, materialCode: r.materialCode, materialName: r.materialName, unit: r.unit, materialType: r.materialType, price: r.price, description: r.description })))
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
        materialCode: (res && res.materialCode) ?? updatedMaterial.materialCode,
        materialName: (res && res.materialName) ?? updatedMaterial.materialName,
        unit: (res && res.unit) ?? updatedMaterial.unit,
        materialType: (res && res.materialType) ?? updatedMaterial.materialType,
        price: (res && (res.price !== undefined ? res.price : undefined)) ?? updatedMaterial.price,
        description: (res && (res.description !== undefined ? res.description : undefined)) ?? updatedMaterial.description
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

  return (
    <div style={{ height: 520, width: '100%' }}>
      <h2>Materials</h2>

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

      <DataGrid
        rows={rows}
        columns={columns}
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
			
		  }}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        paginationMode="client"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationModelChange}
        checkboxSelection={false}
        disableRowSelectionOnClick
        // enable column resizing - allow user to resize columns by dragging
        columnResizeMode="interactive"
      />


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