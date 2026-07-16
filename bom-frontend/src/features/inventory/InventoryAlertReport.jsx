import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DownloadIcon from '@mui/icons-material/Download'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import * as XLSX from 'xlsx'
import { fetchInventoryAlertReport } from '../../api/inventoryApi'
import { dateFmt, numFmt } from '../../utils/format'

const FORECAST_MODES = [
  { value: 'DAILY_AVG', label: 'Daily Avg' },
  { value: 'SAME_WEEKDAY', label: 'Same Weekday' },
  { value: 'WEEKEND_PATTERN', label: 'Weekend Pattern' }
]

const STATUS_OPTIONS = [
  { value: 'PROBLEM', label: 'Needs Action' },
  { value: 'ALL', label: 'All' },
  { value: 'SHORT', label: 'Forecast Short' },
  { value: 'LOW', label: 'Low Stock' },
  { value: 'OK', label: 'OK' }
]

function dateInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function defaultTargetDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
}

function asNumber(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function materialStatus(row) {
  if (row.forecastShortage) return 'SHORT'
  if (row.lowStockAlert) return 'LOW'
  return 'OK'
}

function statusChip(status) {
  if (status === 'SHORT') return <Chip size="small" color="error" label="Short" />
  if (status === 'LOW') return <Chip size="small" color="warning" label="Low" />
  if (status === 'EXPIRED') return <Chip size="small" color="error" label="Expired" />
  if (status === 'EXPIRING') return <Chip size="small" color="warning" label="Expiring" />
  return <Chip size="small" color="success" label="OK" />
}

function normalizeMaterialRow(row) {
  const status = materialStatus(row)
  return {
    id: row.materialId || row.materialCode || row.materialName || Math.random().toString(36),
    ...row,
    status,
    sortSeverity: status === 'SHORT' ? 2 : status === 'LOW' ? 1 : 0
  }
}

function normalizeExpirationRow(row) {
  return {
    id: row.inventoryId || `${row.materialId || row.materialCode}-${row.batchNo || ''}`,
    ...row
  }
}

export default function InventoryAlertReport() {
  const [targetDate, setTargetDate] = useState(defaultTargetDate)
  const [lookbackDays, setLookbackDays] = useState(28)
  const [forecastDays, setForecastDays] = useState(1)
  const [forecastMode, setForecastMode] = useState('DAILY_AVG')
  const [expirationDays, setExpirationDays] = useState(30)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshSeconds, setRefreshSeconds] = useState(60)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('PROBLEM')
  const [report, setReport] = useState({ materialRows: [], expirationRows: [], summary: {} })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchInventoryAlertReport({
        targetDate,
        lookbackDays,
        forecastDays,
        forecastMode,
        expirationDays
      })
      setReport(data || { materialRows: [], expirationRows: [], summary: {} })
    } catch (err) {
      setError(err?.message || 'Failed to load inventory alert report')
      setReport({ materialRows: [], expirationRows: [], summary: {} })
    } finally {
      setLoading(false)
    }
  }, [expirationDays, forecastDays, forecastMode, lookbackDays, targetDate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const interval = window.setInterval(() => {
      load()
    }, Math.max(15, Number(refreshSeconds) || 60) * 1000)
    return () => window.clearInterval(interval)
  }, [autoRefresh, load, refreshSeconds])

  const materialRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (Array.isArray(report.materialRows) ? report.materialRows : [])
      .map(normalizeMaterialRow)
      .filter(row => {
        if (statusFilter === 'PROBLEM' && row.status === 'OK') return false
        if (statusFilter !== 'ALL' && statusFilter !== 'PROBLEM' && row.status !== statusFilter) return false
        if (!needle) return true
        return [row.materialCode, row.materialName, row.unit, row.lowStockReason, row.forecastBasis]
          .some(value => String(value || '').toLowerCase().includes(needle))
      })
  }, [report.materialRows, search, statusFilter])

  const expirationRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (Array.isArray(report.expirationRows) ? report.expirationRows : [])
      .map(normalizeExpirationRow)
      .filter(row => {
        if (!needle) return true
        return [row.materialCode, row.materialName, row.batchNo, row.warehouseCode, row.status]
          .some(value => String(value || '').toLowerCase().includes(needle))
      })
  }, [report.expirationRows, search])

  const totals = useMemo(() => materialRows.reduce((acc, row) => {
    acc.netAvailableQty += asNumber(row.netAvailableQty)
    acc.forecastQty += asNumber(row.forecastQty)
    acc.forecastShortageQty += asNumber(row.forecastShortageQty)
    return acc
  }, { netAvailableQty: 0, forecastQty: 0, forecastShortageQty: 0 }), [materialRows])

  const handleExport = () => {
    const materialData = materialRows.map(row => ({
      Status: row.status,
      MaterialCode: row.materialCode,
      MaterialName: row.materialName,
      Unit: row.unit,
      OnHand: row.quantityOnHand,
      Locked: row.quantityLocked,
      Available: row.availableQty,
      OpenDemand: row.committedQty,
      NetAvailable: row.netAvailableQty,
      QuantityTotal: row.quantityTotal,
      AvailablePercentage: row.availablePercentage,
      AlertEnabled: row.inventoryAlertEnabled,
      AlertQuantity: row.inventoryAlertQuantity,
      AlertPercentage: row.inventoryAlertPercentage,
      ForecastQty: row.forecastQty,
      ForecastShortage: row.forecastShortageQty,
      HistoricalUsage: row.historicalUsageQty,
      SampleDays: row.sampleDays,
      SourceDaysWithUsage: row.sourceDaysWithUsage,
      ForecastBasis: row.forecastBasis,
      BatchCount: row.batchCount
    }))
    const expirationData = expirationRows.map(row => ({
      Status: row.status,
      MaterialCode: row.materialCode,
      MaterialName: row.materialName,
      Unit: row.unit,
      WarehouseCode: row.warehouseCode,
      WarehouseName: row.warehouseName,
      BatchNo: row.batchNo,
      QuantityOnHand: row.quantityOnHand,
      Available: row.availableQty,
      Expiration: row.expirationDateTime,
      DaysUntilExpiration: row.daysUntilExpiration
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(materialData), 'material_alerts')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(expirationData), 'expiration')
    XLSX.writeFile(workbook, `inventory_alert_report_${targetDate || dateInputValue()}.xlsx`)
  }

  const materialColumns = [
    {
      field: 'status',
      headerName: 'Status',
      width: 105,
      renderCell: (params) => statusChip(params.value),
      sortComparator: (a, b) => {
        const score = (value) => value === 'SHORT' ? 2 : value === 'LOW' ? 1 : 0
        return score(a) - score(b)
      }
    },
    { field: 'materialCode', headerName: 'Material Code', minWidth: 160, flex: 0.8 },
    { field: 'materialName', headerName: 'Material Name', minWidth: 220, flex: 1.1 },
    { field: 'unit', headerName: 'Unit', width: 90 },
    { field: 'netAvailableQty', headerName: 'Net Available', width: 140, type: 'number', valueFormatter: numFmt },
    { field: 'forecastQty', headerName: 'Forecast Need', width: 140, type: 'number', valueFormatter: numFmt },
    { field: 'forecastShortageQty', headerName: 'Short Qty', width: 125, type: 'number', valueFormatter: numFmt },
    { field: 'availableQty', headerName: 'Available', width: 125, type: 'number', valueFormatter: numFmt },
    { field: 'committedQty', headerName: 'Open Demand', width: 135, type: 'number', valueFormatter: numFmt },
    { field: 'quantityOnHand', headerName: 'On Hand', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'quantityLocked', headerName: 'Locked', width: 110, type: 'number', valueFormatter: numFmt },
    { field: 'quantityTotal', headerName: 'Total', width: 110, type: 'number', valueFormatter: numFmt },
    { field: 'availablePercentage', headerName: 'Avail %', width: 110, type: 'number', valueFormatter: numFmt },
    { field: 'inventoryAlertQuantity', headerName: 'Alert Qty', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'inventoryAlertPercentage', headerName: 'Alert %', width: 110, type: 'number', valueFormatter: numFmt },
    { field: 'historicalUsageQty', headerName: 'History Qty', width: 125, type: 'number', valueFormatter: numFmt },
    { field: 'sampleDays', headerName: 'Sample Days', width: 115, type: 'number' },
    { field: 'sourceDaysWithUsage', headerName: 'Used Days', width: 105, type: 'number' },
    { field: 'forecastBasis', headerName: 'Basis', width: 150 },
    { field: 'batchCount', headerName: 'Batches', width: 100, type: 'number' }
  ]

  const expirationColumns = [
    {
      field: 'status',
      headerName: 'Status',
      width: 105,
      renderCell: (params) => statusChip(params.value)
    },
    { field: 'materialCode', headerName: 'Material Code', minWidth: 160, flex: 0.8 },
    { field: 'materialName', headerName: 'Material Name', minWidth: 220, flex: 1.1 },
    { field: 'unit', headerName: 'Unit', width: 90 },
    { field: 'warehouseCode', headerName: 'Warehouse', width: 130 },
    { field: 'batchNo', headerName: 'Batch', width: 170 },
    { field: 'quantityOnHand', headerName: 'On Hand', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'availableQty', headerName: 'Available', width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'expirationDateTime', headerName: 'Expiration', width: 180, valueFormatter: dateFmt },
    { field: 'daysUntilExpiration', headerName: 'Days Left', width: 115, type: 'number' }
  ]

  const summary = report.summary || {}
  const generatedText = report.generatedAt ? dateFmt(report.generatedAt) : ''

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon color={asNumber(summary.forecastShortageCount) || asNumber(summary.lowStockCount) ? 'warning' : 'success'} />
            <Box>
              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Inventory Alerts</Typography>
              <Typography variant="caption" color="text.secondary">{generatedText ? `Updated ${generatedText}` : 'Not loaded'}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Chip label={`${summary.lowStockCount || 0} low`} color={summary.lowStockCount ? 'warning' : 'default'} />
            <Chip label={`${summary.forecastShortageCount || 0} forecast short`} color={summary.forecastShortageCount ? 'error' : 'default'} />
            <Chip label={`${summary.expiringBatchCount || 0} expiring`} color={summary.expiringBatchCount ? 'warning' : 'default'} />
            <Chip label={`Net ${numFmt(totals.netAvailableQty)}`} />
            <Chip label={`Need ${numFmt(totals.forecastQty)}`} />
            <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load} disabled={loading}>Refresh</Button>
            <Button startIcon={<DownloadIcon />} variant="contained" size="small" onClick={handleExport}>Export</Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mt: 1.25 }} onClose={() => setError('')}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
          <TextField label="Target Date" type="date" size="small" value={targetDate} onChange={e => setTargetDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Lookback Days" type="number" size="small" value={lookbackDays} onChange={e => setLookbackDays(e.target.value)} inputProps={{ min: 1, max: 365 }} sx={{ width: 135 }} />
          <TextField label="Forecast Days" type="number" size="small" value={forecastDays} onChange={e => setForecastDays(e.target.value)} inputProps={{ min: 1, max: 30 }} sx={{ width: 135 }} />
          <TextField label="Forecast Mode" select size="small" value={forecastMode} onChange={e => setForecastMode(e.target.value)} sx={{ minWidth: 170 }}>
            {FORECAST_MODES.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField label="Expiration Days" type="number" size="small" value={expirationDays} onChange={e => setExpirationDays(e.target.value)} inputProps={{ min: 0, max: 3650 }} sx={{ width: 150 }} />
          <TextField label="Status" select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
            {STATUS_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField label="Search" size="small" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 240 } }} />
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />}
            label="Auto Refresh"
          />
          <TextField label="Every" select size="small" value={refreshSeconds} onChange={e => setRefreshSeconds(Number(e.target.value))} disabled={!autoRefresh} sx={{ width: 105 }}>
            {[30, 60, 120, 300].map(value => <MenuItem key={value} value={value}>{value}s</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      <Box sx={{ flex: 1.15, minHeight: 0 }}>
        <DataGrid
          rows={materialRows}
          columns={materialColumns}
          loading={loading}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 25 } },
            sorting: { sortModel: [{ field: 'status', sort: 'desc' }, { field: 'forecastShortageQty', sort: 'desc' }] }
          }}
          sx={{
            height: '100%',
            '& .MuiDataGrid-cell': { borderRight: '1px solid #e6e8eb' },
            '& .MuiDataGrid-row': { borderBottom: '1px solid #eef0f2' }
          }}
          disableRowSelectionOnClick
        />
      </Box>

      <Paper variant="outlined" sx={{ px: 1.5, py: 0.75, borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={800}>Expiration Report</Typography>
      </Paper>
      <Box sx={{ flex: 0.85, minHeight: 0 }}>
        <DataGrid
          rows={expirationRows}
          columns={expirationColumns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { page: 0, pageSize: 10 } },
            sorting: { sortModel: [{ field: 'daysUntilExpiration', sort: 'asc' }] }
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
