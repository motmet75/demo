import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import SaveIcon from '@mui/icons-material/Save'
import { fetchMaterialAuditOpen, fetchMenuAvailability, fetchShopOrders } from '../../api/shopApi'
import { fetchInventoryView } from '../../api/inventoryApi'
import { useI18n } from '../../i18n/I18nContext'

const HANDOVER_STORAGE_KEY = 'shop.shiftAudit.lastHandover'
const LOW_MENU_THRESHOLD = 3

const SHIFT_I18N = { custom: 'shopOrder.eod.customTime', two_day: 'shopOrder.eod.twoDay', two_night: 'shopOrder.eod.twoNight', morning: 'shopOrder.eod.threeMorning', afternoon: 'shopOrder.eod.threeAfternoon', night: 'shopOrder.eod.threeNight', four_early: 'shopOrder.eod.fourEarly', four_morning: 'shopOrder.eod.fourMorning', four_afternoon: 'shopOrder.eod.fourAfternoon', four_evening: 'shopOrder.eod.fourEvening' }

const SHIFT_OPTIONS = [
  { key: 'custom', label: 'Custom time' },
  { key: 'two_day', label: '2 shifts: Day 06:00-18:00', startHour: 6, endHour: 18 },
  { key: 'two_night', label: '2 shifts: Night 18:00-06:00', startHour: 18, endHour: 6 },
  { key: 'morning', label: '3 shifts: Morning 06:00-14:00', startHour: 6, endHour: 14 },
  { key: 'afternoon', label: '3 shifts: Afternoon 14:00-22:00', startHour: 14, endHour: 22 },
  { key: 'night', label: '3 shifts: Night 22:00-06:00', startHour: 22, endHour: 6 },
  { key: 'four_early', label: '4 shifts: 00:00-06:00', startHour: 0, endHour: 6 },
  { key: 'four_morning', label: '4 shifts: 06:00-12:00', startHour: 6, endHour: 12 },
  { key: 'four_afternoon', label: '4 shifts: 12:00-18:00', startHour: 12, endHour: 18 },
  { key: 'four_evening', label: '4 shifts: 18:00-00:00', startHour: 18, endHour: 24 },
]

const fmt = (n) => n != null ? `${Number(n).toLocaleString('vi-VN')} VND` : '0 VND'
const qtyFmt = (n) => Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const fmtDots = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripDigits = (s) => s.replace(/[^0-9]/g, '')
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))
const splitCashPortion = (order) => Math.max(0, Math.min(Number(order?.splitCashAmount || 0), payableAmount(order)))
const billNetAmount = (bill) => Math.max(0, Number(bill?.netAmount ?? (Number(bill?.totalAmount || 0) - Number(bill?.discountAmount || 0))))
const billGrossAmount = (bill) => Number(bill?.totalAmount || 0)
const billRawCost = (bill) => Number(bill?.totalRawCost || 0)

function localDateTimeStr(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function localDateStr(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  return localDateTimeStr(d)
}
function todayEnd() {
  const d = new Date(); d.setHours(23, 59, 0, 0)
  return localDateTimeStr(d)
}
function getSavedHandover() {
  try {
    const raw = localStorage.getItem(HANDOVER_STORAGE_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return parsed?.toTime || ''
  } catch {
    return ''
  }
}
function defaultShiftStart() {
  return getSavedHandover() || todayStart()
}
function shiftTimesFor(key, dateValue) {
  const option = SHIFT_OPTIONS.find(item => item.key === key)
  if (!option || option.key === 'custom') return null
  const [year, month, day] = String(dateValue || localDateStr(new Date())).split('-').map(Number)
  const start = new Date(year, month - 1, day, option.startHour, 0, 0, 0)
  const end = new Date(year, month - 1, day, option.endHour, 0, 0, 0)
  if (option.endHour <= option.startHour) end.setDate(end.getDate() + 1)
  return { from: localDateTimeStr(start), to: localDateTimeStr(end), label: option.label }
}
function asList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.data?.data)) return result.data.data
  return []
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
    materialCode: item.materialCode ?? item.material_code ?? item.material?.materialCode ?? '',
    materialName: item.materialName ?? item.material_name ?? item.material?.materialName ?? '',
    batchNo: item.batchNo ?? item.batch_no ?? '',
    warehouseCode: item.warehouseCode ?? item.warehouse_code ?? item.warehouse?.code ?? '',
    quantityOnHand,
    quantityLocked,
    availableQuantity: asNumber(item.availableQuantity ?? Math.max(quantityOnHand - quantityLocked, 0)),
    updatedAt: item.updatedAt ?? item.modifiedTime ?? item.createdAt ?? null,
  }
}
function isInsideWindow(value, from, to) {
  if (!value || !from || !to) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date >= from && date <= to
}
function summarizeInventory(rows, from, to) {
  const normalized = (Array.isArray(rows) ? rows : []).map(normalizeInventory).filter(Boolean)
  const groups = new Map()
  normalized.forEach(row => {
    const key = String(row.materialCode || row.materialName || 'NO_CODE').toLowerCase()
    const group = groups.get(key) || {
      materialCode: row.materialCode || 'NO_CODE',
      materialName: row.materialName || '',
      availableQuantity: 0,
      quantityOnHand: 0,
      quantityLocked: 0,
      rows: 0,
    }
    group.availableQuantity += row.availableQuantity
    group.quantityOnHand += row.quantityOnHand
    group.quantityLocked += row.quantityLocked
    group.rows += 1
    groups.set(key, group)
  })
  const materials = Array.from(groups.values())
  const outMaterials = materials
    .filter(row => row.availableQuantity <= 0)
    .sort((a, b) => a.availableQuantity - b.availableQuantity)
    .slice(0, 5)
  return {
    rows: normalized.length,
    materialCount: materials.length,
    quantityOnHand: materials.reduce((sum, row) => sum + row.quantityOnHand, 0),
    availableQuantity: materials.reduce((sum, row) => sum + row.availableQuantity, 0),
    lockedQuantity: materials.reduce((sum, row) => sum + row.quantityLocked, 0),
    updatedInShift: normalized.filter(row => isInsideWindow(row.updatedAt, from, to)).length,
    outMaterials,
  }
}
function summarizeOpenAudit(rows) {
  const list = Array.isArray(rows) ? rows : []
  const statusCounts = {}
  const orderIds = new Set()
  let waitingQty = 0
  list.forEach(row => {
    const status = row.status || 'OPEN'
    statusCounts[status] = (statusCounts[status] || 0) + 1
    if (row.orderId) orderIds.add(row.orderId)
    waitingQty += asNumber(row.waitingQty)
  })
  return { rows: list.length, affectedOrders: orderIds.size, waitingQty, statusCounts }
}
function summarizeMenuAvailability(rows) {
  const list = Array.isArray(rows) ? rows : []
  const hasBom = list.filter(row => row.hasBom)
  const out = hasBom.filter(row => asNumber(row.effectiveAvailableUnits) <= 0)
  const low = hasBom.filter(row => {
    const units = asNumber(row.effectiveAvailableUnits)
    return units > 0 && units <= LOW_MENU_THRESHOLD
  })
  const lowRows = [...out, ...low]
    .sort((a, b) => asNumber(a.effectiveAvailableUnits) - asNumber(b.effectiveAvailableUnits))
    .slice(0, 5)
  return {
    menuCount: list.length,
    outCount: out.length,
    lowCount: low.length,
    noBomCount: list.length - hasBom.length,
    lowRows,
  }
}
function latestBillOrOrderTime(orders) {
  let latest = null
  ;(Array.isArray(orders) ? orders : []).forEach(order => {
    const candidates = [
      order.createdAt,
      order.confirmedAt,
      order.completedAt,
      ...((order.bills || []).map(bill => bill.createdAt)),
    ]
    candidates.forEach(value => {
      if (!value) return
      const date = new Date(value)
      if (!Number.isNaN(date.getTime()) && (!latest || date > latest)) latest = date
    })
  })
  return latest
}

export default function EodAuditDialog({ open, onClose }) {
  const { t } = useI18n()
  const [shiftDate, setShiftDate] = useState(() => localDateStr(new Date()))
  const [shiftKey, setShiftKey] = useState('custom')
  const [shiftName, setShiftName] = useState('Shift')
  const [fromTime, setFromTime] = useState(defaultShiftStart)
  const [toTime, setToTime] = useState(todayEnd)
  const [fromCode, setFromCode] = useState('')
  const [toCode, setToCode] = useState('')
  const [preCashDigits, setPreCashDigits] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastOrderLoading, setLastOrderLoading] = useState(false)
  const [error, setError] = useState('')
  const [handoverSaved, setHandoverSaved] = useState(false)
  const [result, setResult] = useState(null)

  const applyShiftPreset = (key, dateValue = shiftDate) => {
    setShiftKey(key)
    const times = shiftTimesFor(key, dateValue)
    if (!times) return
    setFromTime(times.from)
    setToTime(times.to)
    setShiftName(times.label.replace(/^\d shifts: /, ''))
  }

  const handleShiftDateChange = (value) => {
    setShiftDate(value)
    if (shiftKey !== 'custom') {
      const times = shiftTimesFor(shiftKey, value)
      if (times) {
        setFromTime(times.from)
        setToTime(times.to)
      }
    }
  }

  const handleUseLastHandover = () => {
    const saved = getSavedHandover()
    if (saved) {
      setFromTime(saved)
      setShiftKey('custom')
    }
  }

  const handleUseLastOrderTime = async () => {
    setLastOrderLoading(true)
    setError('')
    try {
      const { data } = await fetchShopOrders(null)
      const latest = latestBillOrOrderTime(Array.isArray(data) ? data : [])
      if (latest) {
        setToTime(localDateTimeStr(latest))
        setShiftKey('custom')
      } else {
        setError(t('shopOrder.eod.noOrderTime'))
      }
    } catch (e) {
      setError(e.message || t('shopOrder.eod.lastOrderFailed'))
    } finally {
      setLastOrderLoading(false)
    }
  }

  const handleLoad = async () => {
    setLoading(true); setError(''); setResult(null); setHandoverSaved(false)
    try {
      const [ordersResult, openAuditResult, menuAvailabilityResult, inventoryRows] = await Promise.all([
        fetchShopOrders(null),
        fetchMaterialAuditOpen(),
        fetchMenuAvailability(),
        fetchInventoryView(),
      ])
      const all = Array.isArray(ordersResult?.data) ? ordersResult.data : []

      const from = fromTime ? new Date(fromTime) : null
      const to = toTime ? new Date(toTime) : null
      if (from && Number.isNaN(from.getTime())) throw new Error(t('shopOrder.eod.invalidStart'))
      if (to && Number.isNaN(to.getTime())) throw new Error(t('shopOrder.eod.invalidEnd'))
      if (from && to && from > to) throw new Error(t('shopOrder.eod.invalidRange'))

      const fc = fromCode.trim()
      const tc = toCode.trim()
      const codeFilteredOrders = all.filter(o => {
        if (o.status === 'CANCELLED') return false
        if (fc && o.orderCode && o.orderCode < fc) return false
        if (tc && o.orderCode && o.orderCode > tc) return false
        return true
      })

      const billRows = codeFilteredOrders.flatMap(o => {
        const activeBills = (o.bills || []).filter(b => b.status === 'ACTIVE')
        const sourceBills = activeBills.length ? activeBills : [{
          id: o.id,
          billNumber: 1,
          totalAmount: o.totalAmount,
          totalRawCost: o.totalRawCost,
          discountAmount: o.discountAmount,
          netAmount: payableAmount(o),
          createdAt: o.createdAt,
        }]
        const orderNet = payableAmount(o)
        const orderSplitCash = splitCashPortion(o)
        return sourceBills.map(b => {
          const net = billNetAmount(b)
          const share = orderNet > 0 ? net / orderNet : 0
          return {
            order: o,
            bill: b,
            net,
            gross: billGrossAmount(b),
            raw: billRawCost(b),
            splitCashShare: Math.max(0, Math.min(net, orderSplitCash * share)),
            createdAt: b.createdAt || o.createdAt,
          }
        })
      }).filter(row => {
        const t = new Date(row.createdAt)
        if (from && t < from) return false
        if (to && t > to) return false
        return true
      })

      const shiftedOrderIds = new Set(billRows.map(row => row.order.id).filter(Boolean))
      const shiftOrders = codeFilteredOrders.filter(order => shiftedOrderIds.has(order.id))

      let cashTotal = 0, qrTotal = 0, splitCash = 0, splitQr = 0
      let cashCount = 0, qrCount = 0, splitCount = 0
      let unpaidTotal = 0, unpaidCount = 0, paidCount = 0
      let grossSales = 0, rawCost = 0

      billRows.forEach(row => {
        const o = row.order
        const amt = row.net
        grossSales += row.gross
        rawCost += row.raw
        if (o.paymentMethod === 'CASH') {
          cashTotal += amt; cashCount++
        } else if (o.paymentMethod === 'BANK_QR') {
          qrTotal += amt; qrCount++
        } else if (o.paymentMethod === 'SPLIT') {
          const sCash = row.splitCashShare
          splitCash += sCash; splitQr += Math.max(0, amt - sCash); splitCount++
        }
        if (o.paymentStatus !== 'PAID') {
          unpaidTotal += amt; unpaidCount++
        } else {
          paidCount++
        }
      })

      const totalCashCollected = cashTotal + splitCash
      const totalQrCollected = qrTotal + splitQr
      const grandTotal = cashTotal + qrTotal + splitCash + splitQr
      const income = grandTotal - rawCost
      const linkedOrderNumbers = shiftOrders
        .map(order => order.orderNumber != null ? `#${order.orderNumber}` : order.orderCode)
        .filter(Boolean)
      const codes = billRows
        .map(row => row.order.orderCode ? `${row.order.orderCode}/${row.bill.billNumber || 1}` : null)
        .filter(Boolean)
        .sort()

      const openAuditRows = asList(openAuditResult)
      const menuRows = asList(menuAvailabilityResult)
      const inventorySummary = summarizeInventory(inventoryRows, from, to)

      setResult({
        shiftName,
        fromTime,
        toTime,
        orders: shiftOrders,
        billRows,
        cashTotal,
        cashCount,
        qrTotal,
        qrCount,
        splitCash,
        splitQr,
        splitCount,
        totalCashCollected,
        totalQrCollected,
        grandTotal,
        unpaidTotal,
        unpaidCount,
        paidCount,
        firstCode: codes.length ? codes[0] : null,
        lastCode: codes.length ? codes[codes.length - 1] : null,
        grossSales,
        rawCost,
        income,
        linkedOrderNumbers,
        openAudit: summarizeOpenAudit(openAuditRows),
        menuAvailability: summarizeMenuAvailability(menuRows),
        inventory: inventorySummary,
      })
    } catch (e) {
      setError(e.message || t('shopOrder.eod.loadFailed'))
    }
    setLoading(false)
  }

  const handleSaveHandover = () => {
    try {
      localStorage.setItem(HANDOVER_STORAGE_KEY, JSON.stringify({
        shiftName: result?.shiftName || shiftName,
        fromTime,
        toTime,
        savedAt: new Date().toISOString(),
      }))
      setHandoverSaved(true)
    } catch {
      setError(t('shopOrder.eod.saveFailed'))
    }
  }

  const pre = preCashDigits ? Number(preCashDigits) : 0
  const newCash = result ? pre + result.totalCashCollected : pre
  const canUseLastHandover = Boolean(getSavedHandover())

  const Row = ({ label, value, bold, color, bg }) => (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 1,
      px: 1.5,
      py: 0.6,
      bgcolor: bg || 'transparent',
      borderRadius: 1,
    }}>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color || 'text.primary'} sx={{ fontSize: 13 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={bold ? 800 : 600} color={color || 'text.primary'} sx={{ fontSize: 13, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  )

  const PanelHeader = ({ icon, title, color = 'primary.main', bg = '#e3f2fd' }) => (
    <Box sx={{ bgcolor: bg, px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {icon}
      <Typography variant="caption" fontWeight={800} color={color} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </Typography>
    </Box>
  )

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <AssessmentIcon color="primary" />
        <Typography fontWeight={800} variant="h6">{t('shopOrder.eod.title')}</Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {handoverSaved && <Alert severity="success" onClose={() => setHandoverSaved(false)}>{t('shopOrder.eod.saved')}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.15fr 0.85fr' }, gap: 1.5 }}>
            <TextField label={t('shopOrder.eod.shiftTemplate')} select size="small" value={shiftKey}
              onChange={e => applyShiftPreset(e.target.value)}>
              {SHIFT_OPTIONS.map(option => <MenuItem key={option.key} value={option.key}>{t(SHIFT_I18N[option.key])}</MenuItem>)}
            </TextField>
            <TextField label={t('shopOrder.eod.shiftDate')} type="date" size="small" value={shiftDate}
              onChange={e => handleShiftDateChange(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label={t('shopOrder.eod.shiftName')} size="small" value={shiftName}
              onChange={e => setShiftName(e.target.value)} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" startIcon={<AccessTimeIcon />} disabled={!canUseLastHandover}
                onClick={handleUseLastHandover} sx={{ textTransform: 'none', flex: 1 }}>
                {t('shopOrder.eod.lastHandover')}
              </Button>
              <Button size="small" variant="outlined" startIcon={lastOrderLoading ? <CircularProgress size={14} /> : <AccessTimeIcon />}
                disabled={lastOrderLoading} onClick={handleUseLastOrderTime} sx={{ textTransform: 'none', flex: 1 }}>
                {t('shopOrder.eod.lastOrder')}
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField label={t('shopOrder.eod.fromTime')} type="datetime-local" size="small" value={fromTime}
              onChange={e => { setFromTime(e.target.value); setShiftKey('custom') }} InputLabelProps={{ shrink: true }} />
            <TextField label={t('shopOrder.eod.toTime')} type="datetime-local" size="small" value={toTime}
              onChange={e => { setToTime(e.target.value); setShiftKey('custom') }} InputLabelProps={{ shrink: true }} />
            <TextField label={t('shopOrder.eod.fromOrder')} size="small" value={fromCode}
              onChange={e => setFromCode(e.target.value)} placeholder={t('shopOrder.eod.any')}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText={t('shopOrder.eod.orderFilter')} />
            <TextField label={t('shopOrder.eod.toOrder')} size="small" value={toCode}
              onChange={e => setToCode(e.target.value)} placeholder={t('shopOrder.eod.any')}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText={t('shopOrder.eod.orderFilter')} />
          </Box>

          <Button variant="contained" onClick={handleLoad} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <AssessmentIcon />}
            sx={{ fontWeight: 700, textTransform: 'none' }}>
            {loading ? t('common.loading') : t('shopOrder.eod.load')}
          </Button>

          {result && (
            <>
              <Divider />

              <Box sx={{ bgcolor: '#f1f5f9', borderRadius: 1.5, px: 1.5, py: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('shopOrder.eod.scope')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={result.shiftName || t('shopOrder.eod.shift')} />
                  <Chip size="small" label={t('shopOrder.eod.orderCount', { count: result.orders.length })} color="primary" variant="outlined" />
                  <Chip size="small" label={t('shopOrder.eod.billCount', { count: result.billRows.length })} color="primary" variant="outlined" />
                  <Chip size="small" label={t('shopOrder.eod.unpaidBillCount', { count: result.unpaidCount })} color={result.unpaidCount ? 'warning' : 'success'} variant="outlined" />
                </Box>
                {result.linkedOrderNumbers.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {t('shopOrder.eod.linkedOrders')} {result.linkedOrderNumbers.slice(0, 14).join(', ')}
                    {result.linkedOrderNumbers.length > 14 ? ` +${result.linkedOrderNumbers.length - 14} ${t('shopOrder.eod.more')}` : ''}
                  </Typography>
                )}
                {result.firstCode && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">{t('shopOrder.eod.billRange')}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.firstCode}</Typography>
                    <Typography variant="caption" color="text.secondary">{t('shopOrder.eod.to')}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.lastCode}</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                  <PanelHeader title={t('shopOrder.eod.salesIncome')} icon={<AssessmentIcon sx={{ fontSize: 16, color: 'primary.main' }} />} />
                  <Row label={t('shopOrder.eod.grossSales')} value={fmt(result.grossSales)} />
                  <Row label={t('shopOrder.eod.netSales')} value={fmt(result.grandTotal)} bold color="primary.main" bg="#f8faff" />
                  <Row label={t('shopOrder.eod.rawCost')} value={fmt(result.rawCost)} />
                  <Row label={t('shopOrder.eod.taxIncome')} value={fmt(result.income)} bold color={result.income >= 0 ? 'success.main' : 'error.main'} />
                  {result.unpaidCount > 0 && (
                    <Row label={t('shopOrder.eod.stillUnpaid', { count: result.unpaidCount })} value={fmt(result.unpaidTotal)} color="error.main" />
                  )}
                </Box>

                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                  <PanelHeader title={t('shopOrder.eod.cashBank')} icon={<AccountBalanceIcon sx={{ fontSize: 16, color: '#01579b' }} />} color="#01579b" bg="#e3f2fd" />
                  <Row label={t('shopOrder.eod.cashBills', { count: result.cashCount })} value={fmt(result.cashTotal)} />
                  <Row label={t('shopOrder.eod.qrBills', { count: result.qrCount })} value={fmt(result.qrTotal)} />
                  {result.splitCount > 0 && <>
                    <Row label={t('shopOrder.eod.splitCash', { count: result.splitCount })} value={fmt(result.splitCash)} />
                    <Row label={t('shopOrder.eod.splitQr')} value={fmt(result.splitQr)} />
                  </>}
                  <Divider />
                  <Row label={t('shopOrder.eod.cashCollected')} value={fmt(result.totalCashCollected)} bold color="#1b5e20" bg="#f0fdf4" />
                  <Row label={t('shopOrder.eod.qrExpected')} value={fmt(result.totalQrCollected)} bold color="#01579b" bg="#e3f2fd" />
                </Box>
              </Box>

              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <PanelHeader title={t('shopOrder.eod.cashDrawer')} icon={<SaveIcon sx={{ fontSize: 16, color: '#e65100' }} />} color="#e65100" bg="#fff8e1" />
                <Box sx={{ px: 1.5, py: 1 }}>
                  <TextField
                    label={t('shopOrder.eod.openingCash')} type="text" inputMode="numeric" size="small" fullWidth
                    value={fmtDots(preCashDigits)}
                    onChange={e => setPreCashDigits(stripDigits(e.target.value))}
                    placeholder="0" helperText={t('shopOrder.eod.openingCashHelp')}
                    inputProps={{ maxLength: 15, style: { fontWeight: 700 } }}
                    InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>VND</Typography> }}
                  />
                </Box>
                <Row label={t('shopOrder.eod.shiftCash')} value={fmt(result.totalCashCollected)} />
                <Divider />
                <Row label={t('shopOrder.eod.expectedCash')} value={fmt(newCash)} bold color="#1b5e20" bg="#f0fdf4" />
              </Box>

              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <PanelHeader title={t('shopOrder.eod.inventoryHandover')} icon={<Inventory2Icon sx={{ fontSize: 16, color: '#2e7d32' }} />} color="#2e7d32" bg="#edf7ed" />
                <Row label={t('shopOrder.eod.inventoryRows')} value={`${result.inventory.rows} rows / ${result.inventory.materialCount} materials`} />
                <Row label={t('shopOrder.eod.inventoryUpdated')} value={qtyFmt(result.inventory.updatedInShift)} />
                <Row label={t('shopOrder.eod.availableQty')} value={qtyFmt(result.inventory.availableQuantity)} bold color="#2e7d32" bg="#f0fdf4" />
                <Row label={t('shopOrder.eod.lockedQty')} value={qtyFmt(result.inventory.lockedQuantity)} />
                <Divider />
                <Row label={t('shopOrder.eod.openAudits')} value={`${result.openAudit.rows} rows / ${result.openAudit.affectedOrders} orders`} color={result.openAudit.rows ? 'warning.main' : 'success.main'} />
                <Row label={t('shopOrder.eod.waitingQty')} value={qtyFmt(result.openAudit.waitingQty)} color={result.openAudit.waitingQty ? 'warning.main' : 'success.main'} />
                <Row label={t('shopOrder.eod.menuStock')} value={`${result.menuAvailability.outCount} out / ${result.menuAvailability.lowCount} low`} color={(result.menuAvailability.outCount || result.menuAvailability.lowCount) ? 'warning.main' : 'success.main'} />
                {result.menuAvailability.lowRows.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, py: 0.75 }}>
                    {t('shopOrder.eod.checkMenu')} {result.menuAvailability.lowRows.map(row => `${row.modelName || row.modelCode} (${qtyFmt(row.effectiveAvailableUnits)})`).join(', ')}
                  </Typography>
                )}
                {result.inventory.outMaterials.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1 }}>
                    {t('shopOrder.eod.zeroMaterials')} {result.inventory.outMaterials.map(row => `${row.materialCode || row.materialName} (${qtyFmt(row.availableQuantity)})`).join(', ')}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        {result && (
          <Button startIcon={<SaveIcon />} onClick={handleSaveHandover} variant="contained" color="success" sx={{ textTransform: 'none' }}>
            {t('shopOrder.eod.saveHandover')}
          </Button>
        )}
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}