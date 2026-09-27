import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControlLabel, Paper, Stack, Tab, Table,
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
  fetchCounterPaymentNotes,
  fetchCounterShiftHandovers,
  fetchCounterShiftSummary,
  saveCounterInventoryReconciliation,
} from '../../api/shopApi'
import CounterWorkflow from './CounterWorkflow'
import { useAuth } from '../../context/useAuth'

const DENOMINATIONS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500]

const fmtMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const fmtQty = (value) => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 4 })
const digits = (value) => String(value || '').replace(/[^\d.-]/g, '')
const moneyNumber = (value) => Number(digits(value)) || 0
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

function localDateValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function localDatetimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function defaultShiftStart() {
  const d = new Date()
  d.setHours(6, 0, 0, 0)
  return localDatetimeValue(d)
}

function toIso(localValue) {
  const d = new Date(localValue)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
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

  const [shiftDate, setShiftDate] = useState(localDateValue())
  const [fromLocal, setFromLocal] = useState(defaultShiftStart())
  const [toLocal, setToLocal] = useState(localDatetimeValue())
  const [shiftName, setShiftName] = useState('Ca hiện tại')
  const [handoverTo, setHandoverTo] = useState('')
  const [openingCash, setOpeningCash] = useState('')
  const [otherAmount, setOtherAmount] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [denominationCounts, setDenominationCounts] = useState(() => Object.fromEntries(DENOMINATIONS.map(v => [v, ''])))
  const [summary, setSummary] = useState({})
  const [handovers, setHandovers] = useState([])

  const [inventoryRows, setInventoryRows] = useState([])
  const [inventorySearch, setInventorySearch] = useState('')
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

  const openingCashNumber = moneyNumber(openingCash)
  const otherAmountNumber = moneyNumber(otherAmount)
  const expectedCash = openingCashNumber
    + Number(summary.cashIn || 0)
    + Number(summary.receiptNoteCashTotal || 0)
    + otherAmountNumber
    - Number(summary.paymentNoteTotal || 0)
  const cashDifference = cashActual - expectedCash

  const filteredInventoryRows = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase()
    const rows = q ? inventoryRows.filter(row => [
      row.materialCode, row.materialName, row.warehouseCode, row.warehouseName, row.batchNo
    ].some(value => String(value || '').toLowerCase().includes(q))) : inventoryRows
    return [...rows].sort((a, b) => inventoryTimestamp(b) - inventoryTimestamp(a)
      || String(a.materialCode || '').localeCompare(String(b.materialCode || '')))
  }, [inventoryRows, inventorySearch])

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
      const data = await apiData(fetchCounterShiftSummary({ from: toIso(fromLocal), to: toIso(toLocal) }))
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
      setInventoryRows(Array.isArray(snapshot) ? snapshot : [])
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
  useEffect(() => { if (tab === 1 && inventoryRows.length === 0) loadInventory() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 2) loadPaymentNotes() }, [tab, paymentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveHandover = async () => {
    setError(''); setSuccess('')
    try {
      await apiData(createCounterShiftHandover({
        shiftDate,
        shiftName,
        openedAt: toIso(fromLocal),
        closedAt: toIso(toLocal),
        handoverBy: user?.username || '',
        handoverTo,
        openingCash: openingCashNumber,
        cashSales: summary.cashIn || 0,
        bankSales: Number(summary.bankingIn || 0) + Number(summary.receiptNoteBankTotal || 0),
        debtAmount: summary.debtAmount || 0,
        otherAmount: otherAmountNumber,
        paymentNoteTotal: summary.paymentNoteTotal || 0,
        expectedCash,
        actualCash: cashActual,
        differenceCash: cashDifference,
        orderCount: summary.orderCount || 0,
        cardSlipCount: summary.cardSlipCount || 0,
        unpaidOrderCount: summary.unpaidOrderCount || 0,
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
    const rows = inventoryRows
      .filter(row => actualQtyById[row.inventoryId || row.id] !== undefined && actualQtyById[row.inventoryId || row.id] !== '')
      .map(row => {
        const key = row.inventoryId || row.id
        return {
          inventoryId: row.inventoryId || row.id,
          materialId: row.materialId,
          materialCode: row.materialCode,
          materialName: row.materialName,
          warehouseId: row.warehouseId,
          warehouseCode: row.warehouseCode,
          warehouseName: row.warehouseName,
          batchNo: row.batchNo,
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

  const printHandover = () => {
    const denominationRows = DENOMINATIONS.map(value => {
      const count = Number(denominationCounts[value] || 0)
      if (!count) return ''
      return `<tr><td class="right">${fmtMoney(value)}</td><td class="right">${count}</td><td class="right">${fmtMoney(value * count)}</td></tr>`
    }).join('')
    const paymentRows = paymentNotes.filter(note => (note.note_type || 'EXPENSE') === 'EXPENSE').map((note, idx) =>
      `<tr><td>${idx + 1}</td><td>${note.reason || ''}</td><td class="right">${fmtMoney(note.amount)}</td></tr>`
    ).join('')
    printHtml('Biên bản bàn giao ca', `
      <h1>BIÊN BẢN BÀN GIAO CA</h1>
      <h2>${shiftName || ''} ngày ${shiftDate}</h2>
      <p><b>Giờ mở ca:</b> ${fromLocal} &nbsp; <b>Giờ đóng ca:</b> ${toLocal}</p>
      <p><b>Người bàn giao:</b> ${user?.username || ''}</p>
      <div class="section">Nội dung bàn giao</div>
      <table>
        <tr><td>Tổng doanh thu</td><td class="right bold">${fmtMoney(summary.totalSales)}</td></tr>
        <tr><td>Tiền mặt đầu ca</td><td class="right">${fmtMoney(openingCashNumber)}</td></tr>
        <tr><td>Thu tiền mặt trong ca</td><td class="right">${fmtMoney(summary.cashIn)}</td></tr>
        <tr><td>Phiếu thu tiền mặt</td><td class="right">${fmtMoney(summary.receiptNoteCashTotal)}</td></tr>
        <tr><td>Chi trong ca</td><td class="right">${fmtMoney(summary.paymentNoteTotal)}</td></tr>
        <tr><td>Tiền thẻ / chuyển khoản</td><td class="right">${fmtMoney(summary.bankingIn)}</td></tr>
        <tr><td>Phiếu thu QR / chuyển khoản</td><td class="right">${fmtMoney(summary.receiptNoteBankTotal)}</td></tr>
        <tr><td>Phiếu chi QR / chuyển khoản</td><td class="right">${fmtMoney(summary.bankPaymentNoteTotal)}</td></tr>
        <tr><td>Order chưa thanh toán</td><td class="right">${summary.unpaidOrderCount || 0}</td></tr>
        <tr><td>Tiền dự kiến trong két</td><td class="right">${fmtMoney(expectedCash)}</td></tr>
        <tr><td>Thực tế kiểm đếm</td><td class="right">${fmtMoney(cashActual)}</td></tr>
        <tr><td>Chênh lệch</td><td class="right bold">${fmtMoney(cashDifference)}</td></tr>
      </table>
      <div class="section">Chi tiết kiểm đếm</div>
      <table><tr><th>Mệnh giá</th><th class="right">SL</th><th class="right">Thành tiền</th></tr>${denominationRows}</table>
      <div class="section">Các khoản chi tiền mặt</div>
      <table><tr><th>#</th><th>Lý do chi</th><th class="right">Số tiền</th></tr>${paymentRows || '<tr><td colspan="3">Không có</td></tr>'}</table>
      <p><b>Ghi chú:</b> ${handoverNotes || ''}</p>
      <div class="sign"><div>Người bàn giao<br><br><br>(Ký, họ tên)</div><div>Người nhận bàn giao<br><br><br>(Ký, họ tên)</div></div>
    `)
  }

  const printInventorySnapshot = () => {
    const renderRows = (sourceRows, showWarehouse) => {
      const detail = row => `<tr><td>${row.materialCode || ''}</td><td>${row.materialName || ''}</td>${showWarehouse ? `<td>${row.warehouseCode || '-'}</td>` : ''}<td>${row.batchNo || '-'}</td><td>${shortInventoryDate(row.createdAt || row.updatedAt)}</td><td class="right">${fmtQty(row.quantityOnHand)}</td><td>${row.unit || ''}</td><td></td></tr>`
      if (!printSubtotalByCode) return sourceRows.map(detail).join('')
      const materialGroups = new Map()
      sourceRows.forEach(row => {
        const key = `${row.materialCode || ''}\u0000${row.unit || ''}`
        if (!materialGroups.has(key)) materialGroups.set(key, [])
        materialGroups.get(key).push(row)
      })
      return [...materialGroups.values()].map(group => `${group.map(detail).join('')}<tr style="font-weight:800;background:#f3f4f6"><td colspan="${showWarehouse ? 5 : 4}">Tổng mã ${group[0].materialCode || '-'} · ${group[0].materialName || ''}</td><td class="right">${fmtQty(group.reduce((sum, row) => sum + Number(row.quantityOnHand || 0), 0))}</td><td>${group[0].unit || ''}</td><td></td></tr>`).join('')
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
        .map(([code, group]) => `<tr style="font-weight:900;background:#dbeafe"><td colspan="7">KHO ${code} · Tổng ${quantityTotals(group)}</td></tr>${renderRows(group, false)}`)
        .join('')
    } else {
      rows = renderRows(filteredInventoryRows, true)
    }
    printHtml('Đối soát tồn kho', `
      <h1>ĐỐI SOÁT TỒN KHO</h1>
      <h2>Ngày ${shortInventoryDate(`${shiftDate}T00:00:00+07:00`)} · Lô mới nhất ở trên</h2>
      <table><tr><th>Mã</th><th>Tên</th>${warehouseHeader}<th>Lô</th><th>Ngày nhập</th><th class="right">Tồn hệ thống</th><th>ĐVT</th><th>Thực đếm</th></tr>${rows}</table>
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

        {tab === 3 && <CounterWorkflow />}
        {tab === 0 && (
          <Stack spacing={2}>
            <Paper sx={{ p: 1.5, borderRadius: 1 }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25}>
                <TextField label="Ngày ca" type="date" size="small" value={shiftDate} onChange={e => setShiftDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Tên ca" size="small" value={shiftName} onChange={e => setShiftName(e.target.value)} />
                <TextField label="Mở ca" type="datetime-local" size="small" value={fromLocal} onChange={e => setFromLocal(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Đóng ca" type="datetime-local" size="small" value={toLocal} onChange={e => setToLocal(e.target.value)} InputLabelProps={{ shrink: true }} />
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
                  <TextField label="Tiền mặt đầu ca" value={openingCash} onChange={e => setOpeningCash(digits(e.target.value))} inputMode="numeric" />
                  <TextField label="Khác (+/-)" value={otherAmount} onChange={e => setOtherAmount(digits(e.target.value))} inputMode="numeric" />
                  <TextField label="Người nhận bàn giao" value={handoverTo} onChange={e => setHandoverTo(e.target.value)} />
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
                            <TextField size="small" type="number" value={denominationCounts[value]} onChange={e => setDenominationCounts(prev => ({ ...prev, [value]: e.target.value }))} inputProps={{ min: 0, style: { textAlign: 'right' } }} />
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
                <TextField label="Tìm nguyên liệu / kho / lô" size="small" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} sx={{ minWidth: 280 }} />
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadInventory}>Tải tồn kho</Button>
                <Button variant="outlined" startIcon={<PrintIcon />} onClick={printInventorySnapshot}>In tồn hiện tại</Button>
                <Button variant="contained" startIcon={<Inventory2Icon />} onClick={saveReconciliation}>Lưu đối soát</Button>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
                <FormControlLabel control={<Checkbox size="small" checked={printGroupByWarehouse} onChange={e => setPrintGroupByWarehouse(e.target.checked)} />} label="Khi in: gom theo mã kho, bỏ cột kho lặp lại" />
                <FormControlLabel control={<Checkbox size="small" checked={printSubtotalByCode} onChange={e => setPrintSubtotalByCode(e.target.checked)} />} label="Khi in: thêm tổng phụ theo mã vật tư" />
              </Stack>
            </Paper>
            <TableContainer component={Paper} sx={{ borderRadius: 1, maxHeight: 'calc(100vh - 260px)' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Nguyên liệu</TableCell>
                    <TableCell>Kho / Lô</TableCell>
                    <TableCell align="right">Tồn hệ thống</TableCell>
                    <TableCell align="right">Thực đếm</TableCell>
                    <TableCell align="right">Chênh lệch</TableCell>
                    <TableCell>Lý do</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInventoryRows.map((row, rowIndex) => {
                    const key = row.inventoryId || row.id
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
                          <Typography variant="caption" color="text.secondary">{row.batchNo || '-'} · {shortInventoryDate(row.createdAt || row.updatedAt)}</Typography>
                        </TableCell>
                        <TableCell align="right">{fmtQty(row.quantityOnHand)} {row.unit || ''}</TableCell>
                        <TableCell align="right" width={150}>
                          <TextField size="small" type="number" value={actualQtyById[key] ?? ''} onChange={e => setActualQtyById(prev => ({ ...prev, [key]: e.target.value }))}
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
            <Paper sx={{ p: 1.5, borderRadius: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '160px 160px 1fr 1fr' }, gap: 1.25 }}>
                <TextField label="Ngày" type="date" size="small" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField select label="Loại phiếu" size="small" value={paymentForm.noteType} onChange={e => setPaymentForm(prev => ({ ...prev, noteType: e.target.value }))}>
                  <MenuItem value="EXPENSE">Phiếu chi</MenuItem><MenuItem value="RECEIPT">Phiếu thu</MenuItem>
                </TextField>
                <TextField label="Đối tượng" size="small" value={paymentForm.objectName} onChange={e => setPaymentForm(prev => ({ ...prev, objectName: e.target.value }))} />
                <TextField label="Người nhận" size="small" value={paymentForm.recipientName} onChange={e => setPaymentForm(prev => ({ ...prev, recipientName: e.target.value }))} />
                <TextField label="Địa chỉ" size="small" value={paymentForm.address} onChange={e => setPaymentForm(prev => ({ ...prev, address: e.target.value }))} />
                <TextField label={paymentForm.noteType === 'RECEIPT' ? 'Nội dung thu' : 'Lý do chi'} size="small" required value={paymentForm.reason} onChange={e => setPaymentForm(prev => ({ ...prev, reason: e.target.value }))} />
                <TextField label="Số tiền" size="small" required value={paymentForm.amount} onChange={e => setPaymentForm(prev => ({ ...prev, amount: digits(e.target.value) }))} inputMode="numeric" />
                <TextField select label="Thanh toán" size="small" value={paymentForm.paymentMethod} onChange={e => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}>
                  <MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_QR">QR / chuyển khoản</MenuItem>
                </TextField>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={savePaymentNote}>Tạo {paymentForm.noteType === 'RECEIPT' ? 'phiếu thu' : 'phiếu chi'}</Button>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadPaymentNotes}>Tải lại</Button>
              </Stack>
            </Paper>
            <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Số phiếu</TableCell><TableCell>Loại</TableCell><TableCell>Nội dung</TableCell><TableCell>Người nhận / nộp</TableCell><TableCell>Thanh toán</TableCell><TableCell align="right">Số tiền</TableCell><TableCell>Người lập</TableCell><TableCell align="right">In</TableCell></TableRow></TableHead>
                <TableBody>
                  {paymentNotes.map(note => (
                    <TableRow key={note.id} hover>
                      <TableCell>{note.note_number || '-'}</TableCell>
                      <TableCell>{note.note_type === 'RECEIPT' ? 'Thu' : 'Chi'}</TableCell>
                      <TableCell>{note.reason || '-'}</TableCell>
                      <TableCell>{note.recipient_name || '-'}</TableCell>
                      <TableCell>{note.payment_method === 'BANK_QR' ? 'QR / chuyển khoản' : 'Tiền mặt'}</TableCell>
                      <TableCell align="right">{fmtMoney(note.amount)}</TableCell>
                      <TableCell>{note.created_by || '-'}</TableCell>
                      <TableCell align="right"><Button size="small" startIcon={<PrintIcon />} onClick={() => printPaymentNote(note)}>In</Button></TableCell>
                    </TableRow>
                  ))}
                  {!paymentNotes.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có phiếu thu / chi trong ngày</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </Box>
    </Box>
  )
}
