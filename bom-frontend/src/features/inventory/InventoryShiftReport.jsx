import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DownloadIcon from '@mui/icons-material/Download'
import RefreshIcon from '@mui/icons-material/Refresh'
import * as XLSX from 'xlsx'
import { fetchInventoryView } from '../../api/inventoryApi'
import { fetchMaterials } from '../../api/materialApi'
import { dateFmt, numFmt } from '../../utils/format'

const SHIFT_OPTIONS = [
  { key: 'morning', label: 'Morning', startHour: 6, endHour: 14 },
  { key: 'afternoon', label: 'Afternoon', startHour: 14, endHour: 22 },
  { key: 'night', label: 'Night', startHour: 22, endHour: 6 },
  { key: 'custom', label: 'Custom' }
]

function toDateInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDateTimeInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildShiftWindow(reportDate, shiftKey, customStart, customEnd) {
  if (shiftKey === 'custom') {
    const start = customStart ? new Date(customStart) : null
    const end = customEnd ? new Date(customEnd) : null
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
      end: end && !Number.isNaN(end.getTime()) ? end : null
    }
  }

  const option = SHIFT_OPTIONS.find(s => s.key === shiftKey) || SHIFT_OPTIONS[0]
  const [year, month, day] = String(reportDate || toDateInputValue()).split('-').map(Number)
  const start = new Date(year, month - 1, day, option.startHour, 0, 0, 0)
  const end = new Date(year, month - 1, day, option.endHour, 0, 0, 0)
  if (option.endHour <= option.startHour) end.setDate(end.getDate() + 1)
  return { start, end }
}

function asNumber(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function normalizeInventory(item) {
  if (!item || typeof item !== 'object') return null
  const quantityOnHand = asNumber(item.quantityOnHand ?? item.quantity_on_hand)
  const quantityLocked = asNumber(item.quantityLocked ?? item.quantity_locked)
  return {
    id: item.inventoryId ?? item.id ?? '',
    materialId: item.materialId ? String(item.materialId) : (item.material?.id ? String(item.material.id) : ''),
    materialCode: item.materialCode ?? item.material_code ?? item.material?.materialCode ?? '',
    materialName: item.materialName ?? item.material_name ?? item.material?.materialName ?? '',
    warehouseCode: item.warehouseCode ?? item.warehouse_code ?? item.warehouse?.code ?? '',
    batchNo: item.batchNo ?? item.batch_no ?? '',
    unit: item.unit ?? item.material?.unit ?? '',
    quantityOnHand,
    quantityTotal: asNumber(item.quantityTotal ?? item.quantity_total ?? quantityOnHand),
    quantityReserved: asNumber(item.quantityReserved ?? item.quantity_reserved),
    quantityLocked,
    availableQuantity: Math.max(quantityOnHand - quantityLocked, 0),
    updatedAt: item.updatedAt ?? item.modifiedTime ?? item.createdAt ?? null
  }
}

function normalizeMaterial(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ? String(item.id) : '',
    materialCode: item.materialCode ?? item.material_code ?? '',
    materialName: item.materialName ?? item.material_name ?? '',
    materialType: item.materialType ?? item.material_type ?? 'MATERIAL',
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail_url ?? '',
    unit: item.unit ?? ''
  }
}

function isInsideWindow(value, windowRange) {
  if (!value || !windowRange?.start || !windowRange?.end) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date >= windowRange.start && date <= windowRange.end
}

function latestDate(a, b) {
  if (!a) return b || null
  if (!b) return a || null
  const da = new Date(a)
  const db = new Date(b)
  if (Number.isNaN(da.getTime())) return b
  if (Number.isNaN(db.getTime())) return a
  return db > da ? b : a
}

export default function InventoryShiftReport() {
  const [inventoryRows, setInventoryRows] = useState([])
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [shiftKey, setShiftKey] = useState('morning')
  const [reportDate, setReportDate] = useState(() => toDateInputValue())
  const [customStart, setCustomStart] = useState(() => toDateTimeInputValue(new Date()))
  const [customEnd, setCustomEnd] = useState(() => {
    const next = new Date()
    next.setHours(next.getHours() + 8)
    return toDateTimeInputValue(next)
  })

  const shiftWindow = useMemo(
    () => buildShiftWindow(reportDate, shiftKey, customStart, customEnd),
    [reportDate, shiftKey, customStart, customEnd]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inventoryData, materialData] = await Promise.all([
        fetchInventoryView(),
        fetchMaterials()
      ])
      setInventoryRows(Array.isArray(inventoryData) ? inventoryData.map(normalizeInventory).filter(Boolean) : [])
      setMaterials(Array.isArray(materialData) ? materialData.map(normalizeMaterial).filter(Boolean) : [])
    } catch (err) {
      console.error('Failed to load inventory shift report', err)
      setInventoryRows([])
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const materialLookup = useMemo(() => {
    const byId = new Map()
    const byCode = new Map()
    for (const material of materials) {
      if (material.id) byId.set(material.id, material)
      if (material.materialCode) byCode.set(String(material.materialCode).toLowerCase(), material)
    }
    return { byId, byCode }
  }, [materials])

  const reportRows = useMemo(() => {
    const groups = new Map()

    for (const row of inventoryRows) {
      const material = materialLookup.byId.get(row.materialId) || materialLookup.byCode.get(String(row.materialCode || '').toLowerCase()) || null
      const materialCode = row.materialCode || material?.materialCode || 'NO_CODE'
      const key = String(materialCode).toLowerCase()
      const group = groups.get(key) || {
        id: key,
        materialId: row.materialId || material?.id || '',
        materialCode,
        materialName: row.materialName || material?.materialName || '',
        materialType: material?.materialType || 'MATERIAL',
        thumbnailUrl: material?.thumbnailUrl || '',
        unit: row.unit || material?.unit || '',
        quantityOnHand: 0,
        quantityTotal: 0,
        quantityReserved: 0,
        quantityLocked: 0,
        availableQuantity: 0,
        inventoryRows: 0,
        updatedInShift: 0,
        batches: new Set(),
        warehouses: new Set(),
        latestUpdatedAt: null
      }

      group.quantityOnHand += row.quantityOnHand
      group.quantityTotal += row.quantityTotal
      group.quantityReserved += row.quantityReserved
      group.quantityLocked += row.quantityLocked
      group.availableQuantity += row.availableQuantity
      group.inventoryRows += 1
      if (row.batchNo) group.batches.add(row.batchNo)
      if (row.warehouseCode) group.warehouses.add(row.warehouseCode)
      if (isInsideWindow(row.updatedAt, shiftWindow)) group.updatedInShift += 1
      group.latestUpdatedAt = latestDate(group.latestUpdatedAt, row.updatedAt)

      groups.set(key, group)
    }

    return Array.from(groups.values()).map(group => ({
      ...group,
      batchCount: group.batches.size,
      warehouseCount: group.warehouses.size,
      batchList: Array.from(group.batches).join(', '),
      warehouseList: Array.from(group.warehouses).join(', '),
      batches: undefined,
      warehouses: undefined
    }))
  }, [inventoryRows, materialLookup, shiftWindow])

  const categories = useMemo(() => {
    const values = new Set(reportRows.map(row => row.materialType || 'MATERIAL'))
    return ['ALL', ...Array.from(values).sort((a, b) => a.localeCompare(b))]
  }, [reportRows])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return reportRows.filter(row => {
      if (category !== 'ALL' && row.materialType !== category) return false
      if (!needle) return true
      return [row.materialCode, row.materialName, row.unit, row.batchList, row.warehouseList]
        .some(value => String(value || '').toLowerCase().includes(needle))
    })
  }, [reportRows, search, category])

  const totals = useMemo(() => filteredRows.reduce((acc, row) => {
    acc.quantityOnHand += row.quantityOnHand
    acc.quantityLocked += row.quantityLocked
    acc.availableQuantity += row.availableQuantity
    return acc
  }, { quantityOnHand: 0, quantityLocked: 0, availableQuantity: 0 }), [filteredRows])

  const handleExport = () => {
    const data = filteredRows.map(row => ({
      MaterialCode: row.materialCode,
      MaterialName: row.materialName,
      Category: row.materialType,
      ThumbnailUrl: row.thumbnailUrl,
      Unit: row.unit,
      QuantityOnHand: row.quantityOnHand,
      QuantityTotal: row.quantityTotal,
      QuantityReserved: row.quantityReserved,
      QuantityLocked: row.quantityLocked,
      AvailableQuantity: row.availableQuantity,
      InventoryRows: row.inventoryRows,
      BatchCount: row.batchCount,
      Batches: row.batchList,
      WarehouseCount: row.warehouseCount,
      Warehouses: row.warehouseList,
      UpdatedInShift: row.updatedInShift,
      LatestUpdatedAt: row.latestUpdatedAt
    }))
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'inventory_shift_report')
    XLSX.writeFile(workbook, `inventory_shift_report_${shiftKey}_${reportDate}.xlsx`)
  }

  const columns = [
    {
      field: 'thumbnailUrl',
      headerName: 'Image',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: (params) => params.value
        ? <Box component="img" src={params.value} alt="" sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid #d7dce1' }} />
        : <Typography variant="caption" color="text.secondary">No image</Typography>
    },
    { field: 'materialCode', headerName: 'Material Code', minWidth: 170, flex: 0.8 },
    { field: 'materialName', headerName: 'Material Name', minWidth: 220, flex: 1.2 },
    {
      field: 'materialType',
      headerName: 'Category',
      width: 140,
      renderCell: (params) => <Chip size="small" label={params.value || 'MATERIAL'} />
    },
    { field: 'unit', headerName: 'Unit', width: 100 },
    { field: 'quantityOnHand', headerName: 'On Hand', width: 140, type: 'number', valueFormatter: numFmt },
    { field: 'quantityLocked', headerName: 'Locked', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'availableQuantity', headerName: 'Available', width: 140, type: 'number', valueFormatter: numFmt },
    { field: 'quantityReserved', headerName: 'Reserved', width: 130, type: 'number', valueFormatter: numFmt },
    { field: 'quantityTotal', headerName: 'Total', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'batchCount', headerName: 'Batches', width: 110, type: 'number' },
    { field: 'warehouseCount', headerName: 'Warehouses', width: 125, type: 'number' },
    { field: 'inventoryRows', headerName: 'Rows', width: 95, type: 'number' },
    { field: 'updatedInShift', headerName: 'Updated In Shift', width: 150, type: 'number' },
    { field: 'latestUpdatedAt', headerName: 'Latest Updated', width: 190, valueFormatter: dateFmt }
  ]

  const shiftLabel = shiftWindow.start && shiftWindow.end
    ? `${dateFmt(shiftWindow.start.toISOString())} - ${dateFmt(shiftWindow.end.toISOString())}`
    : 'Custom shift window'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Inventory Shift Report</Typography>
            <Typography variant="caption" color="text.secondary">Latest live inventory grouped by material code | {shiftLabel}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Chip label={`${filteredRows.length} materials`} />
            <Chip label={`On hand ${numFmt(totals.quantityOnHand)}`} />
            <Chip label={`Available ${numFmt(totals.availableQuantity)}`} />
            <Chip label={`Locked ${numFmt(totals.quantityLocked)}`} />
            <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load} disabled={loading}>Refresh</Button>
            <Button startIcon={<DownloadIcon />} variant="contained" size="small" onClick={handleExport} disabled={filteredRows.length === 0}>Export</Button>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
          <TextField
            label="Shift"
            select
            size="small"
            value={shiftKey}
            onChange={(event) => setShiftKey(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            {SHIFT_OPTIONS.map(option => <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>)}
          </TextField>
          {shiftKey !== 'custom' ? (
            <TextField
              label="Report Date"
              type="date"
              size="small"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          ) : (
            <>
              <TextField
                label="Start"
                type="datetime-local"
                size="small"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End"
                type="datetime-local"
                size="small"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
          <TextField
            label="Category"
            select
            size="small"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            {categories.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField
            label="Search"
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 260 } }}
          />
        </Box>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          rowHeight={64}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 25 } },
            sorting: { sortModel: [{ field: 'materialCode', sort: 'asc' }] }
          }}
          sx={{
            height: '100%',
            '& .MuiDataGrid-cell': { borderRight: '1px solid #e6e8eb' },
            '& .MuiDataGrid-row': { borderBottom: '1px solid #eef0f2' }
          }}
          disableRowSelectionOnClick
        />
      </Box>
    </Box>
  )
}