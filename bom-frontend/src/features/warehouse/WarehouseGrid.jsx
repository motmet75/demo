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
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // filter state
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

  const toDatetimeLocal = (d) => { const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const te = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    if (preset === 'today') { setFilterCreatedFrom(toDatetimeLocal(ts)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset === 'yesterday') { const ys=new Date(ts); ys.setDate(ys.getDate()-1); const ye=new Date(te); ye.setDate(ye.getDate()-1); setFilterCreatedFrom(toDatetimeLocal(ys)); setFilterCreatedTo(toDatetimeLocal(ye)) }
    else if (preset === 'this_week') { const ws=new Date(ts); ws.setDate(ws.getDate()-now.getDay()); setFilterCreatedFrom(toDatetimeLocal(ws)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset.startsWith('last_')) { const d=parseInt(preset.replace('last_',''),10); const f=new Date(ts); f.setDate(f.getDate()-(d-1)); setFilterCreatedFrom(toDatetimeLocal(f)); setFilterCreatedTo(toDatetimeLocal(te)) }
  }

  // grid height control
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('warehouses_manual_height')
      return v === null ? false : v === 'true'
    } catch { return false }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('warehouses_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch { return 520 }
  })

  useEffect(() => {
    try {
      localStorage.setItem('warehouses_manual_height', String(manualHeight))
      localStorage.setItem('warehouses_grid_height', String(gridHeight))
    } catch { /* ignore */ }
  }, [manualHeight, gridHeight])

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
          contactName: r.contactName ?? r.contact_name ?? '',
          phone: r.phone ?? '',
          email: r.email ?? '',
          capacity: r.capacity != null ? r.capacity : null,
          note: r.note ?? '',
          __raw: r
        })))
      } else {
        setRows([])
      }
    } catch {
      console.error('Failed to load warehouses')
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
        isActive: (res && res.isActive !== undefined) ? res.isActive : payload.isActive,
        contactName: res && (res.contactName ?? res.contact_name) ? (res.contactName ?? res.contact_name) : payload.contactName,
        phone: res && res.phone ? res.phone : payload.phone,
        email: res && res.email ? res.email : payload.email,
        capacity: res && (res.capacity !== undefined) ? res.capacity : payload.capacity,
        note: res && res.note ? res.note : payload.note
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
    { field: 'uuid', headerName: 'UUID', width: 220, hide: true , flex: 1 },
    { field: 'code', headerName: 'Code', width: 150 },
    { field: 'name', headerName: 'Name'},
    { field: 'location', headerName: 'Location', width: 200 },
    { field: 'contactName', headerName: 'Contact', width: 180 },
    { field: 'phone', headerName: 'Phone', width: 150 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'capacity', headerName: 'Capacity', width: 120 },
    { field: 'note', headerName: 'Note', width: 220, hide: true },
    { field: 'isActive', headerName: 'Active', width: 100 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 140, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
      <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => handleDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
    ] }
  ]

  const filteredRows = rows.filter(r => {
    const s = v => (v == null ? '' : String(v)).toLowerCase()
    if (filterCode && !s(r.code).includes(filterCode.toLowerCase())) return false
    if (filterName && !s(r.name).includes(filterName.toLowerCase())) return false
    if (filterLocation && !s(r.location).includes(filterLocation.toLowerCase())) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && d > new Date(filterCreatedTo))   return false
    }
    return true
  })

  const filteredIds = new Set(filteredRows.map(r => r.id))
  // eslint-disable-next-line no-unused-vars
  const _selectedIds = selectionModel.type === 'exclude'
    ? filteredRows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => filteredIds.has(id))

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      const excluded = model.ids ?? new Set()
      setSelectionModel({ type: 'include', ids: new Set(filteredRows.map(r => r.id).filter(id => !excluded.has(id))) })
    } else { setSelectionModel(model) }
  }

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Warehouses</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Warehouse</button>
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
            <input type="range" min={200} max={1200} step={10} value={gridHeight} onChange={(e) => setGridHeight(Number(e.target.value))} disabled={!manualHeight} />
            <input type="number" value={gridHeight} onChange={(e) => setGridHeight(Number(e.target.value || 0))} disabled={!manualHeight} style={{ width: 80 }} />
          </label>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
          {[
            { label: 'Code',     value: filterCode,     set: setFilterCode,     width: 120 },
            { label: 'Name',     value: filterName,     set: setFilterName,     width: 180 },
            { label: 'Location', value: filterLocation, set: setFilterLocation, width: 160 },
          ].map(({ label, value, set, width }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: 11, color: '#666' }}>{label}</label>
              <input value={value} onChange={e => set(e.target.value)} placeholder={`Filter ${label}`} style={{ width, fontSize: 12, padding: '3px 6px' }} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#666' }}>Quick Range</label>
            <select value={createdRangePreset} onChange={e => applyCreatedRangePreset(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
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
            <input type="datetime-local" value={filterCreatedFrom} onChange={e => { setCreatedRangePreset(''); setFilterCreatedFrom(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 11, color: '#666' }}>Created To</label>
            <input type="datetime-local" value={filterCreatedTo} onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
          </div>
          <button type="button" onClick={() => { setFilterCode(''); setFilterName(''); setFilterLocation(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('') }} style={{ alignSelf: 'flex-end', fontSize: 12, padding: '4px 10px' }}>Clear</button>
          <div style={{ alignSelf: 'flex-end', color: '#666', fontSize: 12 }}>{filteredRows.length} / {rows.length}</div>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid rows={filteredRows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]}
            checkboxSelection
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={handleSelectionModelChange}
            sx={{ height: '100%' }} />
        </div>
      </div>

      <WarehouseEditModal key={modalKey} open={editOpen} warehouse={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}