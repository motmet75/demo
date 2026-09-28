import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, Paper, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, MenuItem,
  Typography
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PrintIcon from '@mui/icons-material/Print'
import SaveIcon from '@mui/icons-material/Save'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import {
  createCounterPaymentNote,
  createCounterShiftHandover,
  fetchCounterInventoryReconciliations,
  fetchCounterInventorySnapshot,
  fetchCounterHandoverUsers,
  fetchCounterPaymentNotes,
  fetchCounterShiftHandovers,
  fetchCounterShiftSummary,
  fetchShiftSchedule,
  saveCounterInventoryReconciliation,
} from '../../api/shopApi'
import CounterWorkflow from './CounterWorkflow'
import { useAuth } from '../../context/useAuth'
import { formatIntegerInput, formatQuantityInput, parseIntegerInput, parseQuantityInput } from '../../utils/numberInput'

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500]

const fmtMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const fmtQty = (value) => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const digits = (value) => String(value || '').replace(/[^\d.-]/g, '')
const moneyNumber = (value) => Number(digits(value)) || 0
const searchText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, match => match === 'đ' ? 'd' : 'D')
  .toLowerCase()
const paymentMethodLabel = value => ({
  CASH: 'Tiền mặt',
  BANK_QR: 'QR / chuyển khoản ngay',
  UNPAID: 'Chưa thu / chưa chi tiền',
  BANK_LATER: 'Ngân hàng cửa hàng · xử lý sau',
})[value] || value || 'Tiền mặt'
const handoverUserLabel = user => typeof user === 'string' ? user : [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || ''
const inventoryTimestamp = row => new Date(row.createdAt || row.updatedAt || 0).getTime() || 0
const shortInventoryDate = value => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Ho_Chi_Minh' })
  const day = date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
  return `${month}-${day}`
}
const quantityTotals = rows => Object.entries(rows.reduce((totals, row) => {
  const unit = row.unit || 'đơn vị'
  totals[unit] = (totals[unit] || 0) + Number(row.quantityOnHand || 0)
  return totals
}, {})).map(([unit, quantity]) => `${fmtQty(quantity)} ${unit}`).join(' · ')

const inventoryRowKey = row => row.reconciliationKey || row.inventoryId || row.id

const combineInventoryRows = rows => {
  const groups = new Map()
  rows.forEach(row => {
    const key = [row.materialId || row.materialCode || row.materialName, row.warehouseId || row.warehouseCode, row.unit || ''].join('|')
    if (!groups.has(key)) {
      groups.set(key, {
        ...row,
        reconciliationKey: `combined:${key}`,
        inventoryId: null,
        batchNo: '',
        quantityOnHand: 0,
        sourceRows: [],
      })
    }
    const group = groups.get(key)
    group.quantityOnHand += Number(row.quantityOnHand || 0)
    group.sourceRows.push(row)
    if (inventoryTimestamp(row) > inventoryTimestamp(group)) {
      group.createdAt = row.createdAt
      group.updatedAt = row.updatedAt
    }
  })
  return [...groups.values()]
}

const defaultActualQuantities = rows => Object.fromEntries([
  ...rows.map(row => [inventoryRowKey(row), String(Number(row.quantityOnHand || 0))]),
  ...combineInventoryRows(rows).map(row => [inventoryRowKey(row), String(Number(row.quantityOnHand || 0))]),
])

function localDateValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDatetimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultShiftRange(now = new Date()) {
  const startHour = now.getHours() < 14 ? 6 : 14
  const d = new Date(now)
  d.setHours(startHour, 0, 0, 0)
  return { from: localDatetimeValue(d), to: localDatetimeValue(now), name: startHour === 6 ? 'Ca 1 · 06:00–14:00' : 'Ca 2 · 14:00–22:00' }
}

function configuredShiftRange(shifts, now = new Date()) {
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const today = (shifts || []).filter(shift => shift.isActive !== false && Number(shift.dayOfWeek) === dayOfWeek)
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
  if (!today.length) return null
  const minutes = now.getHours() * 60 + now.getMinutes()
  const shiftMinutes = shift => {
    const [startHour, startMinute] = String(shift.startTime || '00:00').split(':').map(Number)
    const [endHour, endMinute] = String(shift.endTime || '00:00').split(':').map(Number)
    return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute }
  }
  const selected = today.find(shift => { const range = shiftMinutes(shift); return minutes >= range.start && minutes < range.end })
    || [...today].reverse().find(shift => minutes >= shiftMinutes(shift).start)
    || today[0]
  const date = localDateValue(now)
  const start = String(selected.startTime || '06:00').slice(0, 5)
  const end = String(selected.endTime || '14:00').slice(0, 5)
  return { from: `${date}T${start}`, to: localDatetimeValue(now), name: selected.label || `Ca ${start}–${end}` }
}

function toIso(localValue) {
  const d = new Date(localValue)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function handoverToIso(localValue) {
  const selected = new Date(localValue)
  if (Number.isNaN(selected.getTime())) return null
  return new Date(Math.min(selected.getTime(), Date.now())).toISOString()
}

async function apiData(promise, fallback = 'Thao tác thất bại') {
  const { res, data } = await promise
  if (!res.ok) throw new Error(data?.message || data?.error || (typeof data === 'string' ? data : fallback))
  return data
}

function printHtml(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=460,height=720')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#111}
      h1{font-size:18px;text-align:center;margin:0 0 4px}
      h2{font-size:14px;text-align:center;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px dotted #999;padding:5px;text-align:left}
      th{text-transform:uppercase;font-size:11px}
      .right{text-align:right}.bold{font-weight:800}.section{font-weight:800;margin-top:12px;border-top:1px solid #111;padding-top:8px}
      .sign{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;text-align:center;font-weight:800}
      @media print{button{display:none}body{padding:0}}
    </style></head><body>${bodyHtml}<script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

export default function CounterShiftPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState(3)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const initialShift = useMemo(() => defaultShiftRange(), [])
  const [shiftDate, setShiftDate] = useState(localDateValue())
  const [fromLocal, setFromLocal] = useState(initialShift.from)
  const [toLocal, setToLocal] = useState(initialShift.to)
  const [shiftName, setShiftName] = useState(initialShift.name)
  const [handoverTo, setHandoverTo] = useState('')
  const [openingCash, setOpeningCash] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [denominationCounts, setDenominationCounts] = useState(() => Object.fromEntries(DENOMINATIONS.map(v => [v, ''])))
  const [summary, setSummary] = useState({})
  const [handovers, setHandovers] = useState([])
  const [handoverUsers, setHandoverUsers] = useState([])

  const [inventoryRows, setInventoryRows] = useState([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [combineInventoryTotals, setCombineInventoryTotals] = useState(true)
  const [printGroupByWarehouse, setPrintGroupByWarehouse] = useState(true)
  const [printSubtotalByCode, setPrintSubtotalByCode] = useState(false)
  const [actualQtyById, setActualQtyById] = useState({})
  const [reasonById, setReasonById] = useState({})
  const [reconciliations, setReconciliations] = useState([])
  const inventoryCellRefs = useRef({ actual: {}, reason: {} })

  const [paymentDate, setPaymentDate] = useState(localDateValue())
  const [paymentNotes, setPaymentNotes] = useState([])
  const [paymentForm, setPaymentForm] = useState({ noteType: 'EXPENSE', objectName: '', recipientName: '', address: '', reason: '', amount: '', paymentMethod: 'CASH' })

  const cashActual = useMemo(() => DENOMINATIONS.reduce((sum, value) => {
    const count = Number(denominationCounts[value] || 0)
    return sum + value * (Number.isFinite(count) ? count : 0)
  }, 0), [denominationCounts])
  const paymentNoteTotals = useMemo(() => paymentNotes.reduce((totals, note) => {
    const amount = Number(note.amount || 0)
    const isReceipt = note.note_type === 'RECEIPT'
    const method = note.payment_method === 'BANK_QR' ? 'qr' : note.payment_method === 'CASH' || !note.payment_method ? 'cash' : 'deferred'
    if (isReceipt) totals.receipt += amount
    else totals.expense += amount
    totals[`${method}${isReceipt ? 'Receipt' : 'Expense'}`] += amount
    totals[`${method}Total`] += amount
    totals.total += amount
    return totals
  }, {
    receipt: 0, expense: 0, total: 0,
    cashReceipt: 0, cashExpense: 0, cashTotal: 0,
    qrReceipt: 0, qrExpense: 0, qrTotal: 0,
    deferredReceipt: 0, deferredExpense: 0, deferredTotal: 0,
  }), [paymentNotes])

  const openingCashNumber = moneyNumber(openingCash)
  const otherAmountNumber = moneyNumber(otherAmount)
  const expectedCash = openingCashNumber
    + Number(summary.cashIn || 0)
    + Number(summary.receiptNoteCashTotal || 0)
    + otherAmountNumber
    - Number(summary.paymentNoteTotal || 0)
  const cashDifference = cashActual - expectedCash

  const filteredInventoryRows = useMemo(() => {
    const q = searchText(inventorySearch.trim())
    const matchingRows = q ? inventoryRows.filter(row => [
      row.materialCode, row.materialName, row.warehouseCode, row.warehouseName, row.batchNo
    ].some(value => searchText(value).includes(q))) : inventoryRows
    const rows = combineInventoryTotals ? combineInventoryRows(matchingRows) : matchingRows
    return [...rows].sort((a, b) => inventoryTimestamp(b) - inventoryTimestamp(a)
      || String(a.materialCode || '').localeCompare(String(b.materialCode || '')))
  }, [combineInventoryTotals, inventoryRows, inventorySearch])

  const focusInventoryCell = (rowIndex, field) => {
    const row = filteredInventoryRows[rowIndex]
    if (!row) return
    const key = row.inventoryId || row.id
    requestAnimationFrame(() => {
      const input = inventoryCellRefs.current[field]?.[key]
      input?.focus()
      if (field === 'actual') input?.select()
    })
  }

  const loadSummary = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await apiData(fetchCounterShiftSummary({ from: toIso(fromLocal), to: handoverToIso(toLocal) }))
      setSummary(data || {})
      const saved = await apiData(fetchCounterShiftHandovers(shiftDate))
      setHandovers(Array.isArray(saved) ? saved : [])
    } catch (e) {
      setError(e.message || 'Không tải được dữ liệu bàn giao')
    } finally {
      setLoading(false)
    }
  }

  const loadInventory = async () => {
    setError('')
    setLoading(true)
    try {
      const [snapshot, saved] = await Promise.all([
        apiData(fetchCounterInventorySnapshot()),
        apiData(fetchCounterInventoryReconciliations(shiftDate)),
      ])
      const rows = Array.isArray(snapshot) ? snapshot : []
      setInventoryRows(rows)
      setActualQtyById(defaultActualQuantities(rows))
      setReasonById({})
      setReconciliations(Array.isArray(saved) ? saved : [])
    } catch (e) {
      setError(e.message || 'Không tải được tồn kho')
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentNotes = async () => {
    setError('')
    setLoading(true)
    try {
      const notes = await apiData(fetchCounterPaymentNotes(paymentDate))
      setPaymentNotes(Array.isArray(notes) ? notes : [])
    } catch (e) {
      setError(e.message || 'Không tải được phiếu thu / chi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSummary() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchShiftSchedule().then(({ res, data }) => {
      if (!res.ok) return
      const range = configuredShiftRange(Array.isArray(data) ? data : [])
      if (!range) return
      setShiftDate(range.from.slice(0, 10)); setFromLocal(range.from); setToLocal(range.to); setShiftName(range.name)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (tab !== 0) return undefined
    let active = true
    const refresh = () => apiData(fetchCounterShiftSummary({ from: toIso(fromLocal), to: handoverToIso(toLocal) }))
      .then(data => { if (active) setSummary(data || {}) })
      .catch(() => {})
    void refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [tab, fromLocal, toLocal])
  useEffect(() => {
    fetchCounterHandoverUsers().then(({ res, data }) => { if (res.ok) setHandoverUsers(Array.isArray(data) ? data : []) }).catch(() => {})
  }, [])
  useEffect(() => { if (tab === 1) loadInventory() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 2) loadPaymentNotes() }, [tab, paymentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveHandover = async () => {
    setError(''); setSuccess('')
    try {
      const currentSummary = await apiData(fetchCounterShiftSummary({ from: toIso(fromLocal), to: handoverToIso(toLocal) })) || {}
      setSummary(currentSummary)
      const currentExpectedCash = openingCashNumber
        + Number(currentSummary.cashIn || 0)
        + Number(currentSummary.receiptNoteCashTotal || 0)
        + otherAmountNumber
        - Number(currentSummary.paymentNoteTotal || 0)
      const currentCashDifference = cashActual - currentExpectedCash
      await apiData(createCounterShiftHandover({
        shiftDate,
        shiftName,
        openedAt: toIso(fromLocal),
        closedAt: handoverToIso(toLocal),
        handoverBy: user?.username || '',
        handoverTo,
        openingCash: openingCashNumber,
        cashSales: currentSummary.cashIn || 0,
        bankSales: Number(currentSummary.bankingIn || 0) + Number(currentSummary.receiptNoteBankTotal || 0),
        debtAmount: currentSummary.debtAmount || 0,
        otherAmount: otherAmountNumber,
        paymentNoteTotal: currentSummary.paymentNoteTotal || 0,
        expectedCash: currentExpectedCash,
        actualCash: cashActual,
        differenceCash: currentCashDifference,
        orderCount: currentSummary.orderCount || 0,
        cardSlipCount: currentSummary.cardSlipCount || 0,
        unpaidOrderCount: currentSummary.unpaidOrderCount || 0,
        cashDenominations: DENOMINATIONS.map(value => ({
          denomination: value,
          count: Number(denominationCounts[value] || 0),
          amount: value * Number(denominationCounts[value] || 0),
        })),
        notes: handoverNotes,
      }), 'Không lưu được bàn giao ca')
      setSuccess('Đã lưu biên bản bàn giao ca')
      await loadSummary()
    } catch (e) {
      setError(e.message || 'Không lưu được bàn giao ca')
    }
  }

  const saveReconciliation = async () => {
    setError(''); setSuccess('')
    const sourceRows = combineInventoryTotals ? combineInventoryRows(inventoryRows) : inventoryRows
    const rows = sourceRows
      .filter(row => actualQtyById[inventoryRowKey(row)] !== undefined && actualQtyById[inventoryRowKey(row)] !== '')
      .map(row => {
        const key = inventoryRowKey(row)
        return {
          inventoryId: row.inventoryId || null,
          materialId: row.materialId,
          materialCode: row.materialCode,
          materialName: row.materialName,
          warehouseId: row.warehouseId,
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          batchNo: combineInventoryTotals ? '' : row.batchNo,
          unit: row.unit,
          systemQty: row.quantityOnHand || 0,
          actualQty: actualQtyById[key],
          reason: reasonById[key] || null,
        }
      })
    if (!rows.length) { setError('Chưa nhập số thực đếm'); return }
    try {
      const result = await apiData(saveCounterInventoryReconciliation({ checkDate: shiftDate, rows }), 'Không lưu được đối soát')
      setSuccess(`Đã lưu ${result.saved || rows.length} dòng đối soát tồn kho`)
      await loadInventory()
    } catch (e) {
      setError(e.message || 'Không lưu được đối soát')
    }
  }

  const savePaymentNote = async () => {
    setError(''); setSuccess('')
    const person = paymentForm.recipientName.trim()
    if (!person) { setError(paymentForm.noteType === 'RECEIPT' ? 'Nhập người nộp tiền' : 'Nhập người nhận tiền'); return }
    const noteLabel = paymentForm.noteType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'
    if (!window.confirm(`Xác nhận tạo ${noteLabel} ${fmtMoney(moneyNumber(paymentForm.amount))}\n${paymentForm.noteType === 'RECEIPT' ? 'Người nộp' : 'Người nhận'}: ${person}`)) return
    try {
      const note = await apiData(createCounterPaymentNote({
        noteDate: paymentDate,
        noteType: paymentForm.noteType,
        objectName: paymentForm.objectName,
        recipientName: paymentForm.recipientName,
        address: paymentForm.address,
        reason: paymentForm.reason,
        amount: moneyNumber(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
      }), 'Không tạo được phiếu thu / chi')
      setSuccess(`Đã tạo ${paymentForm.noteType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'} ${note.noteNumber || ''}`)
      setPaymentForm({ noteType: 'EXPENSE', objectName: '', recipientName: '', address: '', reason: '', amount: '', paymentMethod: 'CASH' })
      await loadPaymentNotes()
      await loadSummary()
    } catch (e) {
      setError(e.message || 'Không tạo được phiếu thu / chi')
    }
  }

  const printHandover = async () => {
    let reportSummary = summary
    try {
      reportSummary = await apiData(fetchCounterShiftSummary({ from: toIso(fromLocal), to: handoverToIso(toLocal) })) || {}
      setSummary(reportSummary)
    } catch (printError) {
      setError(printError.message || 'Không tải lại được số liệu trước khi in')
      return
    }
    const reportExpectedCash = openingCashNumber
      + Number(reportSummary.cashIn || 0)
      + Number(reportSummary.receiptNoteCashTotal || 0)
      + otherAmountNumber
      - Number(reportSummary.paymentNoteTotal || 0)
    const reportCashDifference = cashActual - reportExpectedCash
    const denominationRows = DENOMINATIONS.map(value => {
      const count = Number(denominationCounts[value] || 0)
      if (!count) return ''
      return `<tr><td class="right">${fmtMoney(value)}</td><td class="right">${count}</td><td class="right">${fmtMoney(value * count)}</td></tr>`
    }).join('')
    let reportPaymentNotes = paymentNotes
    try {
      reportPaymentNotes = await apiData(fetchCounterPaymentNotes(shiftDate)) || []
      setPaymentNotes(Array.isArray(reportPaymentNotes) ? reportPaymentNotes : [])
    } catch { /* summary totals remain authoritative */ }
    const fromMs = new Date(fromLocal).getTime()
    const toMs = new Date(handoverToIso(toLocal)).getTime()
    const notesInShift = (Array.isArray(reportPaymentNotes) ? reportPaymentNotes : []).filter(note => {
      const at = new Date(note.created_at).getTime()
      return at >= fromMs && at < toMs
    })
    const paymentRows = notesInShift.map((note, idx) =>
      `<tr><td>${idx + 1}</td><td>${note.note_type === 'RECEIPT' ? 'Thu' : 'Chi'}</td><td>${paymentMethodLabel(note.payment_method)}</td><td>${new Date(note.created_at).toLocaleTimeString('vi-VN')}</td><td>${note.recipient_name || ''}</td><td>${note.reason || ''}</td><td class="right">${fmtMoney(note.amount)}</td></tr>`
    ).join('')
    printHtml('Biên bản bàn giao ca', `
      <h1>BIÊN BẢN BÀN GIAO CA</h1>
      <h2>${shiftName || ''} ngày ${shiftDate}</h2>
      <p><b>Giờ mở ca:</b> ${new Date(fromLocal).toLocaleString('vi-VN')} &nbsp; <b>Bàn giao lúc:</b> ${new Date(handoverToIso(toLocal)).toLocaleString('vi-VN')}</p>
      <p><b>Người bàn giao:</b> ${user?.username || ''}</p>
      <div class="section">Nội dung bàn giao</div>
      <table>
        <tr><td>Tổng doanh thu</td><td class="right bold">${fmtMoney(reportSummary.totalSales)}</td></tr>
        <tr><td>Tiền mặt đầu ca</td><td class="right">${fmtMoney(openingCashNumber)}</td></tr>
        <tr><td>Thu tiền mặt trong ca</td><td class="right">${fmtMoney(reportSummary.cashIn)}</td></tr>
        <tr><td>Phiếu thu tiền mặt</td><td class="right">${fmtMoney(reportSummary.receiptNoteCashTotal)}</td></tr>
        <tr><td>Chi trong ca</td><td class="right">${fmtMoney(reportSummary.paymentNoteTotal)}</td></tr>
        <tr><td class="bold">Tổng Thu + Chi tiền mặt</td><td class="right bold">${fmtMoney(reportSummary.totalCashReceiptsExpenses)}</td></tr>
        <tr><td>Tiền thẻ / chuyển khoản</td><td class="right">${fmtMoney(reportSummary.bankingIn)}</td></tr>
        <tr><td>Phiếu thu QR / chuyển khoản</td><td class="right">${fmtMoney(reportSummary.receiptNoteBankTotal)}</td></tr>
        <tr><td>Phiếu chi QR / chuyển khoản</td><td class="right">${fmtMoney(reportSummary.bankPaymentNoteTotal)}</td></tr>
        <tr><td class="bold">Tổng Thu + Chi QR / chuyển khoản</td><td class="right bold">${fmtMoney(reportSummary.totalQrReceiptsExpenses)}</td></tr>
        <tr><td class="bold">Tổng phụ phiếu thu</td><td class="right bold">${fmtMoney(reportSummary.receiptNoteSubtotal)}</td></tr>
        <tr><td class="bold">Tổng phụ phiếu chi</td><td class="right bold">${fmtMoney(reportSummary.expenseNoteSubtotal)}</td></tr>
        <tr><td class="bold">Tổng Thu + Chi</td><td class="right bold">${fmtMoney(reportSummary.receiptExpenseTotal)}</td></tr>
        <tr><td>Order chưa thanh toán</td><td class="right">${reportSummary.unpaidOrderCount || 0}</td></tr>
        <tr><td>Tiền dự kiến trong két</td><td class="right">${fmtMoney(reportExpectedCash)}</td></tr>
        <tr><td>Thực tế kiểm đếm</td><td class="right">${fmtMoney(cashActual)}</td></tr>
        <tr><td>Chênh lệch</td><td class="right bold">${fmtMoney(reportCashDifference)}</td></tr>
      </table>
      <div class="section">Phân loại Thu / Chi theo phương thức</div>
      <table>
        <tr><th>Phương thức</th><th class="right">Tổng Thu</th><th class="right">Tổng Chi</th><th class="right">Thu + Chi</th></tr>
        <tr><td>Tiền mặt</td><td class="right">${fmtMoney(reportSummary.totalCashReceipts)}</td><td class="right">${fmtMoney(reportSummary.totalCashExpenses)}</td><td class="right bold">${fmtMoney(reportSummary.totalCashReceiptsExpenses)}</td></tr>
        <tr><td>QR / chuyển khoản</td><td class="right">${fmtMoney(reportSummary.totalQrReceipts)}</td><td class="right">${fmtMoney(reportSummary.totalQrExpenses)}</td><td class="right bold">${fmtMoney(reportSummary.totalQrReceiptsExpenses)}</td></tr>
      </table>
      <div class="section">Chi tiết kiểm đếm</div>
      <table><tr><th>Mệnh giá</th><th class="right">SL</th><th class="right">Thành tiền</th></tr>${denominationRows}</table>
      <div class="section">Phiếu thu / chi trong thời gian ca</div>
      <table><tr><th>#</th><th>Loại</th><th>Phương thức</th><th>Giờ</th><th>Người nhận / nộp</th><th>Nội dung</th><th class="right">Số tiền</th></tr>${paymentRows || '<tr><td colspan="7">Không có</td></tr>'}</table>
      <p><b>Ghi chú:</b> ${handoverNotes || ''}</p>
      <div class="sign"><div>Người bàn giao<br><br><br>(Ký, họ tên)</div><div>Người nhận bàn giao<br><br><br>(Ký, họ tên)</div></div>
    `)
  }

  const printInventorySnapshot = () => {
    const renderRows = (sourceRows, showWarehouse) => {
      const detail = row => {
        const actual = actualQtyById[inventoryRowKey(row)]
        return `<tr><td>${row.materialCode || ''}</td><td>${row.materialName || ''}</td>${showWarehouse ? `<td>${row.warehouseCode || '-'}</td>` : ''}<td>${shortInventoryDate(row.createdAt || row.updatedAt)}</td><td class="right">${fmtQty(row.quantityOnHand)}</td><td>${row.unit || ''}</td><td class="right">${actual === undefined ? '' : fmtQty(actual)}</td></tr>`
      }
      if (!printSubtotalByCode) return sourceRows.map(detail).join('')
      const materialGroups = new Map()
      sourceRows.forEach(row => {
        const key = `${row.materialCode || ''}\u0000${row.unit || ''}`
        if (!materialGroups.has(key)) materialGroups.set(key, [])
        materialGroups.get(key).push(row)
      })
      return [...materialGroups.values()].map(group => `${group.map(detail).join('')}<tr style="font-weight:800;background:#f3f4f6"><td colspan="${showWarehouse ? 4 : 3}">Tổng mã ${group[0].materialCode || '-'} · ${group[0].materialName || ''}</td><td class="right">${fmtQty(group.reduce((sum, row) => sum + Number(row.quantityOnHand || 0), 0))}</td><td>${group[0].unit || ''}</td><td></td></tr>`).join('')
    }
    let rows = ''
    let warehouseHeader = '<th>Kho</th>'
    if (printGroupByWarehouse) {
      warehouseHeader = ''
      const warehouses = new Map()
      filteredInventoryRows.forEach(row => {
        const code = row.warehouseCode || 'Chưa có mã kho'
        if (!warehouses.has(code)) warehouses.set(code, [])
        warehouses.get(code).push(row)
      })
      rows = [...warehouses.entries()]
        .sort(([, a], [, b]) => Math.max(...b.map(inventoryTimestamp)) - Math.max(...a.map(inventoryTimestamp)))
        .map(([code, group]) => `<tr style="font-weight:900;background:#dbeafe"><td colspan="6">KHO ${code} · Tổng ${quantityTotals(group)}</td></tr>${renderRows(group, false)}`)
        .join('')
    } else {
      rows = renderRows(filteredInventoryRows, true)
    }
    printHtml('Đối soát tồn kho', `
      <h1>ĐỐI SOÁT TỒN KHO</h1>
      <h2>Ngày ${shortInventoryDate(`${shiftDate}T00:00:00+07:00`)}${combineInventoryTotals ? ' · Đã gộp tổng cùng mã trong từng kho' : ' · Mới nhất ở trên'}</h2>
      <table><tr><th>Mã</th><th>Tên</th>${warehouseHeader}<th>Ngày nhập</th><th class="right">Tồn hệ thống</th><th>ĐVT</th><th class="right">Thực đếm</th></tr>${rows}</table>
    `)
  }

  const printPaymentNote = (note) => {
    const isReceipt = note.note_type === 'RECEIPT'
    printHtml(isReceipt ? 'Phiếu thu' : 'Phiếu chi', `
      <h1>PHIẾU ${isReceipt ? 'THU' : 'CHI'}</h1>
      <h2>Ngày ${note.note_date || note.noteDate || paymentDate}</h2>
      <p><b>Số:</b> ${note.note_number || note.noteNumber || ''}</p>
      <p><b>Đối tượng:</b> ${note.object_name || ''}</p>
      <p><b>${isReceipt ? 'Người nộp' : 'Người nhận'}:</b> ${note.recipient_name || ''}</p>
      <p><b>Địa chỉ:</b> ${note.address || ''}</p>
      <p><b>Nội dung ${isReceipt ? 'thu' : 'chi'}:</b> ${note.reason || ''}</p>
      <p><b>Thanh toán:</b> ${paymentMethodLabel(note.payment_method)}</p>
      <p><b>Số tiền:</b> <span class="bold">${fmtMoney(note.amount)}</span></p>
      <div class="sign"><div>${isReceipt ? 'Người nộp tiền' : 'Người nhận tiền'}<br><br><br>(Ký, họ tên)</div><div>Người lập phiếu<br><br><br>(Ký, họ tên)</div></div>
    `)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f6f7f9' }}>
      <Box sx={{ px: 2, py: 1.25, bgcolor: '#fff', borderBottom: '1px solid #ddd' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <ReceiptLongIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography fontWeight={900} sx={{ fontSize: 20 }}>Bàn giao ca thu ngân</Typography>
            <Typography variant="caption" color="text.secondary">Kiểm tiền, phiếu chi và đối soát tồn kho cuối ca</Typography>
          </Box>
          {loading && <CircularProgress size={20} />}
        </Stack>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ bgcolor: '#fff', borderBottom: '1px solid #ddd' }}>
        <Tab value={3} label="Mở / đóng ca · Nhập xuất kho" />
        <Tab value={0} label="Báo cáo / in bàn giao" />
        <Tab value={1} label="Đối soát tồn kho" />
        <Tab value={2} label="Phiếu thu / chi" />
      </Tabs>

      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {tab === 3 && <CounterWorkflow handoverUsers={handoverUsers} />}
        {tab === 0 && (
          <Stack spacing={2}>
            <Paper sx={{ p: 1.5, borderRadius: 1 }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25}>
                <TextField label="Ngày ca" type="date" size="small" value={shiftDate} onChange={e => setShiftDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Tên ca" size="small" value={shiftName} onChange={e => setShiftName(e.target.value)} />
                <TextField label="Mở ca" type="datetime-local" size="small" value={fromLocal} onChange={e => setFromLocal(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Bàn giao đến thời điểm" type="datetime-local" size="small" value={toLocal} onChange={e => setToLocal(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: localDatetimeValue() }} helperText="Không vượt quá thời điểm hiện tại" />
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadSummary}>Tải lại</Button>
              </Stack>
            </Paper>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 420px' }, gap: 2 }}>
              <Paper sx={{ p: 1.5, borderRadius: 1 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>Tổng kết trong ca</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                  <Chip label={`Hóa đơn: ${summary.orderCount || 0}`} />
                  <Chip label={`Cuống thẻ: ${summary.cardSlipCount || 0}`} />
                  <Chip color={(summary.unpaidOrderCount || 0) ? 'warning' : 'default'} label={`Chưa thanh toán: ${summary.unpaidOrderCount || 0}`} />
                  <Chip label={`Doanh thu: ${fmtMoney(summary.totalSales)}`} />
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                  <TextField label="Tiền mặt đầu ca" value={formatIntegerInput(openingCash)} onChange={e => setOpeningCash(parseIntegerInput(e.target.value))} inputMode="numeric" />
                  <TextField label="Khác (+/-)" value={formatIntegerInput(otherAmount)} onChange={e => setOtherAmount(parseIntegerInput(e.target.value, true))} inputMode="numeric" />
                  <Autocomplete options={handoverUsers} value={handoverUsers.find(item => item.username === handoverTo) || null} getOptionLabel={handoverUserLabel} isOptionEqualToValue={(option, value) => option?.username === value?.username} onChange={(_, value) => setHandoverTo(value?.username || '')} renderOption={(props, item) => <Box component="li" {...props} key={item.username}><Box><Typography>{handoverUserLabel(item)}</Typography><Typography variant="caption" color="text.secondary">{item.username}{item.email ? ` · ${item.email}` : ''}</Typography></Box></Box>} noOptionsText="Chưa có người dùng ROLE_COUNTER" renderInput={params => <TextField {...params} required label="Người nhận bàn giao" placeholder="Gõ để tìm người dùng có quyền bàn giao ca" />} />
                  <TextField label="Ghi chú" value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)} />
                </Box>
                <TableContainer sx={{ mt: 1.5 }}>
                  <Table size="small">
                    <TableBody>
                      <TableRow><TableCell>Thu tiền mặt</TableCell><TableCell align="right">{fmtMoney(summary.cashIn)}</TableCell></TableRow>
                      <TableRow><TableCell>Phiếu thu tiền mặt</TableCell><TableCell align="right">{fmtMoney(summary.receiptNoteCashTotal)}</TableCell></TableRow>
                      <TableRow><TableCell>Tiền thẻ / QR</TableCell><TableCell align="right">{fmtMoney(summary.bankingIn)}</TableCell></TableRow>
                      <TableRow><TableCell>Phiếu thu QR / chuyển khoản</TableCell><TableCell align="right">{fmtMoney(summary.receiptNoteBankTotal)}</TableCell></TableRow>
                      <TableRow><TableCell>Phiếu chi trong ca</TableCell><TableCell align="right">{fmtMoney(summary.paymentNoteTotal)}</TableCell></TableRow>
                      <TableRow><TableCell>Phiếu chi QR / chuyển khoản</TableCell><TableCell align="right">{fmtMoney(summary.bankPaymentNoteTotal)}</TableCell></TableRow>
                      <TableRow sx={{ bgcolor: 'rgba(25, 118, 210, 0.06)' }}><TableCell sx={{ fontWeight: 900 }}>Tổng Thu + Chi tiền mặt</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(summary.totalCashReceiptsExpenses)}</TableCell></TableRow>
                      <TableRow sx={{ bgcolor: 'rgba(25, 118, 210, 0.06)' }}><TableCell sx={{ fontWeight: 900 }}>Tổng Thu + Chi QR / chuyển khoản</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(summary.totalQrReceiptsExpenses)}</TableCell></TableRow>
                      <TableRow><TableCell colSpan={2} sx={{ pt: 2, pb: 0.5, fontWeight: 900 }}>Phân loại theo phương thức</TableCell></TableRow>
                      <TableRow><TableCell>Tiền mặt · Tổng Thu / Tổng Chi</TableCell><TableCell align="right">{fmtMoney(summary.totalCashReceipts)} / {fmtMoney(summary.totalCashExpenses)}</TableCell></TableRow>
                      <TableRow><TableCell>QR · Tổng Thu / Tổng Chi</TableCell><TableCell align="right">{fmtMoney(summary.totalQrReceipts)} / {fmtMoney(summary.totalQrExpenses)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Tổng phụ phiếu thu</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(summary.receiptNoteSubtotal)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Tổng phụ phiếu chi</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(summary.expenseNoteSubtotal)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Tổng Thu + Chi</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(summary.receiptExpenseTotal)}</TableCell></TableRow>
                      <TableRow><TableCell>Nợ / chưa thanh toán</TableCell><TableCell align="right">{fmtMoney(summary.debtAmount)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Tiền mặt dự kiến</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(expectedCash)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Thực tế kiểm đếm</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(cashActual)}</TableCell></TableRow>
                      <TableRow><TableCell sx={{ fontWeight: 900 }}>Chênh lệch</TableCell><TableCell align="right"><Chip size="small" color={cashDifference === 0 ? 'success' : 'warning'} label={fmtMoney(cashDifference)} /></TableCell></TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              <Paper sx={{ p: 1.5, borderRadius: 1 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>Chi tiết kiểm đếm</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Mệnh giá</TableCell><TableCell align="right">SL</TableCell><TableCell align="right">Thành tiền</TableCell></TableRow></TableHead>
                  <TableBody>
                    {DENOMINATIONS.map(value => {
                      const count = Number(denominationCounts[value] || 0)
                      return (
                        <TableRow key={value}>
                          <TableCell>{fmtMoney(value)}</TableCell>
                          <TableCell align="right" width={96}>
                            <TextField size="small" type="text" value={formatIntegerInput(denominationCounts[value])} onChange={e => setDenominationCounts(prev => ({ ...prev, [value]: parseIntegerInput(e.target.value) }))} inputProps={{ inputMode: 'numeric', min: 0, style: { textAlign: 'right' } }} />
                          </TableCell>
                          <TableCell align="right">{fmtMoney(value * count)}</TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow><TableCell sx={{ fontWeight: 900 }}>Tổng kiểm đếm</TableCell><TableCell /><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(cashActual)}</TableCell></TableRow>
                  </TableBody>
                </Table>
              </Paper>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="contained" startIcon={<SaveIcon />} onClick={saveHandover}>Lưu bàn giao ca</Button>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={printHandover}>In biên bản</Button>
            </Stack>

            {!!handovers.length && (
              <Paper sx={{ p: 1.5, borderRadius: 1 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>Biên bản đã lưu trong ngày</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Ca</TableCell><TableCell>Người lập</TableCell><TableCell align="right">Thực đếm</TableCell><TableCell align="right">Chênh lệch</TableCell><TableCell>Thời gian</TableCell></TableRow></TableHead>
                  <TableBody>
                    {handovers.map(row => <TableRow key={row.id}>
                      <TableCell>{row.shift_name || '-'}</TableCell>
                      <TableCell>{row.created_by || '-'}</TableCell>
                      <TableCell align="right">{fmtMoney(row.actual_cash)}</TableCell>
                      <TableCell align="right">{fmtMoney(row.difference_cash)}</TableCell>
                      <TableCell>{row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '-'}</TableCell>
                    </TableRow>)}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1.5}>
            <Paper sx={{ p: 1.5, borderRadius: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                <TextField label="Ngày kiểm" type="date" size="small" value={shiftDate} onChange={e => setShiftDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Lọc mã / tên nguyên vật liệu, kho, lô (có hoặc không dấu)" size="small" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} sx={{ minWidth: 360 }} />
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadInventory}>Tải tồn kho</Button>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={printInventorySnapshot}>In tồn hiện tại</Button>
                <Button variant="contained" startIcon={<Inventory2Icon />} onClick={saveReconciliation}>Lưu đối soát</Button>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
                <FormControlLabel control={<Checkbox size="small" checked={combineInventoryTotals} onChange={e => setCombineInventoryTotals(e.target.checked)} />} label="Gộp tổng cùng mã trong từng kho (bỏ chi tiết lô)" />
                <FormControlLabel control={<Checkbox size="small" checked={printGroupByWarehouse} onChange={e => setPrintGroupByWarehouse(e.target.checked)} />} label="Khi in: gom theo mã kho, bỏ cột kho lặp lại" />
                <FormControlLabel control={<Checkbox size="small" checked={printSubtotalByCode} onChange={e => setPrintSubtotalByCode(e.target.checked)} />} label="Khi in: thêm tổng phụ theo mã vật tư" />
              </Stack>
            </Paper>
            <TableContainer component={Paper} sx={{ borderRadius: 1, maxHeight: 'calc(100vh - 260px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Nguyên liệu</TableCell>
                    <TableCell>Kho / Ngày nhập</TableCell>
                    <TableCell align="right">Tồn hệ thống</TableCell>
                    <TableCell align="right">Thực đếm</TableCell>
                    <TableCell align="right">Chênh lệch</TableCell>
                    <TableCell>Lý do</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInventoryRows.map((row, rowIndex) => {
                    const key = inventoryRowKey(row)
                    const actualRaw = actualQtyById[key]
                    const systemQty = Number(row.quantityOnHand || 0)
                    const actual = actualRaw === undefined || actualRaw === '' ? null : Number(actualRaw)
                    const diff = actual === null || Number.isNaN(actual) ? null : actual - systemQty
                    const mismatch = diff !== null && Math.abs(diff) > 0.000001
                    return (
                      <TableRow key={key} hover sx={mismatch ? { bgcolor: 'warning.50' } : undefined}>
                        <TableCell>
                          <Typography fontWeight={800}>{row.materialCode || '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.materialName || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography>{row.warehouseCode || '-'}</Typography>
                          <Typography variant="caption" color="text.secondary">{shortInventoryDate(row.createdAt || row.updatedAt)}{combineInventoryTotals ? ` · ${row.sourceRows?.length || 1} dòng đã gộp` : ''}</Typography>
                        </TableCell>
                        <TableCell align="right">{fmtQty(row.quantityOnHand)} {row.unit || ''}</TableCell>
                        <TableCell align="right" width={150}>
                          <TextField size="small" type="text" value={formatQuantityInput(actualQtyById[key] ?? '')} onChange={e => setActualQtyById(prev => ({ ...prev, [key]: parseQuantityInput(e.target.value) }))}
                            inputRef={node => { if (node) inventoryCellRefs.current.actual[key] = node; else delete inventoryCellRefs.current.actual[key] }}
                            onKeyDown={event => {
                              if (event.nativeEvent.isComposing) return
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                focusInventoryCell(rowIndex + 1, 'actual')
                              } else if (event.key === 'Tab' && !event.shiftKey) {
                                event.preventDefault()
                                focusInventoryCell(rowIndex, 'reason')
                              }
                            }}
                            inputProps={{ step: 'any', style: { textAlign: 'right' }, 'aria-label': `Thực đếm ${row.materialCode || rowIndex + 1}` }} />
                        </TableCell>
                        <TableCell align="right">{diff === null ? '-' : <Chip size="small" color={mismatch ? 'warning' : 'success'} label={fmtQty(diff)} />}</TableCell>
                        <TableCell width={240}>
                          <TextField size="small" value={reasonById[key] ?? ''} onChange={e => setReasonById(prev => ({ ...prev, [key]: e.target.value }))} placeholder="Không bắt buộc" fullWidth
                            inputRef={node => { if (node) inventoryCellRefs.current.reason[key] = node; else delete inventoryCellRefs.current.reason[key] }}
                            inputProps={{ 'aria-label': `Lý do ${row.materialCode || rowIndex + 1}` }} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {!!reconciliations.length && <Typography variant="caption" color="text.secondary">Đã lưu {reconciliations.length} dòng đối soát cho ngày này.</Typography>}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Chip color="success" label={`Tổng phiếu thu: ${fmtMoney(paymentNoteTotals.receipt)}`} />
              <Chip color="error" label={`Tổng phiếu chi: ${fmtMoney(paymentNoteTotals.expense)}`} />
              <Chip color="primary" label={`Tổng Thu + Chi: ${fmtMoney(paymentNoteTotals.total)}`} />
            </Stack>
            <TableContainer component={Paper} sx={{ borderRadius: 1, maxWidth: 720 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Phương thức</TableCell><TableCell align="right">Thu</TableCell><TableCell align="right">Chi</TableCell><TableCell align="right">Thu + Chi</TableCell></TableRow></TableHead>
                <TableBody>
                  <TableRow><TableCell>Tiền mặt</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.cashReceipt)}</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.cashExpense)}</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(paymentNoteTotals.cashTotal)}</TableCell></TableRow>
                  <TableRow><TableCell>QR / chuyển khoản</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.qrReceipt)}</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.qrExpense)}</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(paymentNoteTotals.qrTotal)}</TableCell></TableRow>
                  {paymentNoteTotals.deferredTotal > 0 && <TableRow><TableCell>Chưa thu/chi · xử lý sau</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.deferredReceipt)}</TableCell><TableCell align="right">{fmtMoney(paymentNoteTotals.deferredExpense)}</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>{fmtMoney(paymentNoteTotals.deferredTotal)}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
            <Paper sx={{ p: 1.5, borderRadius: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '160px 160px 1fr 1fr' }, gap: 1.25 }}>
                <TextField label="Ngày" type="date" size="small" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField select label="Loại phiếu" size="small" value={paymentForm.noteType} onChange={e => setPaymentForm(prev => ({ ...prev, noteType: e.target.value }))}>
                  <MenuItem value="EXPENSE">Phiếu chi</MenuItem><MenuItem value="RECEIPT">Phiếu thu</MenuItem>
                </TextField>
                <TextField label="Đối tượng" size="small" value={paymentForm.objectName} onChange={e => setPaymentForm(prev => ({ ...prev, objectName: e.target.value }))} />
                <TextField required label={paymentForm.noteType === 'RECEIPT' ? 'Người nộp' : 'Người nhận'} size="small" value={paymentForm.recipientName} onChange={e => setPaymentForm(prev => ({ ...prev, recipientName: e.target.value }))} helperText="Người dùng nhập và xác nhận trước khi hệ thống tạo phiếu" />
                <TextField label="Địa chỉ" size="small" value={paymentForm.address} onChange={e => setPaymentForm(prev => ({ ...prev, address: e.target.value }))} />
                <TextField label={paymentForm.noteType === 'RECEIPT' ? 'Nội dung thu' : 'Lý do chi'} size="small" required value={paymentForm.reason} onChange={e => setPaymentForm(prev => ({ ...prev, reason: e.target.value }))} />
                <TextField label="Số tiền" size="small" required value={formatIntegerInput(paymentForm.amount)} onChange={e => setPaymentForm(prev => ({ ...prev, amount: parseIntegerInput(e.target.value) }))} inputMode="numeric" />
                <TextField select label="Thanh toán" size="small" value={paymentForm.paymentMethod} onChange={e => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))} helperText={['UNPAID', 'BANK_LATER'].includes(paymentForm.paymentMethod) ? 'Ghi nhận công nợ, chưa cộng/trừ số dư ca' : ''}>
                  <MenuItem value="CASH">Tiền mặt</MenuItem>
                  <MenuItem value="BANK_QR">QR / chuyển khoản ngay</MenuItem>
                  <MenuItem value="UNPAID">Chưa thu / chưa chi tiền</MenuItem>
                  <MenuItem value="BANK_LATER">Ngân hàng cửa hàng · xử lý sau</MenuItem>
                </TextField>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={savePaymentNote}>Tạo {paymentForm.noteType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'}</Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadPaymentNotes}>Tải lại</Button>
              </Stack>
            </Paper>
            <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Số phiếu</TableCell><TableCell>Loại</TableCell><TableCell>Ca / giờ ghi nhận</TableCell><TableCell>Nội dung</TableCell><TableCell>Người nhận / nộp</TableCell><TableCell>Thanh toán</TableCell><TableCell align="right">Số tiền</TableCell><TableCell>Bàn giao</TableCell><TableCell>Người lập</TableCell><TableCell align="right">In</TableCell></TableRow></TableHead>
                <TableBody>
                  {paymentNotes.map(note => (
                    <TableRow key={note.id} hover>
                      <TableCell>{note.note_number || '-'}</TableCell>
                      <TableCell>{note.note_type === 'RECEIPT' ? 'Thu' : 'Chi'}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700}>{note.shift_name || 'Chưa gắn ca'}</Typography><Typography variant="caption" color="text.secondary">{note.created_at ? new Date(note.created_at).toLocaleString('vi-VN') : '-'}</Typography></TableCell>
                      <TableCell>{note.reason || '-'}</TableCell>
                      <TableCell>{note.recipient_name || '-'}</TableCell>
                      <TableCell>{paymentMethodLabel(note.payment_method)}</TableCell>
                      <TableCell align="right">{fmtMoney(note.amount)}</TableCell>
                      <TableCell>{note.handed_over_at ? new Date(note.handed_over_at).toLocaleString('vi-VN') : note.shift_status === 'OPEN' ? 'Ca đang mở' : '-'}</TableCell>
                      <TableCell>{note.created_by || '-'}</TableCell>
                      <TableCell align="right"><Button size="small" startIcon={<PrintIcon />} onClick={() => printPaymentNote(note)}>In</Button></TableCell>
                    </TableRow>
                  ))}
                  {!paymentNotes.length && <TableRow><TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có phiếu thu / chi trong ngày</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Box>
    </Box>
  )
}
