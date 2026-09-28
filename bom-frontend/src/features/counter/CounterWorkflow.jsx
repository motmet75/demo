import React, { useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Avatar, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { formatIntegerInput, formatQuantityInput, parseIntegerInput, parseQuantityInput } from '../../utils/numberInput'
import { apiFetchJson } from '../../api/client'

const money = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 6 })
const financialMethodOptions = [
  ['CASH', 'Tiền mặt'],
  ['BANK_QR', 'QR / chuyển khoản ngay'],
  ['UNPAID', 'Chưa thu / chưa chi tiền'],
  ['BANK_LATER', 'Ngân hàng cửa hàng · xử lý sau'],
]
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
const availableQuantity = row => Math.max(0, Number(row?.quantity_on_hand || 0) - Number(row?.quantity_reserved || 0) - Number(row?.quantity_locked || 0))
const fifoDate = row => new Date(row?.production_date_time || row?.created_at || 0).getTime() || 0
const sortFifo = rows => [...rows].sort((a, b) => fifoDate(a) - fifoDate(b)
    || String(a.warehouse_code || '').localeCompare(String(b.warehouse_code || ''))
    || String(a.batch_no || '').localeCompare(String(b.batch_no || '')))
const movementLine = defaults => ({ id: crypto.randomUUID(), requestId: crypto.randomUUID(), materialId: null, inventory: null, selectedInventoryIds: [], newBatch: false, materialInput: '', quantity: '', unit: '', unitPrice: '', reason: '', ...defaults })
const hasMovementInput = line => Boolean(line.inventory || line.materialInput.trim() || line.quantity !== '' || line.reason.trim())
const combineHistoryCounts = rows => {
  const groups = new Map()
  rows.forEach(row => {
    const key = `${row.material_code || row.material_name || ''}|${row.unit || ''}`
    if (!groups.has(key)) groups.set(key, { ...row, id: `combined:${key}`, quantity_on_hand: 0, actual: 0, difference: 0, reasons: new Set() })
    const group = groups.get(key)
    group.quantity_on_hand += Number(row.quantity_on_hand || 0)
    group.actual += Number(row.actual || 0)
    group.difference += Number(row.difference || 0)
    if (row.reason) group.reasons.add(row.reason)
  })
  return [...groups.values()].map(row => ({ ...row, reason: [...row.reasons].join('; ') }))
}
async function api(path = '', body) {
  const { res, data } = await apiFetchJson(`/shop/staff/counter/workflow${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(data?.message || data?.detail || (typeof data === 'string' ? data : 'Không lưu được. Kiểm tra dữ liệu và thử lại.'))
  return data
}
const handoverUserLabel = user => typeof user === 'string' ? user : [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || ''

export default function CounterWorkflow({ handoverUsers = [] }) {
  const [state, setState] = useState({}), [stock, setStock] = useState([])
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  const [record,setRecord] = useState(null)
  const [historyCombineMaterials, setHistoryCombineMaterials] = useState(true)
  const [shiftNumber, setShiftNumber] = useState('')
  const [dialog, setDialog] = useState(''), [sample, setSample] = useState(false)
  const [opening, setOpening] = useState(''), [openingBank, setOpeningBank] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [cash, setCash] = useState(''), [bank, setBank] = useState(''), [receiver, setReceiver] = useState(''), [counts, setCounts] = useState({})
  const [movementLines, setMovementLines] = useState([movementLine()])
  const [movementLocation, setMovementLocation] = useState({ warehouseId: '', batchNo: '' })
  const [financialNote, setFinancialNote] = useState({ create: false, paymentMethod: 'CASH', amount: '', reason: '', objectName: '' })
  const [summary, setSummary] = useState(null), [search, setSearch] = useState('')
  const movementCells = useRef({}), nextMovementFocus = useRef(null), movementDefaults = useRef({})
  const saving = useRef(false)
  const reload = async () => { const [s, rows] = await Promise.all([api(), api('/stock')]); setState(s); setStock(rows); return { s, rows } }
  useEffect(() => { reload().catch(e => setError(e.message)) }, [])
  const act = async fn => { if(saving.current) return; saving.current=true; setBusy(true); setError(''); try { await fn() } catch(e) { setError(e.message) } finally { saving.current=false; setBusy(false) } }
  const start = kind => {
    setError(''); setSuccess(''); setReason(''); setConfirmed(false); setDialog(kind); setSample(false)
    if (['IN','OUT','ADJUSTMENT'].includes(kind)) {
      try { movementDefaults.current = JSON.parse(sessionStorage.getItem('counter.movement.defaults') || '{}') } catch { movementDefaults.current = {} }
      setMovementLocation({ warehouseId: movementDefaults.current.warehouseId || '', batchNo: kind === 'OUT' ? '' : movementDefaults.current.batchNo || '' })
      setMovementLines([movementLine()])
      setFinancialNote({ create: false, paymentMethod: 'CASH', amount: '', reason: '', objectName: '' })
    }
    if(kind === 'OPEN') { setOpening(state.previousCash ?? ''); setOpeningBank(state.previousBank ?? ''); setShiftNumber(String((state.usedShifts || []).includes(state.suggestedShift) ? [1,2].find(n=>!(state.usedShifts || []).includes(n)) || '' : state.suggestedShift || 1)) }
  }
  const rememberMovementLocation = (warehouseId, batchNo) => {
    movementDefaults.current = { warehouseId: warehouseId || '', batchNo: batchNo || '' }
    try { sessionStorage.setItem('counter.movement.defaults', JSON.stringify(movementDefaults.current)) } catch { /* in-memory fallback */ }
  }
  const updateMovementLine = (id, patch) => setMovementLines(prev => prev.map(line => line.id === id ? { ...line, ...patch } : line))
  const inventoryPatch = inventory => {
    const unit = inventory.warehouse_import_unit || inventory.unit
    return {
      inventory,
      newBatch: false,
      materialId: inventory.material_id,
      materialInput: `${inventory.material_code} — ${inventory.material_name}`,
      unit,
      unitPrice: unit === inventory.warehouse_import_unit ? inventory.warehouse_import_unit_price ?? inventory.unit_price ?? 0 : inventory.unit_price ?? 0,
    }
  }
  const outInventoriesFor = (materialId, location = movementLocation) => sortFifo(stock.filter(row =>
      String(row.material_id) === String(materialId)
      && (!location.warehouseId || String(row.warehouse_id) === String(location.warehouseId))
      && (!location.batchNo || String(row.batch_no || '') === String(location.batchNo))
      && availableQuantity(row) > 0))
  const applyMovementLocation = (warehouseId, batchNo, targetLineId = '', targetInventory = null) => {
    const next = { warehouseId: warehouseId || '', batchNo: batchNo || '' }
    setMovementLocation(next)
    rememberMovementLocation(next.warehouseId, next.batchNo)
    setMovementLines(prev => prev.map(line => {
      const selectedInventory = line.id === targetLineId ? targetInventory : null
      const materialId = selectedInventory?.material_id || line.materialId || line.inventory?.material_id
      if (!materialId) return line
      if (dialog === 'OUT') {
        const candidates = outInventoriesFor(materialId, next)
        return candidates.length
            ? { ...line, ...inventoryPatch(candidates[0]), selectedInventoryIds: candidates.map(row => String(row.id)) }
            : { ...line, materialId, inventory: null, selectedInventoryIds: [], unit: '', unitPrice: '' }
      }
      const replacement = stock.find(row => String(row.material_id) === String(materialId)
          && (!next.warehouseId || String(row.warehouse_id) === String(next.warehouseId))
          && (!next.batchNo || String(row.batch_no || '') === String(next.batchNo)))
      const template = selectedInventory || line.inventory || stock.find(row => String(row.material_id) === String(materialId)
          && (!next.warehouseId || String(row.warehouse_id) === String(next.warehouseId))) || stock.find(row => String(row.material_id) === String(materialId))
      return replacement
          ? { ...line, ...inventoryPatch(replacement) }
          : dialog === 'IN' && template && next.warehouseId && next.batchNo
              ? { ...line, ...inventoryPatch(template), newBatch: true }
              : { ...line, materialId, inventory: null, unit: '', unitPrice: '' }
    }))
  }
  const selectMovementInventory = (line, inventory) => {
    if (!inventory) { updateMovementLine(line.id, { materialId: null, inventory: null, selectedInventoryIds: [], newBatch: false, unit: '', unitPrice: '' }); return }
    if (dialog === 'OUT') {
      const candidates = outInventoriesFor(inventory.material_id)
      const oldest = candidates[0] || inventory
      updateMovementLine(line.id, { ...inventoryPatch(oldest), selectedInventoryIds: candidates.map(row => String(row.id)) })
      return
    }
    const warehouseId = dialog === 'IN' && movementLocation.warehouseId ? movementLocation.warehouseId : inventory.warehouse_id
    const batchNo = dialog === 'IN' && movementLocation.batchNo ? movementLocation.batchNo : inventory.batch_no
    applyMovementLocation(warehouseId, batchNo, line.id, inventory)
  }
  const movementOptions = line => {
    const query = normalizeSearch(line.materialInput)
    const locationRows = stock.filter(row => (!movementLocation.warehouseId || String(row.warehouse_id) === String(movementLocation.warehouseId))
        && (dialog === 'IN' || !movementLocation.batchNo || String(row.batch_no || '') === String(movementLocation.batchNo))
        && (dialog !== 'OUT' || availableQuantity(row) > 0))
    const matches = query ? locationRows.filter(row => normalizeSearch(`${row.material_code} ${row.material_name} ${row.warehouse_code} ${row.warehouse_name} ${row.batch_no}`).includes(query)) : locationRows
    const options = ['IN','OUT'].includes(dialog) ? [...new Map(sortFifo(matches).map(row => [String(row.material_id), row])).values()] : matches
    return options.slice(0, 80)
  }
  const addMovementLine = (afterId = movementLines.at(-1)?.id) => {
    const index = movementLines.findIndex(line => line.id === afterId)
    const existing = movementLines[index + 1]
    if (existing && !hasMovementInput(existing)) {
      nextMovementFocus.current = `${existing.id}:material`
      setMovementLines(prev => [...prev])
      return
    }
    const row = movementLine()
    nextMovementFocus.current = `${row.id}:material`
    setMovementLines(prev => [...prev.slice(0, index + 1), row, ...prev.slice(index + 1)])
  }
  useEffect(() => {
    if (nextMovementFocus.current) {
      movementCells.current[nextMovementFocus.current]?.focus()
      nextMovementFocus.current = null
    }
  }, [movementLines])
  const closeSetup = async (preview = false) => {
    await act(async () => {
      const { s, rows } = await reload(); setCounts(Object.fromEntries(rows.map(r => [r.id, {actual:r.quantity_on_hand, reason:''}]))); setCash(''); setBank(''); setReceiver(''); setReason(''); setConfirmed(false); setSample(preview)
      if(preview) { setOpening(s.previousCash ?? 500000); setCash(s.previousCash ?? 500000); setBank('0'); setReceiver('Người nhận mẫu'); setSummary({cashIn:0,bankingIn:0,paymentNoteTotal:0,receiptNoteCashTotal:0,receiptNoteBankTotal:0}); }
      else {
        const from = new Date(s.active.opened_at).toISOString()
        const {res,data} = await apiFetchJson(`/shop/staff/counter/shift-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date().toISOString())}`)
        if(!res.ok) throw new Error('Không tải được tổng kết')
        setSummary(data)
        setCash(String(Number(s.active.opening_cash || 0) + Number(data?.cashIn || 0) + Number(data?.receiptNoteCashTotal || 0) - Number(data?.paymentNoteTotal || 0)))
        setBank(String(Number(s.active.opening_bank || 0) + Number(data?.bankingIn || 0) + Number(data?.receiptNoteBankTotal || 0) - Number(data?.bankPaymentNoteTotal || 0)))
      }
      setDialog('CLOSE')
    })
  }
  const saveMovementLines = e => { e.preventDefault(); act(async () => {
    const rows = movementLines.filter(hasMovementInput)
    if (!rows.length) throw new Error('Nhập ít nhất một dòng hàng')
    if (dialog === 'IN' && !movementLocation.warehouseId) throw new Error('Chọn kho chung cho phiếu nhập')
    if (dialog === 'IN' && !movementLocation.batchNo.trim()) throw new Error('Nhập số lô cho phiếu nhập')
    rows.forEach((line, index) => {
      if (!line.inventory) throw new Error(`Dòng ${index + 1}: chọn vật tư / kho / lô trong danh sách`)
      if (dialog === 'OUT' && !line.selectedInventoryIds?.length) throw new Error(`Dòng ${index + 1}: chọn ít nhất một Kho / số lô để xuất`)
      if (!(Number(line.quantity) > 0) && dialog !== 'ADJUSTMENT') throw new Error(`Dòng ${index + 1}: số lượng phải lớn hơn 0`)
      if (!Number.isFinite(Number(line.quantity)) || (dialog === 'ADJUSTMENT' && Number(line.quantity) === 0)) throw new Error(`Dòng ${index + 1}: số lượng không hợp lệ`)
      if (line.unitPrice === '' || Number(line.unitPrice) < 0 || !Number.isFinite(Number(line.unitPrice))) throw new Error(`Dòng ${index + 1}: đơn giá không hợp lệ`)
      if (dialog === 'OUT') {
        const selected = outInventoriesFor(line.materialId).filter(item => line.selectedInventoryIds.includes(String(item.id)))
        const factor = line.unit === line.inventory?.warehouse_import_unit ? Number(line.inventory?.bom_unit_per_warehouse_unit || 1) : 1
        const needed = Number(line.quantity || 0) * factor
        const available = selected.reduce((sum, item) => sum + availableQuantity(item), 0)
        if (needed > available + 1e-9) throw new Error(`Dòng ${index + 1}: không đủ tồn khả dụng. Có ${money(available)}, cần ${money(needed)} ${line.inventory?.unit || ''}`)
      }
      if (dialog === 'ADJUSTMENT' && !line.reason.trim()) throw new Error(`Dòng ${index + 1}: nhập lý do điều chỉnh`)
    })
    const movementTotal = rows.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
    if (financialNote.create) {
      if (!(Number(financialNote.amount || movementTotal) > 0)) throw new Error('Số tiền phiếu thu / chi phải lớn hơn 0')
      if (!financialNote.reason.trim()) throw new Error('Nhập nội dung phiếu thu / chi')
    }
    const result = await api('/movements', {
      shiftId: state.active.id,
      type: dialog,
      rows: rows.map(line => ({ requestId: line.requestId, inventoryId: line.inventory.id, inventoryIds: dialog === 'OUT' ? line.selectedInventoryIds : undefined, autoAllocate: dialog === 'OUT', materialId: line.materialId, warehouseId: movementLocation.warehouseId || line.inventory.warehouse_id, batchNo: movementLocation.batchNo || line.inventory.batch_no, createBatch: dialog === 'IN' && line.newBatch, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, reason: line.reason })),
      financialNote: financialNote.create ? {
        noteType: dialog === 'IN' ? 'EXPENSE' : 'RECEIPT',
        paymentMethod: financialNote.paymentMethod,
        amount: financialNote.amount || movementTotal,
        reason: financialNote.reason,
        objectName: financialNote.objectName,
        recipientName: financialNote.objectName,
      } : undefined,
    })
    const noteLabel = result.financialNote?.noteNumber ? ` · Đã tạo ${dialog === 'IN' ? 'phiếu chi' : 'phiếu thu'} ${result.financialNote.noteNumber}` : ''
    setSuccess(`Đã ghi và khóa phiếu ${dialog === 'IN' ? 'nhập' : dialog === 'OUT' ? 'xuất' : 'điều chỉnh'} kho · ${rows.length} dòng${dialog === 'OUT' ? ` · phân bổ ${result.saved || 0} lô` : ''}${noteLabel}.`)
    setMovementLines([movementLine()])
    setFinancialNote({ create: false, paymentMethod: 'CASH', amount: '', reason: '', objectName: '' })
    await reload()
  }) }
  const movementTotal = movementLines.filter(hasMovementInput).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  const expectedCash = Number(sample ? opening : state.active?.opening_cash || 0) + Number(summary?.cashIn || 0) + Number(summary?.receiptNoteCashTotal || 0) - Number(summary?.paymentNoteTotal || 0)
  const expectedBank = Number(sample ? 0 : state.active?.opening_bank || 0) + Number(summary?.bankingIn || 0) + Number(summary?.receiptNoteBankTotal || 0) - Number(summary?.bankPaymentNoteTotal || 0)
  const openingDiff = state.previousCash == null || Number(opening) !== Number(state.previousCash)
  const openingBankDiff = state.previousBank == null || Number(openingBank) !== Number(state.previousBank)
  const movementWarehouses = [...new Map(stock.map(row => [String(row.warehouse_id), { id: String(row.warehouse_id), code: row.warehouse_code, name: row.warehouse_name }])).values()]
  const movementBatches = [...new Set(stock
      .filter(row => !movementLocation.warehouseId || String(row.warehouse_id) === String(movementLocation.warehouseId))
      .map(row => String(row.batch_no || '')).filter(Boolean))]
  const changeMovementWarehouse = warehouseId => {
    const batchNo = dialog === 'IN' ? movementLocation.batchNo : ''
    applyMovementLocation(warehouseId, batchNo)
  }
  return <Paper sx={{p:2, mb:2, border:'1px solid #cbd5e1', borderRadius:2}}>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
      <Box sx={{flex:1}}><Typography variant="h6" fontWeight={800}>Ca làm việc · {state.shiftDate || new Date().toLocaleDateString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}</Typography><Typography variant="body2">{state.active ? `${state.active.shift_name} · ${state.active.shift_date} · ${state.active.opened_by} · Tiền mặt ${money(state.active.opening_cash)}đ · Ngân hàng ${money(state.active.opening_bank)}đ` : 'Mở ca → bán hàng / nhập xuất kho → kiểm đếm và bàn giao'}</Typography></Box>
      <Typography variant="body2">Ca 1: 06:00–14:00 · Ca 2: 14:00–22:00 (giờ Việt Nam)</Typography>
      <Chip color={state.active?'success':'default'} label={state.active?'Đang mở':'Chưa mở ca'} />
      <Button disabled={busy} onClick={() => act(reload)}>Tải lại</Button>
      {!state.active ? <Button disabled={busy || state.usedShifts?.length===2 || state.canOpen===false} variant="contained" onClick={() => start('OPEN')}>Mở ca</Button> : <Button disabled={busy} variant="contained" onClick={() => closeSetup()}>Đóng ca & bàn giao</Button>}
    </Stack>
    <Stack direction="row" gap={1} sx={{mt:2}} flexWrap="wrap">
      <Button variant="contained" href="/bom-inventory/shop-orders">Bán hàng / quầy nhanh</Button>
      <Button disabled={!state.active || busy} variant="outlined" onClick={() => start('IN')}>+ Nhập kho</Button>
      <Button disabled={!state.active || busy} variant="outlined" onClick={() => start('OUT')}>− Xuất kho / tiêu hao cuối ca</Button>
      <Button disabled={!state.active || busy} onClick={() => start('ADJUSTMENT')}>Điều chỉnh có lý do</Button>
      <Button disabled={busy} onClick={() => closeSetup(true)}>Xem ca mẫu hôm nay</Button>
    </Stack>
    {success && <Alert severity="success" sx={{mt:1}}>{success}</Alert>}
    {error && <Alert severity="error" sx={{mt:1}}>{error}</Alert>}
    {!state.active && state.canOpen===false && <Alert severity="warning" sx={{mt:1}}>Ca tiếp theo đã bàn giao cho <b>{state.nextHandoverTo}</b>. Người này cần đăng nhập để mở ca.</Alert>}
    {state.history?.filter(h=>h.status==='CLOSED').slice(0,3).map(h=><Typography key={h.id} variant="body2" sx={{mt:1}}><Button onClick={()=>{setRecord(h);setHistoryCombineMaterials(true);setDialog('HISTORY')}}>Xem biên bản</Button>{h.shift_name} · Đã khóa · {new Date(h.closed_at).toLocaleString('vi-VN')} · {h.closed_by} → {h.handover_to} · Bàn giao {money(h.actual_cash)}đ</Typography>)}
    <Dialog open={!!dialog} onClose={busy?undefined:()=>setDialog('')} fullWidth maxWidth={dialog==='CLOSE'||['IN','OUT','ADJUSTMENT'].includes(dialog)?'xl':'sm'}>
      <DialogTitle>{({HISTORY:'Biên bản đã khóa',OPEN:'Mở ca — kiểm tiền nhận bàn giao',IN:'Nhập kho từng dòng',OUT:'Xuất kho từng dòng',ADJUSTMENT:'Điều chỉnh tồn kho',CLOSE:sample?'Ca mẫu hôm nay — xem trước':'Đóng ca — kiểm đếm & bàn giao'})[dialog]}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
        {dialog==='HISTORY' && record && <Stack gap={2}>
          <Typography>{record.shift_name} · {record.shift_date}</Typography>
          <Typography>{record.opened_by} → {record.handover_to} · {new Date(record.opened_at).toLocaleString('vi-VN')} — {new Date(record.closed_at).toLocaleString('vi-VN')}</Typography>
          <Typography>Đầu ca: tiền mặt {money(record.opening_cash)}đ · ngân hàng {money(record.opening_bank)}đ · Bàn giao: tiền mặt {money(record.actual_cash)}đ · ngân hàng {money(record.actual_bank)}đ</Typography>
          <Typography>Lý do đầu ca: {record.opening_reason || 'Khớp bàn giao'} · Giải trình cuối ca: {record.closing_reason || 'Không chênh lệch tiền'}</Typography>
          <FormControlLabel control={<Checkbox checked={historyCombineMaterials} onChange={e=>setHistoryCombineMaterials(e.target.checked)} />} label="Gộp theo mã vật tư · bỏ cột Kho / lô" />
          <Box sx={{overflow:'auto'}}><Table size="small"><TableHead><TableRow>{(historyCombineMaterials?['Hàng','Hệ thống','Thực đếm','Chênh lệch','Lý do']:['Hàng','Kho / lô','Hệ thống','Thực đếm','Chênh lệch','Lý do']).map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{(historyCombineMaterials?combineHistoryCounts(Array.isArray(record.inventory_counts)?record.inventory_counts:[]):Array.isArray(record.inventory_counts)?record.inventory_counts:[]).map(r=><TableRow key={r.id}><TableCell>{r.material_code} · {r.material_name}</TableCell>{!historyCombineMaterials&&<TableCell>{r.warehouse_code} / {r.batch_no}</TableCell>}<TableCell>{money(r.quantity_on_hand)} {r.unit}</TableCell><TableCell>{money(r.actual)}</TableCell><TableCell>{money(r.difference)}</TableCell><TableCell>{r.reason}</TableCell></TableRow>)}</TableBody></Table></Box>
        </Stack>}
        {dialog==='OPEN' && <Stack gap={2} sx={{pt:1}}>
          <TextField select label={`Ca làm việc · ${state.shiftDate || ''}`} value={shiftNumber} onChange={e=>setShiftNumber(e.target.value)}>{(state.schedule || []).map(slot=><MenuItem key={slot.number} value={String(slot.number)} disabled={state.usedShifts?.includes(slot.number)}>{slot.name}{state.usedShifts?.includes(slot.number)?' · Đã mở trong ngày':''}</MenuItem>)}</TextField>
          <Typography variant="body2">Đóng và bàn giao ca 1 trước khi mở ca 2. Tiền bàn giao ca 2 chuyển sang ca đầu tiên ngày tiếp theo. Giờ thực tế được ghi nhận khi xác nhận mở / đóng ca.</Typography>
          {state.nextHandoverTo && <Alert severity="success">Người nhận được phép mở ca này: <b>{state.nextHandoverTo}</b></Alert>}
          <Alert severity="info">Bàn giao gần nhất: tiền mặt {state.previousCash == null ? 'chưa có' : `${money(state.previousCash)}đ`} · ngân hàng {state.previousBank == null ? 'chưa có' : `${money(state.previousBank)}đ`}</Alert>
          <Stack direction={{xs:'column',sm:'row'}} gap={2}><TextField autoFocus fullWidth label="Tiền mặt thực nhận" type="text" value={formatQuantityInput(opening, 6)} onChange={e=>setOpening(parseQuantityInput(e.target.value,{maximumFractionDigits:6}))} inputProps={{inputMode:'decimal',min:0}} /><TextField fullWidth label="Số dư tài khoản ngân hàng nhận bàn giao" type="text" value={formatQuantityInput(openingBank, 6)} onChange={e=>setOpeningBank(parseQuantityInput(e.target.value,{maximumFractionDigits:6}))} inputProps={{inputMode:'decimal',min:0}} /></Stack>
          {(openingDiff || openingBankDiff) && <><TextField required label="Lý do khác bàn giao / khởi tạo" value={reason} onChange={e=>setReason(e.target.value)} /><FormControlLabel control={<Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>} label="Tôi đã kiểm tra và xác nhận số dư tiền mặt, ngân hàng cùng lý do" /></>}
        </Stack>}
        {['IN','OUT','ADJUSTMENT'].includes(dialog) && <Stack component="form" id="stock-lines" onSubmit={saveMovementLines} gap={1.5} sx={{pt:1}}>
          {['IN','OUT'].includes(dialog) && <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'minmax(260px,1fr) minmax(220px,1fr)'},gap:1.5,p:1.5,border:'1px solid #bfdbfe',borderRadius:1,bgcolor:'#eff6ff'}}>
            <TextField select size="small" SelectProps={{native:true}} label="Kho chung · áp dụng tất cả dòng" value={movementLocation.warehouseId} onChange={e=>changeMovementWarehouse(e.target.value)}>
              <option value="">Tất cả kho / chọn theo vật tư</option>{movementWarehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}
            </TextField>
            {dialog==='IN' ? <TextField size="small" label="Số lô chung · nhập lô mới hoặc chọn gợi ý" value={movementLocation.batchNo} onChange={e=>applyMovementLocation(movementLocation.warehouseId,e.target.value)} inputProps={{list:'counter-in-batches',maxLength:255}} helperText="Có thể nhập số lô chưa tồn tại" /> : <TextField select size="small" SelectProps={{native:true}} label="Số lô chung · áp dụng tất cả dòng" value={movementLocation.batchNo} onChange={e=>applyMovementLocation(movementLocation.warehouseId,e.target.value)}><option value="">Tất cả số lô / chọn theo vật tư</option>{movementBatches.map(batch=><option key={batch} value={batch}>{batch}</option>)}</TextField>}
            {dialog==='IN' && <datalist id="counter-in-batches">{movementBatches.map(batch=><option key={batch} value={batch}/>)}</datalist>}
          </Box>}
          <Alert severity="info">{dialog==='IN'?'Nhập số lô mới để hệ thống tự tạo lô và lấy đơn vị, hệ số quy đổi, giá cấu hình từ vật tư. ':'Kho và số lô phía trên là mặc định chung. '}Đổi giá trị áp dụng cho tất cả dòng. Gõ mã / tên không cần dấu, Tab chọn dòng đầu, Enter thêm dòng.</Alert>
          {success && <Alert severity="success">{success}</Alert>}
          <TableContainer sx={{ maxHeight: '58vh', border: '1px solid #cbd5e1', borderRadius: 1 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1450, '& th': { fontWeight: 800, bgcolor: '#eff6ff', whiteSpace: 'nowrap' }, '& td': { p: 0.5, verticalAlign: 'top' }, '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}>
              <TableHead><TableRow>{['#','Mã / tên vật tư','Kho / số lô','Tồn khả dụng','Số lượng','Đơn vị nhập / xuất','Hệ số → BOM','SL quy đổi BOM','Đơn giá','Thành tiền','Lý do / ghi chú',''].map((label,index)=><TableCell key={index}>{label}</TableCell>)}</TableRow></TableHead>
              <TableBody>{movementLines.map((line,index)=>{
                const options = movementOptions(line)
                const inventory = line.inventory
                const factor = line.unit && line.unit === inventory?.warehouse_import_unit ? Number(inventory?.bom_unit_per_warehouse_unit || 1) : 1
                const converted = Number(line.quantity || 0) * factor
                const total = Number(line.quantity || 0) * Number(line.unitPrice || 0)
                const outBatchOptions = dialog === 'OUT' && line.materialId ? outInventoriesFor(line.materialId) : []
                const selectedOutBatches = outBatchOptions.filter(item => line.selectedInventoryIds?.includes(String(item.id)))
                const selectedAvailable = selectedOutBatches.reduce((sum,item)=>sum+availableQuantity(item),0)
                let allocationRemaining = converted
                const allocationPreview = selectedOutBatches.map(item => {
                  const allocated = Math.min(allocationRemaining, availableQuantity(item)); allocationRemaining -= allocated
                  return allocated > 0 ? `${item.batch_no || 'Không lô'}: ${money(allocated)}` : ''
                }).filter(Boolean).join(' · ')
                return <TableRow key={line.id} onKeyDown={event=>{
                  if(event.key==='Enter' && !event.nativeEvent.isComposing && event.target.tagName==='INPUT' && event.target.getAttribute('aria-expanded')!=='true') { event.preventDefault(); addMovementLine(line.id) }
                }} sx={{ '&:focus-within': { bgcolor: '#f0f9ff' } }}>
                  <TableCell>{index+1}</TableCell>
                  <TableCell sx={{minWidth:300}}><Autocomplete autoHighlight options={options} filterOptions={x=>x} value={inventory} inputValue={line.materialInput}
                                                               onInputChange={(_,value,reason)=>{if(reason==='input') updateMovementLine(line.id,{materialInput:value,materialId:null,inventory:null,selectedInventoryIds:[],newBatch:false,unit:'',unitPrice:''})}}
                                                               onChange={(_,value)=>selectMovementInventory(line,value)} getOptionLabel={row=>`${row.material_code} — ${row.material_name}`}
                                                               isOptionEqualToValue={(a,b)=>a.id===b.id} slotProps={{clearIndicator:{tabIndex:-1},popupIndicator:{tabIndex:-1}}}
                                                               renderOption={(props,row)=><Box component="li" {...props} key={row.id} sx={{gap:1}}><Avatar src={row.thumbnail_url || undefined} variant="rounded">{row.material_name?.[0]}</Avatar><Box><Typography>{row.material_code} · {row.material_name}</Typography><Typography variant="caption">{row.warehouse_code} / {row.batch_no} · Tồn {money(row.quantity_on_hand)} {row.unit}</Typography></Box></Box>}
                                                               renderInput={params=><TextField {...params} size="small" placeholder="Gõ mã / tên, không cần dấu" inputRef={node=>{movementCells.current[`${line.id}:material`]=node}} inputProps={{...params.inputProps,'aria-label':`Vật tư dòng ${index+1}`}}
                                                                                               onKeyDown={event=>{if(event.key==='Tab'&&!event.shiftKey&&!inventory&&options[0]){event.preventDefault();event.defaultMuiPrevented=true;selectMovementInventory(line,options[0]);movementCells.current[`${line.id}:quantity`]?.focus()}}}/>} /></TableCell>
                  <TableCell sx={{minWidth:dialog==='OUT'?310:170}}>{dialog === 'OUT' && line.materialId ? <Autocomplete multiple disableCloseOnSelect options={outBatchOptions} value={selectedOutBatches}
                                                                                                                         onChange={(_,values)=>{const ordered=sortFifo(values);updateMovementLine(line.id,{...(ordered[0]?inventoryPatch(ordered[0]):{}),selectedInventoryIds:ordered.map(item=>String(item.id))})}}
                                                                                                                         getOptionLabel={row=>`${row.warehouse_code} / ${row.batch_no || 'Không lô'} · còn ${money(availableQuantity(row))} ${row.unit || ''}`}
                                                                                                                         isOptionEqualToValue={(a,b)=>a.id===b.id}
                                                                                                                         renderTags={values=><Chip size="small" color="primary" label={`${values.length} lô · còn ${money(values.reduce((sum,item)=>sum+availableQuantity(item),0))} ${inventory?.unit || ''}`} />}
                                                                                                                         renderOption={(props,row,{selected})=><Box component="li" {...props} key={row.id}><Checkbox size="small" checked={selected} sx={{mr:1}} /><Box><Typography variant="body2">{row.warehouse_code} / {row.batch_no || 'Không lô'}</Typography><Typography variant="caption">Khả dụng {money(availableQuantity(row))} {row.unit} · {row.production_date_time ? `SX ${new Date(row.production_date_time).toLocaleDateString('vi-VN')}` : `Tạo ${new Date(row.created_at).toLocaleDateString('vi-VN')}`}</Typography></Box></Box>}
                                                                                                                         renderInput={params=><TextField {...params} size="small" label="Tự chọn FIFO · có thể bỏ lô" />} />
                      : <Typography sx={{pt:1}} color={line.newBatch?'success.main':!inventory&&line.materialId?'error.main':'inherit'}>{inventory ? `${movementWarehouses.find(item=>item.id===String(movementLocation.warehouseId))?.code||inventory.warehouse_code} / ${movementLocation.batchNo||inventory.batch_no}${line.newBatch?' · Lô mới':''}` : line.materialId ? 'Không có vật tư ở Kho/Lô này' : '—'}</Typography>}</TableCell>
                  <TableCell sx={{whiteSpace:'nowrap'}}><Typography sx={{pt:1}}>{inventory ? `${dialog==='OUT'?money(selectedAvailable):line.newBatch?'0':money(inventory.quantity_on_hand)} ${inventory.unit}` : '—'}</Typography></TableCell>
                  <TableCell sx={{minWidth:150}}><TextField size="small" fullWidth type="text" value={formatQuantityInput(line.quantity)} inputRef={node=>{movementCells.current[`${line.id}:quantity`]=node}} onChange={e=>updateMovementLine(line.id,{quantity:parseQuantityInput(e.target.value,{allowNegative:dialog==='ADJUSTMENT'})})} error={dialog==='OUT'&&converted>selectedAvailable} helperText={dialog==='OUT'&&line.quantity!==''?(allocationRemaining>0?`Thiếu ${money(allocationRemaining)} ${inventory?.unit||''}`:`FIFO: ${allocationPreview}`):''} inputProps={{inputMode:'decimal',min:dialog==='ADJUSTMENT'?undefined:0,step:'any','aria-label':`Số lượng dòng ${index+1}`}} /></TableCell>
                  <TableCell sx={{minWidth:160}}><TextField size="small" fullWidth select SelectProps={{native:true}} value={line.unit} onChange={e=>updateMovementLine(line.id,{unit:e.target.value,unitPrice:e.target.value===inventory?.warehouse_import_unit?inventory?.warehouse_import_unit_price??0:inventory?.unit_price??0})}><option value="">Chọn đơn vị</option>{[...new Set([inventory?.unit,inventory?.warehouse_import_unit].filter(Boolean))].map(unit=><option key={unit} value={unit}>{unit}</option>)}</TextField></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{inventory ? factor : '—'}</Typography></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{inventory && line.quantity !== '' ? money(converted) : '—'} {inventory?.unit || ''}</Typography></TableCell>
                  <TableCell sx={{minWidth:125}}><TextField size="small" fullWidth type="text" value={formatQuantityInput(line.unitPrice, 2)} onChange={e=>updateMovementLine(line.id,{unitPrice:parseQuantityInput(e.target.value,{maximumFractionDigits:2})})} inputProps={{inputMode:'decimal',min:0,step:'any','aria-label':`Đơn giá dòng ${index+1}`}} /></TableCell>
                  <TableCell sx={{whiteSpace:'nowrap'}}><Typography sx={{pt:1}}>{line.quantity !== '' ? money(total) : '—'}</Typography></TableCell>
                  <TableCell sx={{minWidth:210}}><TextField size="small" fullWidth required={dialog==='ADJUSTMENT'} value={line.reason} onChange={e=>updateMovementLine(line.id,{reason:e.target.value})} inputProps={{maxLength:100,'aria-label':`Lý do dòng ${index+1}`}} /></TableCell>
                  <TableCell><IconButton tabIndex={-1} size="small" color="error" disabled={movementLines.length<=1} onClick={()=>setMovementLines(prev=>prev.filter(item=>item.id!==line.id))}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              })}</TableBody>
            </Table>
          </TableContainer>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={()=>addMovementLine()} sx={{alignSelf:'flex-start',fontWeight:800}}>Thêm dòng · Enter</Button>
          {['IN','OUT'].includes(dialog) && <Paper variant="outlined" sx={{p:1.5,bgcolor:financialNote.create?'success.50':'grey.50'}}>
            <FormControlLabel control={<Checkbox checked={financialNote.create} onChange={e=>setFinancialNote(prev=>({
              ...prev,
              create:e.target.checked,
              amount:e.target.checked && !prev.amount ? String(movementTotal || '') : prev.amount,
              reason:e.target.checked && !prev.reason ? (dialog==='IN'?'Chi mua / nhập nguyên vật liệu':'Thu tiền xuất bán / hoạt động đặt món') : prev.reason,
            }))}/>} label={<Typography fontWeight={800}>{dialog==='IN'?'Có tạo Phiếu chi cho lần nhập kho này không?':'Xuất bán / dùng cho hoạt động đặt món — tạo Phiếu thu'}</Typography>} />
            {dialog==='OUT' && !financialNote.create && <Typography variant="caption" color="text.secondary" display="block">Chọn khi hàng xuất có thu tiền trực tiếp. Xuất tiêu hao nội bộ thì không tạo phiếu thu.</Typography>}
            {financialNote.create && <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'180px 180px 1fr 1fr'},gap:1,mt:1}}>
              <TextField select size="small" label="Thanh toán" value={financialNote.paymentMethod} onChange={e=>setFinancialNote(prev=>({...prev,paymentMethod:e.target.value}))} helperText={['UNPAID','BANK_LATER'].includes(financialNote.paymentMethod)?'Ghi nhận công nợ, chưa cộng/trừ số dư ca':''}>
                {financialMethodOptions.map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
              <TextField required size="small" type="text" label="Số tiền" value={formatQuantityInput(financialNote.amount, 2)} onChange={e=>setFinancialNote(prev=>({...prev,amount:parseQuantityInput(e.target.value,{maximumFractionDigits:2})}))} inputProps={{inputMode:'decimal',min:0,step:'any'}} helperText={`Tổng dòng: ${money(movementTotal)}đ`} />
              <TextField size="small" label={dialog==='IN'?'Nhà cung cấp / người nhận':'Khách hàng / người nộp'} value={financialNote.objectName} onChange={e=>setFinancialNote(prev=>({...prev,objectName:e.target.value}))} />
              <TextField required size="small" label={dialog==='IN'?'Nội dung chi':'Nội dung thu / đơn hàng'} value={financialNote.reason} onChange={e=>setFinancialNote(prev=>({...prev,reason:e.target.value}))} inputProps={{maxLength:500}} />
            </Box>}
          </Paper>}
        </Stack>}
        {dialog==='CLOSE' && <Stack gap={2}>
          <Typography>{sample?'Lịch hôm nay: Ca 1 · 06:00–14:00 / Ca 2 · 14:00–22:00':`${state.active?.shift_name || ''} · ${state.active?.shift_date || ''}`}</Typography>
          {sample && <Alert severity="info">Dữ liệu minh họa từ tồn kho hiện tại. Tiền mẫu {money(opening)}đ, doanh thu mẫu 0đ. Không ghi vào sổ ca hay thay đổi tồn kho.</Alert>}
          <Alert severity="info">Xuất tiêu hao thực tế (sữa, nguyên liệu dùng lẻ) trước khi kiểm đếm. Ghi nhận chênh lệch không tự thay đổi tồn; điều chỉnh phải lập phiếu có lý do.</Alert>
          <Stack direction={{xs:'column',sm:'row'}} gap={2}><TextField label={`Tiền mặt thực đếm · dự kiến ${money(expectedCash)}đ`} type="text" value={formatQuantityInput(cash, 6)} onChange={e=>setCash(parseQuantityInput(e.target.value,{maximumFractionDigits:6}))} inputProps={{inputMode:'decimal'}} fullWidth/><TextField label={`Số dư ngân hàng thực tế · dự kiến ${money(expectedBank)}đ`} type="text" value={formatQuantityInput(bank, 6)} onChange={e=>setBank(parseQuantityInput(e.target.value,{maximumFractionDigits:6}))} inputProps={{inputMode:'decimal'}} fullWidth/></Stack>
          <Stack direction={{xs:'column',sm:'row'}} gap={2}><Autocomplete fullWidth options={handoverUsers} value={handoverUsers.find(user=>user.username===receiver)||null} getOptionLabel={handoverUserLabel} isOptionEqualToValue={(option,value)=>option?.username===value?.username} onChange={(_,value)=>setReceiver(value?.username||'')} renderOption={(props,user)=><Box component="li" {...props} key={user.username}><Box><Typography>{handoverUserLabel(user)}</Typography><Typography variant="caption" color="text.secondary">{user.username}{user.email?` · ${user.email}`:''}</Typography></Box></Box>} noOptionsText="Chưa có người dùng ROLE_COUNTER" renderInput={params=><TextField {...params} required label="Người nhận bàn giao" placeholder="Gõ để tìm người dùng có quyền bàn giao ca"/>}/><TextField label="Giải trình chênh lệch tiền mặt / QR" value={reason} onChange={e=>setReason(e.target.value)} fullWidth/></Stack>
          <TextField size="small" label={`Tìm hàng để kiểm đếm (${Object.values(counts).filter(r=>r.actual!=='').length}/${stock.length})`} value={search} onChange={e=>setSearch(e.target.value)}/>
          <Box sx={{maxHeight:360,overflow:'auto'}}><Table stickyHeader size="small"><TableHead><TableRow>{['Hàng / kho / lô','Tồn hệ thống','Thực đếm','Lý do chênh lệch'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{stock.filter(r=>`${r.material_code} ${r.material_name}`.toLowerCase().includes(search.toLowerCase())).map(r=><TableRow key={r.id}><TableCell>{r.material_code} · {r.material_name}<Typography variant="caption" display="block">{r.warehouse_code} / {r.batch_no}</Typography></TableCell><TableCell>{money(r.quantity_on_hand)} {r.unit}</TableCell><TableCell><TextField size="small" type="text" inputProps={{inputMode:'decimal',min:0,step:'any','aria-label':`Thực đếm ${r.material_code}`}} value={formatQuantityInput(counts[r.id]?.actual??'')} onChange={e=>setCounts(v=>({...v,[r.id]:{...v[r.id],actual:parseQuantityInput(e.target.value)}}))}/></TableCell><TableCell><TextField size="small" value={counts[r.id]?.reason||''} inputProps={{'aria-label':`Lý do ${r.material_code}`}} onChange={e=>setCounts(v=>({...v,[r.id]:{...v[r.id],reason:e.target.value}}))}/></TableCell></TableRow>)}</TableBody></Table></Box>
          <FormControlLabel control={<Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>} label="Tôi đã kiểm tồn, tiền mặt và QR; xác nhận các chênh lệch cùng người nhận bàn giao." />
        </Stack>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={()=>setDialog('')}>Đóng</Button>
        {dialog==='OPEN' && <Button disabled={busy || !shiftNumber || opening==='' || openingBank==='' || ((openingDiff || openingBankDiff) && (!confirmed || !reason.trim()))} variant="contained" onClick={()=>act(async()=>{setState(await api('/open',{openingCash:opening,openingBank,reason,confirmed,shiftNumber:Number(shiftNumber),shiftDate:state.shiftDate}));setDialog('');setSuccess('Đã mở ca')})}>Xác nhận mở ca</Button>}
        {['IN','OUT','ADJUSTMENT'].includes(dialog) && <Button disabled={busy || !movementLines.some(hasMovementInput)} type="submit" form="stock-lines" variant="contained">Lưu & khóa {movementLines.filter(hasMovementInput).length} dòng</Button>}
        {dialog==='CLOSE' && !sample && <Button disabled={busy || !confirmed || cash==='' || bank==='' || !receiver.trim()} variant="contained" onClick={()=>act(async()=>{setState(await api('/close',{shiftId:state.active.id,actualCash:cash,actualBank:bank,handoverTo:receiver,reason,confirmed,counts:stock.map(r=>({id:r.id,expected:r.quantity_on_hand,actual:counts[r.id]?.actual??'',reason:counts[r.id]?.reason||''}))}));setDialog('');setSuccess('Đã đóng và khóa ca. Tiền bàn giao sẽ chuyển sang đầu ca tiếp theo.')})}>Xác nhận đóng & khóa ca</Button>}
      </DialogActions>
    </Dialog>
  </Paper>
}