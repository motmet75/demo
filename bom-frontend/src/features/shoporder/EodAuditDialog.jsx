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

const VI_TEXT = {
  'Custom time': 'Tùy chỉnh thời gian',
  '2 shifts: Day 06:00-18:00': '2 ca: Ca ngày 06:00-18:00',
  '2 shifts: Night 18:00-06:00': '2 ca: Ca đêm 18:00-06:00',
  '3 shifts: Morning 06:00-14:00': '3 ca: Ca sáng 06:00-14:00',
  '3 shifts: Afternoon 14:00-22:00': '3 ca: Ca chiều 14:00-22:00',
  '3 shifts: Night 22:00-06:00': '3 ca: Ca đêm 22:00-06:00',
  '4 shifts: 00:00-06:00': '4 ca: 00:00-06:00',
  '4 shifts: 06:00-12:00': '4 ca: 06:00-12:00',
  '4 shifts: 12:00-18:00': '4 ca: 12:00-18:00',
  '4 shifts: 18:00-00:00': '4 ca: 18:00-00:00',
  'Shift Audit': 'Kiểm kê cuối ca',
  'Shift template': 'Mẫu ca làm việc',
  'Shift date': 'Ngày làm việc',
  'Shift name': 'Tên ca',
  'Start from last handover': 'Bắt đầu từ lần bàn giao trước',
  'End at last order': 'Kết thúc tại đơn cuối',
  'From time': 'Từ thời gian',
  'To time': 'Đến thời gian',
  'From order ID': 'Từ mã đơn hàng',
  'To order ID': 'Đến mã đơn hàng',
  '(any)': '(bất kỳ)',
  'optional orderCode filter': 'Bộ lọc mã đơn không bắt buộc',
  'Loading...': 'Đang tải...',
  'Load Shift Audit': 'Tải dữ liệu kiểm kê ca',
  'Shift Scope': 'Phạm vi ca',
  Shift: 'Ca',
  'Orders linked to this shift:': 'Các đơn thuộc ca này:',
  more: 'đơn khác',
  'Bill range': 'Khoảng hóa đơn',
  to: 'đến',
  'Sales and Income': 'Doanh thu và thu nhập',
  'Gross sales': 'Tổng doanh số',
  'Net sales after bill voucher/discount': 'Doanh thu thuần sau voucher/giảm giá',
  'Raw material cost': 'Chi phí nguyên vật liệu',
  'Income for tax audit': 'Thu nhập phục vụ kiểm tra thuế',
  'Cash and Bank': 'Tiền mặt và ngân hàng',
  'Split bank / QR portion': 'Phần thanh toán ngân hàng / QR',
  'Cash collected': 'Tiền mặt đã thu',
  'Bank / QR expected': 'Tiền ngân hàng / QR dự kiến',
  'Cash Drawer': 'Két tiền',
  'Pre-cash (opening balance)': 'Tiền đầu ca (số dư mở ca)',
  'Cash already in the drawer at shift start': 'Tiền có sẵn trong két khi bắt đầu ca',
  '+ Cash collected in this shift': '+ Tiền mặt thu trong ca',
  '= Expected cash before handover': '= Tiền mặt dự kiến trước bàn giao',
  'Inventory Handover': 'Bàn giao tồn kho',
  'Inventory rows checked': 'Dòng tồn kho đã kiểm tra',
  'Inventory rows updated in shift': 'Dòng tồn kho cập nhật trong ca',
  'Available quantity left': 'Số lượng khả dụng còn lại',
  'Locked quantity': 'Số lượng đang khóa',
  'Open material audit rows': 'Dòng kiểm kê nguyên liệu đang mở',
  'Waiting material qty': 'Số lượng nguyên liệu đang chờ',
  'Menu sold out / low stock': 'Món hết hàng / sắp hết',
  'Check menu stock:': 'Kiểm tra tồn kho món:',
  'Materials at zero or below:': 'Nguyên liệu đã hết hoặc âm:',
  'Save Handover Time': 'Lưu thời gian bàn giao',
  Close: 'Đóng',
  'No order time found.': 'Không tìm thấy thời gian của đơn hàng.',
  'Failed to load last order time': 'Không thể tải thời gian của đơn cuối',
  'Invalid shift start time': 'Thời gian bắt đầu ca không hợp lệ',
  'Invalid shift end time': 'Thời gian kết thúc ca không hợp lệ',
  'Shift start must be before shift end': 'Thời gian bắt đầu phải trước thời gian kết thúc ca',
  'Failed to load shift audit': 'Không thể tải dữ liệu kiểm kê ca',
  'Could not save handover time in this browser.': 'Không thể lưu thời gian bàn giao trên trình duyệt này.',
  'Handover time saved. The next shift can start from this end time.': 'Đã lưu thời gian bàn giao. Ca tiếp theo có thể bắt đầu từ thời gian kết thúc này.',
}
const HANDOVER_STORAGE_KEY = 'shop.shiftAudit.lastHandover'
const LOW_MENU_THRESHOLD = 3

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
  const { language } = useI18n()
  const tr = (text) => language === 'vi' ? (VI_TEXT[text] || text) : text
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
        setError(tr('No order time found.'))
      }
    } catch (e) {
      setError(e.message || tr('Failed to load last order time'))
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
      if (from && Number.isNaN(from.getTime())) throw new Error(tr('Invalid shift start time'))
      if (to && Number.isNaN(to.getTime())) throw new Error(tr('Invalid shift end time'))
      if (from && to && from > to) throw new Error(tr('Shift start must be before shift end'))

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
      setError(e.message || tr('Failed to load shift audit'))
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
      setError(tr('Could not save handover time in this browser.'))
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
        <Typography fontWeight={800} variant="h6">{tr('Shift Audit')}</Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {handoverSaved && <Alert severity="success" onClose={() => setHandoverSaved(false)}>{tr('Handover time saved. The next shift can start from this end time.')}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.15fr 0.85fr' }, gap: 1.5 }}>
            <TextField label={tr('Shift template')} select size="small" value={shiftKey}
              onChange={e => applyShiftPreset(e.target.value)}>
              {SHIFT_OPTIONS.map(option => <MenuItem key={option.key} value={option.key}>{tr(option.label)}</MenuItem>)}
            </TextField>
            <TextField label={tr('Shift date')} type="date" size="small" value={shiftDate}
              onChange={e => handleShiftDateChange(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label={tr('Shift name')} size="small" value={shiftName}
              onChange={e => setShiftName(e.target.value)} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" startIcon={<AccessTimeIcon />} disabled={!canUseLastHandover}
                onClick={handleUseLastHandover} sx={{ textTransform: 'none', flex: 1 }}>
                {tr('Start from last handover')}
              </Button>
              <Button size="small" variant="outlined" startIcon={lastOrderLoading ? <CircularProgress size={14} /> : <AccessTimeIcon />}
                disabled={lastOrderLoading} onClick={handleUseLastOrderTime} sx={{ textTransform: 'none', flex: 1 }}>
                {tr('End at last order')}
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField label={tr('From time')} type="datetime-local" size="small" value={fromTime}
              onChange={e => { setFromTime(e.target.value); setShiftKey('custom') }} InputLabelProps={{ shrink: true }} />
            <TextField label={tr('To time')} type="datetime-local" size="small" value={toTime}
              onChange={e => { setToTime(e.target.value); setShiftKey('custom') }} InputLabelProps={{ shrink: true }} />
            <TextField label={tr('From order ID')} size="small" value={fromCode}
              onChange={e => setFromCode(e.target.value)} placeholder={tr('(any)')}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText={tr('optional orderCode filter')} />
            <TextField label={tr('To order ID')} size="small" value={toCode}
              onChange={e => setToCode(e.target.value)} placeholder={tr('(any)')}
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
              helperText={tr('optional orderCode filter')} />
          </Box>

          <Button variant="contained" onClick={handleLoad} disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <AssessmentIcon />}
            sx={{ fontWeight: 700, textTransform: 'none' }}>
            {loading ? tr('Loading...') : tr('Load Shift Audit')}
          </Button>

          {result && (
            <>
              <Divider />

              <Box sx={{ bgcolor: '#f1f5f9', borderRadius: 1.5, px: 1.5, py: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {tr('Shift Scope')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip size="small" label={result.shiftName || tr('Shift')} />
                  <Chip size="small" label={language === 'vi' ? `${result.orders.length} đơn hàng` : `${result.orders.length} orders`} color="primary" variant="outlined" />
                  <Chip size="small" label={language === 'vi' ? `${result.billRows.length} hóa đơn` : `${result.billRows.length} bills`} color="primary" variant="outlined" />
                  <Chip size="small" label={language === 'vi' ? `${result.unpaidCount} hóa đơn chưa thanh toán` : `${result.unpaidCount} unpaid bills`} color={result.unpaidCount ? 'warning' : 'success'} variant="outlined" />
                </Box>
                {result.linkedOrderNumbers.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    {tr('Orders linked to this shift:')} {result.linkedOrderNumbers.slice(0, 14).join(', ')}
                    {result.linkedOrderNumbers.length > 14 ? ` +${result.linkedOrderNumbers.length - 14} ${tr('more')}` : ''}
                  </Typography>
                )}
                {result.firstCode && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">{tr('Bill range')}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.firstCode}</Typography>
                    <Typography variant="caption" color="text.secondary">{tr('to')}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', bgcolor: '#e2e8f0', px: 0.75, py: 0.1, borderRadius: 0.75 }}>{result.lastCode}</Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                  <PanelHeader title={tr('Sales and Income')} icon={<AssessmentIcon sx={{ fontSize: 16, color: 'primary.main' }} />} />
                  <Row label={tr('Gross sales')} value={fmt(result.grossSales)} />
                  <Row label={tr('Net sales after bill voucher/discount')} value={fmt(result.grandTotal)} bold color="primary.main" bg="#f8faff" />
                  <Row label={tr('Raw material cost')} value={fmt(result.rawCost)} />
                  <Row label={tr('Income for tax audit')} value={fmt(result.income)} bold color={result.income >= 0 ? 'success.main' : 'error.main'} />
                  {result.unpaidCount > 0 && (
                    <Row label={language === 'vi' ? `Còn chưa thanh toán (${result.unpaidCount} hóa đơn)` : `Still unpaid (${result.unpaidCount} bills)`} value={fmt(result.unpaidTotal)} color="error.main" />
                  )}
                </Box>

                <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                  <PanelHeader title={tr('Cash and Bank')} icon={<AccountBalanceIcon sx={{ fontSize: 16, color: '#01579b' }} />} color="#01579b" bg="#e3f2fd" />
                  <Row label={language === 'vi' ? `Hóa đơn tiền mặt (${result.cashCount})` : `Cash bills (${result.cashCount})`} value={fmt(result.cashTotal)} />
                  <Row label={language === 'vi' ? `Hóa đơn ngân hàng / QR (${result.qrCount})` : `Bank / QR bills (${result.qrCount})`} value={fmt(result.qrTotal)} />
                  {result.splitCount > 0 && <>
                    <Row label={language === 'vi' ? `Phần tiền mặt khi chia thanh toán (${result.splitCount})` : `Split cash portion (${result.splitCount})`} value={fmt(result.splitCash)} />
                    <Row label={tr('Split bank / QR portion')} value={fmt(result.splitQr)} />
                  </>}
                  <Divider />
                  <Row label={tr('Cash collected')} value={fmt(result.totalCashCollected)} bold color="#1b5e20" bg="#f0fdf4" />
                  <Row label={tr('Bank / QR expected')} value={fmt(result.totalQrCollected)} bold color="#01579b" bg="#e3f2fd" />
                </Box>
              </Box>

              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <PanelHeader title={tr('Cash Drawer')} icon={<SaveIcon sx={{ fontSize: 16, color: '#e65100' }} />} color="#e65100" bg="#fff8e1" />
                <Box sx={{ px: 1.5, py: 1 }}>
                  <TextField
                    label={tr('Pre-cash (opening balance)')} type="text" inputMode="numeric" size="small" fullWidth
                    value={fmtDots(preCashDigits)}
                    onChange={e => setPreCashDigits(stripDigits(e.target.value))}
                    placeholder="0" helperText={tr('Cash already in the drawer at shift start')}
                    inputProps={{ maxLength: 15, style: { fontWeight: 700 } }}
                    InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>VND</Typography> }}
                  />
                </Box>
                <Row label={tr('+ Cash collected in this shift')} value={fmt(result.totalCashCollected)} />
                <Divider />
                <Row label={tr('= Expected cash before handover')} value={fmt(newCash)} bold color="#1b5e20" bg="#f0fdf4" />
              </Box>

              <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
                <PanelHeader title={tr('Inventory Handover')} icon={<Inventory2Icon sx={{ fontSize: 16, color: '#2e7d32' }} />} color="#2e7d32" bg="#edf7ed" />
                <Row label={tr('Inventory rows checked')} value={`${result.inventory.rows} rows / ${result.inventory.materialCount} materials`} />
                <Row label={tr('Inventory rows updated in shift')} value={qtyFmt(result.inventory.updatedInShift)} />
                <Row label={tr('Available quantity left')} value={qtyFmt(result.inventory.availableQuantity)} bold color="#2e7d32" bg="#f0fdf4" />
                <Row label={tr('Locked quantity')} value={qtyFmt(result.inventory.lockedQuantity)} />
                <Divider />
                <Row label={tr('Open material audit rows')} value={`${result.openAudit.rows} rows / ${result.openAudit.affectedOrders} orders`} color={result.openAudit.rows ? 'warning.main' : 'success.main'} />
                <Row label={tr('Waiting material qty')} value={qtyFmt(result.openAudit.waitingQty)} color={result.openAudit.waitingQty ? 'warning.main' : 'success.main'} />
                <Row label={tr('Menu sold out / low stock')} value={`${result.menuAvailability.outCount} out / ${result.menuAvailability.lowCount} low`} color={(result.menuAvailability.outCount || result.menuAvailability.lowCount) ? 'warning.main' : 'success.main'} />
                {result.menuAvailability.lowRows.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, py: 0.75 }}>
                    {tr('Check menu stock:')} {result.menuAvailability.lowRows.map(row => `${row.modelName || row.modelCode} (${qtyFmt(row.effectiveAvailableUnits)})`).join(', ')}
                  </Typography>
                )}
                {result.inventory.outMaterials.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1 }}>
                    {tr('Materials at zero or below:')} {result.inventory.outMaterials.map(row => `${row.materialCode || row.materialName} (${qtyFmt(row.availableQuantity)})`).join(', ')}
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
            {tr('Save Handover Time')}
          </Button>
        )}
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>{tr('Close')}</Button>
      </DialogActions>
    </Dialog>
  )
}