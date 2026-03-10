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
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // filter state
  const [filterCode, setFilterCode] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

  const toDatetimeLocal = (d) => { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const te = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    if (preset === 'today') { setFilterCreatedFrom(toDatetimeLocal(ts)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset === 'yesterday') { const ys = new Date(ts); ys.setDate(ys.getDate() - 1); const ye = new Date(te); ye.setDate(ye.getDate() - 1); setFilterCreatedFrom(toDatetimeLocal(ys)); setFilterCreatedTo(toDatetimeLocal(ye)) }
    else if (preset === 'this_week') { const ws = new Date(ts); ws.setDate(ws.getDate() - now.getDay()); setFilterCreatedFrom(toDatetimeLocal(ws)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset.startsWith('last_')) { const d = parseInt(preset.replace('last_', ''), 10); const f = new Date(ts); f.setDate(f.getDate() - (d - 1)); setFilterCreatedFrom(toDatetimeLocal(f)); setFilterCreatedTo(toDatetimeLocal(te)) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!tenantId) { setRows([]); return }
      const data = await getCompanies(tenantId)
      if (Array.isArray(data)) {
        setRows(data.map(r => ({
          id: r.id != null ? String(r.id) : '',
          uuid: r.id != null ? String(r.id) : '',
          code: r.companyCode ?? r.code ?? '',
          name: r.companyName ?? r.name ?? '',
          createdAt: r.createdAt ?? null,
          __raw: r
        })))
      } else { setRows([]) }
    } catch (err) {
      console.error('Failed to load companies', err)
      setRows([])
    } finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }
  const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const handleSave = async (payload) => {
    if (saving) return
    setSaving(true)
    try {
      if (!payload.tenantId && tenantId) payload.tenantId = tenantId
      let res
      if (payload.id) { res = await updateCompany(payload.id, payload) }
      else { res = await createCompany(payload) }
      const generatedId = (res && res.id) ? String(res.id) : (payload.id ? String(payload.id) : makeTempId())
      const newRow = {
        id: generatedId, uuid: generatedId,
        code: res && (res.companyCode || res.code) ? (res.companyCode || res.code) : payload.code,
        name: res && (res.companyName || res.name) ? (res.companyName || res.name) : payload.name,
        createdAt: res?.createdAt ?? payload.createdAt ?? null
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
    } finally { setSaving(false) }
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
    } finally { setDeletingId(null) }
  }

  const columns = [
    { field: 'uuid', headerName: 'UUID', width: 220, hide: true, flex: 1 },
    { field: 'code', headerName: 'Code', width: 150 },
    { field: 'name', headerName: 'Name', flex: 1 },
    {
      field: 'actions', type: 'actions', headerName: 'Actions', width: 140,
      getActions: (params) => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => handleOpenEdit(params.row)} showInMenu={false} disabled={!!saving || !!deletingId} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDelete(params.id)} showInMenu={false} disabled={!!deletingId || !!saving} />
      ]
    }
  ]

  const filteredRows = rows.filter(r => {
    const s = v => (v == null ? '' : String(v)).toLowerCase()
    if (filterCode && !s(r.code).includes(filterCode.toLowerCase())) return false
    if (filterName && !s(r.name).includes(filterName.toLowerCase())) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo && d > new Date(filterCreatedTo)) return false
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
        <h3>Companies</h3>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Company</button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
          {[
            { label: 'Code', value: filterCode, set: setFilterCode, width: 130 },
            { label: 'Name', value: filterName, set: setFilterName, width: 180 },
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
          <button type="button" onClick={() => { setFilterCode(''); setFilterName(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('') }} style={{ alignSelf: 'flex-end', fontSize: 12, padding: '4px 10px' }}>Clear</button>
          <div style={{ alignSelf: 'flex-end', color: '#666', fontSize: 12 }}>{filteredRows.length} / {rows.length}</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection
            rowSelectionModel={selectionModel}
            onRowSelectionModelChange={handleSelectionModelChange}
            sx={{ height: '100%' }}
          />
        </div>
      </div>

      <CompanyEditModal key={modalKey} open={editOpen} company={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}
