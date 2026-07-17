import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import RefreshIcon from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import * as XLSX from 'xlsx'
import { fetchSalesIncomeReport } from '../../api/shopApi'
import { useI18n } from '../../i18n/I18nContext'

const PERIODS = [
  { value: 'DAY', label: 'Day' },
  { value: 'MONTH', label: 'Month' },
  { value: 'QUARTER', label: 'Quarter' },
  { value: 'YEAR', label: 'Year' },
]

const emptyReport = {
  summary: {},
  periodRows: [],
  orderRows: [],
  deductionRows: [],
}

function todayInput() {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

async function apiData(call, fallbackMessage) {
  const { res, data } = await call
  if (!res.ok) throw new Error(data?.error || data?.message || fallbackMessage)
  return data
}

function asNumber(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function orderLabel(row) {
  if (row?.orderNumber != null) return `#${row.orderNumber}`
  return row?.orderCode || '-'
}

function statusColor(status) {
  if (status === 'PAID' || status === 'COMPLETED' || status === 'DEDUCTED') return 'success'
  if (status === 'WAITING_STOCK' || status === 'UNPAID') return 'warning'
  if (status === 'CANCELLED') return 'error'
  return 'default'
}

function StatTile({ icon, label, value, tone = 'default' }) {
  const color = tone === 'good' ? 'success.dark' : tone === 'bad' ? 'error.dark' : 'text.primary'
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fff', minWidth: 180 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', mb: 0.75 }}>
        {icon}
        <Typography variant="caption" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 0 }}>{label}</Typography>
      </Stack>
      <Typography variant="h6" fontWeight={900} sx={{ color, lineHeight: 1.15 }}>{value}</Typography>
    </Box>
  )
}

function EmptyRow({ colSpan, children }) {
  return <TableRow><TableCell colSpan={colSpan} align="center" sx={{ py: 4, color: 'text.secondary' }}>{children}</TableCell></TableRow>
}

export default function ShopSalesReportPage() {
  const { formatMoney, formatNumber, formatDateTime } = useI18n()
  const [from, setFrom] = useState(todayInput())
  const [to, setTo] = useState(todayInput())
  const [period, setPeriod] = useState('DAY')
  const [search, setSearch] = useState('')
  const [report, setReport] = useState(emptyReport)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fmtMoney = useCallback((value) => formatMoney(asNumber(value), 'VND'), [formatMoney])
  const fmtNum = useCallback((value, options = {}) => formatNumber(asNumber(value), options), [formatNumber])
  const fmtDate = useCallback((value) => value ? formatDateTime(value, { dateStyle: 'short', timeStyle: 'short' }) : '-', [formatDateTime])
  const exportDate = useCallback((value) => value ? formatDateTime(value, { dateStyle: 'medium', timeStyle: 'medium' }) : '', [formatDateTime])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiData(fetchSalesIncomeReport({ from, to, period }), 'Failed to load sales report')
      setReport(data || emptyReport)
    } catch (e) {
      setError(e.message || 'Failed to load sales report')
      setReport(emptyReport)
    } finally {
      setLoading(false)
    }
  }, [from, period, to])

  useEffect(() => { load() }, [load])

  const summary = report.summary || {}
  const periodRows = Array.isArray(report.periodRows) ? report.periodRows : []
  const orderRows = Array.isArray(report.orderRows) ? report.orderRows : []
  const deductionRows = Array.isArray(report.deductionRows) ? report.deductionRows : []

  const filteredDeductionRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return deductionRows
    return deductionRows.filter(row => [
      row.orderCode,
      row.orderNumber,
      row.modelName,
      row.materialCode,
      row.materialName,
      row.batchNo,
      row.auditStatus,
      row.paymentStatus,
    ].some(value => String(value ?? '').toLowerCase().includes(needle)))
  }, [deductionRows, search])

  const handleExport = () => {
    const workbook = XLSX.utils.book_new()
    const summaryRows = [{
      From: report.from || from,
      To: report.to || to,
      Period: report.period || period,
      TimeZone: report.timeZone || '',
      GeneratedAt: exportDate(report.generatedAt),
      Orders: summary.orderCount || 0,
      PaidOrders: summary.paidOrderCount || 0,
      LineCount: summary.lineCount || 0,
      ItemQuantity: summary.itemQuantity || 0,
      GrossSales: summary.grossSales || 0,
      DiscountAmount: summary.discountAmount || 0,
      DeliveryFee: summary.deliveryFee || 0,
      NetSales: summary.netSales || 0,
      RawCost: summary.rawCost || 0,
      Income: summary.income || 0,
      DeductionRows: summary.deductionCount || 0,
      InventoryMovements: summary.movementCount || 0,
    }]
    const periodData = periodRows.map(row => ({
      Period: row.periodLabel,
      From: row.from,
      To: row.to,
      Orders: row.orderCount,
      PaidOrders: row.paidOrderCount,
      LineCount: row.lineCount,
      ItemQuantity: row.itemQuantity,
      GrossSales: row.grossSales,
      DiscountAmount: row.discountAmount,
      DeliveryFee: row.deliveryFee,
      NetSales: row.netSales,
      RawCost: row.rawCost,
      Income: row.income,
      DeductionRows: row.deductionCount,
      InventoryMovements: row.movementCount,
    }))
    const orderData = orderRows.map(row => ({
      Order: orderLabel(row),
      OrderCode: row.orderCode,
      CreatedAt: exportDate(row.createdAt),
      CompletedAt: exportDate(row.completedAt),
      Status: row.status,
      PaymentStatus: row.paymentStatus,
      PaymentMethod: row.paymentMethod,
      LineCount: row.lineCount,
      ItemQuantity: row.itemQuantity,
      GrossSales: row.grossSales,
      DiscountAmount: row.discountAmount,
      DeliveryFee: row.deliveryFee,
      NetSales: row.netSales,
      RawCost: row.rawCost,
      Income: row.income,
      MaterialAuditStatus: row.materialAuditStatus,
      MaterialDeductedAt: exportDate(row.materialDeductedAt),
      DeductionRows: row.deductionCount,
      InventoryMovements: row.movementCount,
    }))
    const deductionData = deductionRows.map(row => ({
      Order: orderLabel(row),
      OrderCode: row.orderCode,
      OrderCreatedAt: exportDate(row.orderCreatedAt),
      OrderStatus: row.orderStatus,
      PaymentStatus: row.paymentStatus,
      MaterialDeductedAt: exportDate(row.materialDeductedAt),
      ItemName: row.modelName,
      ItemQuantity: row.itemQuantity,
      ItemUnitPrice: row.itemUnitPrice,
      ItemSaleAmount: row.itemSaleAmount,
      ItemUnitRawCost: row.itemUnitRawCost,
      ItemRawCost: row.itemRawCost,
      ItemIncome: row.itemIncome,
      MaterialCode: row.materialCode,
      MaterialName: row.materialName,
      MaterialUnit: row.materialUnit,
      RequiredQty: row.requiredQty,
      DeductedQty: row.deductedQty,
      WaitingQty: row.waitingQty,
      AuditStatus: row.auditStatus,
      AuditCreatedAt: exportDate(row.auditCreatedAt),
      BatchNo: row.batchNo,
      MovementQty: row.movementQty,
      MovementUnit: row.movementUnit,
      MovementType: row.movementType,
      MovementCreatedAt: exportDate(row.movementCreatedAt),
      InventoryUnitPrice: row.inventoryUnitPrice,
      InventoryCurrency: row.inventoryCurrency,
      InventoryCostAmount: row.inventoryCostAmount,
      OrderGrossSales: row.orderGrossSales,
      OrderDiscountAmount: row.orderDiscountAmount,
      OrderNetSales: row.orderNetSales,
      OrderRawCost: row.orderRawCost,
      OrderIncome: row.orderIncome,
    }))

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(periodData), 'Periods')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(orderData), 'Orders')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(deductionData), 'Inventory Deductions')
    XLSX.writeFile(workbook, `shop_sales_income_${from}_${to}_${period.toLowerCase()}.xlsx`)
  }

  const incomeTone = asNumber(summary.income) < 0 ? 'bad' : 'good'

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, bgcolor: '#f6f8fb', minHeight: '100%' }}>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <AssessmentIcon color="primary" />
              <Typography variant="h6" fontWeight={900}>Sales & Income Report</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">Sales totals, raw cost, income, and inventory deduction detail</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField size="small" select label="Group" value={period} onChange={e => setPeriod(e.target.value)} sx={{ minWidth: 130 }}>
              {PERIODS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
            <TextField size="small" type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
            <TextField size="small" type="date" label="To" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
            <Button variant="outlined" onClick={load} disabled={loading} startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}>Refresh</Button>
            <Button variant="contained" onClick={handleExport} disabled={loading} startIcon={<FileDownloadIcon />}>Download</Button>
          </Stack>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.25, mb: 2 }}>
        <StatTile icon={<ReceiptLongIcon fontSize="small" />} label="Orders" value={fmtNum(summary.orderCount || 0)} />
        <StatTile icon={<AttachMoneyIcon fontSize="small" />} label="Net sales" value={fmtMoney(summary.netSales || 0)} />
        <StatTile icon={<Inventory2Icon fontSize="small" />} label="Raw cost" value={fmtMoney(summary.rawCost || 0)} />
        <StatTile icon={<TrendingUpIcon fontSize="small" />} label="Income" value={fmtMoney(summary.income || 0)} tone={incomeTone} />
        <StatTile icon={<Inventory2Icon fontSize="small" />} label="Inventory moves" value={fmtNum(summary.movementCount || 0)} />
      </Box>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography fontWeight={900}>Grouped Sales</Typography>
          <Chip size="small" label={`${report.period || period} / ${report.timeZone || 'local'}`} variant="outlined" />
        </Stack>
        <TableContainer sx={{ maxHeight: 320 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell align="right">Orders</TableCell>
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Net sales</TableCell>
                <TableCell align="right">Raw cost</TableCell>
                <TableCell align="right">Income</TableCell>
                <TableCell align="right">Moves</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && periodRows.length === 0 && <EmptyRow colSpan={7}><CircularProgress size={24} /></EmptyRow>}
              {!loading && periodRows.length === 0 && <EmptyRow colSpan={7}>No sales found for this period</EmptyRow>}
              {periodRows.map(row => (
                <TableRow key={row.periodKey} hover>
                  <TableCell>
                    <Typography fontWeight={800}>{row.periodLabel}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.from} - {row.to}</Typography>
                  </TableCell>
                  <TableCell align="right">{fmtNum(row.orderCount)}</TableCell>
                  <TableCell align="right">{fmtNum(row.paidOrderCount)}</TableCell>
                  <TableCell align="right">{fmtMoney(row.netSales)}</TableCell>
                  <TableCell align="right">{fmtMoney(row.rawCost)}</TableCell>
                  <TableCell align="right" sx={{ color: asNumber(row.income) < 0 ? 'error.main' : 'success.dark', fontWeight: 900 }}>{fmtMoney(row.income)}</TableCell>
                  <TableCell align="right">{fmtNum(row.movementCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'minmax(440px, 0.9fr) minmax(0, 1.35fr)' }, gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography fontWeight={900} sx={{ mb: 1 }}>Orders</Typography>
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="right">Net sales</TableCell>
                  <TableCell align="right">Income</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && orderRows.length === 0 && <EmptyRow colSpan={4}><CircularProgress size={24} /></EmptyRow>}
                {!loading && orderRows.length === 0 && <EmptyRow colSpan={4}>No orders found</EmptyRow>}
                {orderRows.map(row => (
                  <TableRow key={row.orderId} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{orderLabel(row)}</Typography>
                      <Typography variant="caption" color="text.secondary">{fmtDate(row.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Chip size="small" label={row.paymentStatus || '-'} color={statusColor(row.paymentStatus)} variant="outlined" />
                        <Typography variant="caption" color="text.secondary">{row.status || '-'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{fmtMoney(row.netSales)}</TableCell>
                    <TableCell align="right" sx={{ color: asNumber(row.income) < 0 ? 'error.main' : 'success.dark', fontWeight: 900 }}>{fmtMoney(row.income)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
            <Box>
              <Typography fontWeight={900}>Inventory Deductions</Typography>
              <Typography variant="caption" color="text.secondary">Full rows are included in the download</Typography>
            </Box>
            <TextField size="small" label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ minWidth: 260 }} />
          </Stack>
          <Divider sx={{ mb: 1 }} />
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Order / item</TableCell>
                  <TableCell>Material</TableCell>
                  <TableCell align="right">Deducted</TableCell>
                  <TableCell align="right">Sale</TableCell>
                  <TableCell align="right">Income</TableCell>
                  <TableCell>Batch</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && filteredDeductionRows.length === 0 && <EmptyRow colSpan={6}><CircularProgress size={24} /></EmptyRow>}
                {!loading && filteredDeductionRows.length === 0 && <EmptyRow colSpan={6}>No inventory deduction rows found</EmptyRow>}
                {filteredDeductionRows.map((row, index) => (
                  <TableRow key={`${row.auditId || 'move'}-${row.inventoryMovementId || index}`} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{orderLabel(row)}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.modelName || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={800}>{row.materialCode || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.materialName || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={800}>{fmtNum(row.deductedQty ?? row.movementQty, { maximumFractionDigits: 4 })}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.materialUnit || row.movementUnit || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">{row.itemSaleAmount == null ? '-' : fmtMoney(row.itemSaleAmount)}</TableCell>
                    <TableCell align="right" sx={{ color: asNumber(row.itemIncome) < 0 ? 'error.main' : 'success.dark', fontWeight: 900 }}>
                      {row.itemIncome == null ? '-' : fmtMoney(row.itemIncome)}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={800}>{row.batchNo || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.inventoryCostAmount == null ? '' : fmtMoney(row.inventoryCostAmount)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  )
}