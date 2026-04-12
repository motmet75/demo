import React, { useEffect, useState } from 'react'
import { GridActionsCellItem, DataGrid } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { fetchContracts, updateContract, deleteContract, createContract } from '../../api/contractApi'
import ContractEditModal from './ContractEditModal'
import { numFmt } from '../../utils/format'

export default function ContractGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchContracts()
      let list = Array.isArray(data) ? data : (data && data.content) || []
      const mappedRows = list.map(r => ({ id: r.id, ...r }))
      setRows(mappedRows)
    } catch (e) {
      console.error('Failed to load contracts', e)
      alert('Failed to load contracts: ' + (e && e.message ? e.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleOpenEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setEditOpen(true) }
  const handleCloseEdit = () => { setEditOpen(false); setSelected(null) }

  const handleAdd = () => { setSelected(null); setEditOpen(true) }

  const handleSave = async (updated) => {
    setSaving(true)
    try {
      let res
      if (updated.id) {
        res = await updateContract(updated.id, updated)
        setRows(prev => prev.map(r => r.id === res.id ? res : r))
      } else {
        res = await createContract(updated)
        // Instead of blindly appending, refresh the list to ensure server-side fields (like resolved company names) are present
        await load()
      }
      handleCloseEdit()
      return res
    } catch (e) {
      console.error(e)
      alert('Save failed: ' + (e && e.message ? e.message : 'Unknown error'))
      throw e
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id) => {
    if (!window.confirm('Delete this contract?')) return
    try {
      await deleteContract(id)
      setRows(prev => prev.filter(r => r.id !== id))
      alert('Deleted')
    } catch (e) { console.error(e); alert('Delete failed: ' + (e && e.message ? e.message : 'Unknown error')) }
  }

  const columns = [
    { field: 'contractNumber', headerName: 'Number', width: 180 },
    { field: 'title', headerName: 'Title', flex: 1 },
    // show supplier company code and name if available
    { 
      field: 'supplierCompany', 
      headerName: 'Supplier', 
      width: 240, 
      valueGetter: (params) => {
        if (!params) return ''
        const s = params
        if (!s) return ''
        if (typeof s === 'string') return s
        if (typeof s === 'object') {
          // Try all possible field name combinations
          const code = s.companyCode || s.code || ''
          const name = s.companyName || s.name || ''
          if (code && name) return `${code} - ${name}`
          if (code) return code
          if (name) return name
          return ''
        }
        return ''
      }
    },
    // show supplier company UUID
    { 
      field: 'supplierCompanyId', 
      headerName: 'Supplier ID', 
      width: 280, 
      valueGetter: (params) => {
        if (!params || !params.row) return ''
        const s = params.row.supplierCompany
        if (!s) return ''
        if (typeof s === 'object' && s.id) return String(s.id)
        return ''
      }
    },
    // show purchasing company code and name if available
    { 
      field: 'purchasingCompany', 
      headerName: 'Purchasing', 
      width: 240, 
      valueGetter: (params) => {
        if (!params) return ''
        const p = params
        if (!p) return ''
        if (typeof p === 'string') return p
        if (typeof p === 'object') {
          // Try all possible field name combinations
          const code = p.companyCode || p.code || ''
          const name = p.companyName || p.name || ''
          if (code && name) return `${code} - ${name}`
          if (code) return code
          if (name) return name
          return ''
        }
        return ''
      }
    },
    // show purchasing company UUID
    { 
      field: 'purchasingCompanyId', 
      headerName: 'Purchasing ID', 
      width: 280, 
      valueGetter: (params) => {
        if (!params || !params.row) return ''
        const p = params.row.purchasingCompany
        if (!p) return ''
        if (typeof p === 'object' && p.id) return String(p.id)
        return ''
      }
    },
    { field: 'status', headerName: 'Status', width: 140 },
    { field: 'startDate', headerName: 'Start', width: 180 },
    { field: 'endDate', headerName: 'End', width: 180 },
    { field: 'totalValue', headerName: 'Value', width: 140, type: 'number', valueFormatter: numFmt },
    { field: 'currency', headerName: 'Currency', width: 100 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 120, getActions: (params) => {
      if (!params || !params.row) return []
      const row = params.row
      return [
        <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => handleOpenEdit(row)} />, 
        <GridActionsCellItem icon={<DeleteIcon/>} label="Delete" onClick={() => onDelete(row.id)} />
      ]
    } }
  ]

  return (
    <div style={{ height: 600, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2>Contracts</h2>
        <div>
          <button onClick={handleAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AddIcon /> Add Contract</button>
        </div>
      </div>
      <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} paginationMode="client" />

      <ContractEditModal open={editOpen} contract={selected} onClose={handleCloseEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}