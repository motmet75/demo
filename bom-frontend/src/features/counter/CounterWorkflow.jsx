import React, { useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Avatar, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { apiFetchJson } from '../../api/client'

const money = n => Number(n || 0).toLocaleString('vi-VN')
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
const movementLine = defaults => ({ id: crypto.randomUUID(), requestId: crypto.randomUUID(), inventory: null, materialInput: '', quantity: '', unit: '', unitPrice: '', reason: '', ...defaults })
const hasMovementInput = line => Boolean(line.inventory || line.materialInput.trim() || line.quantity !== '' || line.reason.trim())
async function api(path = '', body) {
  const { res, data } = await apiFetchJson(`/shop/staff/counter/workflow${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(data?.message || data?.detail || (typeof data === 'string' ? data : 'Không lưu được. Kiểm tra dữ liệu và thử lại.'))
  return data
}
export default function CounterWorkflow() {
  const [state, setState] = useState({}), [stock, setStock] = useState([])
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false)
  const [record,setRecord] = useState(null)
  const [shiftNumber, setShiftNumber] = useState('')
  const [dialog, setDialog] = useState(''), [sample, setSample] = useState(false)
  const [opening, setOpening] = useState(''), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [cash, setCash] = useState(''), [bank, setBank] = useState(''), [receiver, setReceiver] = useState(''), [counts, setCounts] = useState({})
  const [movementLines, setMovementLines] = useState([movementLine()])
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
      setMovementLines([movementLine()])
      setFinancialNote({ create: false, paymentMethod: 'CASH', amount: '', reason: '', objectName: '' })
    }
    if(kind === 'OPEN') { setOpening(state.previousCash ?? ''); setShiftNumber(String((state.usedShifts || []).includes(state.suggestedShift) ? [1,2].find(n=>!(state.usedShifts || []).includes(n)) || '' : state.suggestedShift || 1)) }
  }
  const rememberMovement = inventory => {
    movementDefaults.current = { warehouseId: inventory?.warehouse_id || '', batchNo: inventory?.batch_no || '' }
    try { sessionStorage.setItem('counter.movement.defaults', JSON.stringify(movementDefaults.current)) } catch { /* in-memory fallback */ }
  }
  const updateMovementLine = (id, patch) => setMovementLines(prev => prev.map(line => line.id === id ? { ...line, ...patch } : line))
  const selectMovementInventory = (line, inventory) => {
    if (!inventory) { updateMovementLine(line.id, { inventory: null, unit: '', unitPrice: '' }); return }
    const unit = inventory.warehouse_import_unit || inventory.unit
    rememberMovement(inventory)
    updateMovementLine(line.id, {
      inventory,
      materialInput: `${inventory.material_code} — ${inventory.material_name}`,
      unit,
      unitPrice: unit === inventory.warehouse_import_unit ? inventory.warehouse_import_unit_price ?? inventory.unit_price ?? 0 : inventory.unit_price ?? 0,
    })
  }
  const movementOptions = line => {
    const query = normalizeSearch(line.materialInput)
    const matches = query ? stock.filter(row => normalizeSearch(`${row.material_code} ${row.material_name} ${row.warehouse_code} ${row.warehouse_name} ${row.batch_no}`).includes(query)) : [...stock]
    const { warehouseId, batchNo } = movementDefaults.current
    return matches.sort((a, b) => Number(b.warehouse_id === warehouseId && b.batch_no === batchNo) - Number(a.warehouse_id === warehouseId && a.batch_no === batchNo)).slice(0, 80)
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
      const { s, rows } = await reload(); setCounts({}); setCash(''); setBank(''); setReceiver(''); setReason(''); setConfirmed(false); setSample(preview)
      if(preview) { setOpening(s.previousCash ?? 500000); setCash(s.previousCash ?? 500000); setBank('0'); setReceiver('Người nhận mẫu'); setCounts(Object.fromEntries(rows.map(r => [r.id, {actual:r.quantity_on_hand, reason:''}]))); setSummary({cashIn:0,bankingIn:0,paymentNoteTotal:0,receiptNoteCashTotal:0,receiptNoteBankTotal:0}); }
      else { const from = new Date(s.active.opened_at).toISOString(); const {res,data} = await apiFetchJson(`/shop/staff/counter/shift-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date().toISOString())}`); if(!res.ok) throw new Error('Không tải được tổng kết'); setSummary(data) }
      setDialog('CLOSE')
    })
  }
  const saveMovementLines = e => { e.preventDefault(); act(async () => {
    const rows = movementLines.filter(hasMovementInput)
    if (!rows.length) throw new Error('Nhập ít nhất một dòng hàng')
    rows.forEach((line, index) => {
      if (!line.inventory) throw new Error(`Dòng ${index + 1}: chọn vật tư / kho / lô trong danh sách`)
      if (!(Number(line.quantity) > 0) && dialog !== 'ADJUSTMENT') throw new Error(`Dòng ${index + 1}: số lượng phải lớn hơn 0`)
      if (!Number.isFinite(Number(line.quantity)) || (dialog === 'ADJUSTMENT' && Number(line.quantity) === 0)) throw new Error(`Dòng ${index + 1}: số lượng không hợp lệ`)
      if (line.unitPrice === '' || Number(line.unitPrice) < 0 || !Number.isFinite(Number(line.unitPrice))) throw new Error(`Dòng ${index + 1}: đơn giá không hợp lệ`)
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
      rows: rows.map(line => ({ requestId: line.requestId, inventoryId: line.inventory.id, quantity: line.quantity, unit: line.unit, unitPrice: line.unitPrice, reason: line.reason })),
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
    setSuccess(`Đã ghi và khóa phiếu ${dialog === 'IN' ? 'nhập' : dialog === 'OUT' ? 'xuất' : 'điều chỉnh'} kho · ${rows.length} dòng${noteLabel}.`)
    setMovementLines([movementLine()])
    setFinancialNote({ create: false, paymentMethod: 'CASH', amount: '', reason: '', objectName: '' })
    await reload()
  }) }
  const movementTotal = movementLines.filter(hasMovementInput).reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0)
  const expectedCash = Number(sample ? opening : state.active?.opening_cash || 0) + Number(summary?.cashIn || 0) + Number(summary?.receiptNoteCashTotal || 0) - Number(summary?.paymentNoteTotal || 0)
  const openingDiff = state.previousCash == null || Number(opening) !== Number(state.previousCash)
  return <Paper sx={{p:2, mb:2, border:'1px solid #cbd5e1', borderRadius:2}}>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
      <Box sx={{flex:1}}><Typography variant="h6" fontWeight={800}>Ca làm việc · {state.shiftDate || new Date().toLocaleDateString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'})}</Typography><Typography variant="body2">{state.active ? `${state.active.shift_name} · ${state.active.shift_date} · ${state.active.opened_by} · Tiền đầu ca ${money(state.active.opening_cash)}đ` : 'Mở ca → bán hàng / nhập xuất kho → kiểm đếm và bàn giao'}</Typography></Box>
      <Typography variant="body2">Ca 1: 06:00–14:00 · Ca 2: 14:00–22:00 (giờ Việt Nam)</Typography>
      <Chip color={state.active?'success':'default'} label={state.active?'Đang mở':'Chưa mở ca'} />
      <Button disabled={busy} onClick={() => act(reload)}>Tải lại</Button>
      {!state.active ? <Button disabled={busy || state.usedShifts?.length===2} variant="contained" onClick={() => start('OPEN')}>Mở ca</Button> : <Button disabled={busy} variant="contained" onClick={() => closeSetup()}>Đóng ca & bàn giao</Button>}
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
    {state.history?.filter(h=>h.status==='CLOSED').slice(0,3).map(h=><Typography key={h.id} variant="body2" sx={{mt:1}}><Button onClick={()=>{setRecord(h);setDialog('HISTORY')}}>Xem biên bản</Button>{h.shift_name} · Đã khóa · {new Date(h.closed_at).toLocaleString('vi-VN')} · {h.closed_by} → {h.handover_to} · Bàn giao {money(h.actual_cash)}đ</Typography>)}
    <Dialog open={!!dialog} onClose={busy?undefined:()=>setDialog('')} fullWidth maxWidth={dialog==='CLOSE'||['IN','OUT','ADJUSTMENT'].includes(dialog)?'xl':'sm'}>
      <DialogTitle>{({HISTORY:'Biên bản đã khóa',OPEN:'Mở ca — kiểm tiền nhận bàn giao',IN:'Nhập kho từng dòng',OUT:'Xuất kho từng dòng',ADJUSTMENT:'Điều chỉnh tồn kho',CLOSE:sample?'Ca mẫu hôm nay — xem trước':'Đóng ca — kiểm đếm & bàn giao'})[dialog]}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
        {dialog==='HISTORY' && record && <Stack gap={2}>
          <Typography>{record.shift_name} · {record.shift_date}</Typography>
          <Typography>{record.opened_by} → {record.handover_to} · {new Date(record.opened_at).toLocaleString('vi-VN')} — {new Date(record.closed_at).toLocaleString('vi-VN')}</Typography>
          <Typography>Tiền đầu ca: {money(record.opening_cash)}đ · Bàn giao: {money(record.actual_cash)}đ · QR thực nhận: {money(record.actual_bank)}đ</Typography>
          <Typography>Lý do đầu ca: {record.opening_reason || 'Khớp bàn giao'} · Giải trình cuối ca: {record.closing_reason || 'Không chênh lệch tiền'}</Typography>
          <Box sx={{overflow:'auto'}}><Table size="small"><TableHead><TableRow>{['Hàng','Kho / lô','Hệ thống','Thực đếm','Chênh lệch','Lý do'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{(Array.isArray(record.inventory_counts)?record.inventory_counts:[]).map(r=><TableRow key={r.id}><TableCell>{r.material_code} · {r.material_name}</TableCell><TableCell>{r.warehouse_code} / {r.batch_no}</TableCell><TableCell>{money(r.quantity_on_hand)} {r.unit}</TableCell><TableCell>{money(r.actual)}</TableCell><TableCell>{money(r.difference)}</TableCell><TableCell>{r.reason}</TableCell></TableRow>)}</TableBody></Table></Box>
        </Stack>}
        {dialog==='OPEN' && <Stack gap={2} sx={{pt:1}}>
          <TextField select label={`Ca làm việc · ${state.shiftDate || ''}`} value={shiftNumber} onChange={e=>setShiftNumber(e.target.value)}>{(state.schedule || []).map(slot=><MenuItem key={slot.number} value={String(slot.number)} disabled={state.usedShifts?.includes(slot.number)}>{slot.name}{state.usedShifts?.includes(slot.number)?' · Đã mở trong ngày':''}</MenuItem>)}</TextField>
          <Typography variant="body2">Đóng và bàn giao ca 1 trước khi mở ca 2. Tiền bàn giao ca 2 chuyển sang ca đầu tiên ngày tiếp theo. Giờ thực tế được ghi nhận khi xác nhận mở / đóng ca.</Typography>
          <Alert severity="info">Bàn giao gần nhất: {state.previousCash == null ? 'Chưa có — cần xác nhận số tiền khởi tạo' : `${money(state.previousCash)}đ`}</Alert>
          <TextField autoFocus label="Tiền mặt thực nhận" type="number" value={opening} onChange={e=>setOpening(e.target.value)} inputProps={{min:0}} />
          {openingDiff && <><TextField required label="Lý do khác bàn giao / khởi tạo" value={reason} onChange={e=>setReason(e.target.value)} /><FormControlLabel control={<Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>} label="Tôi đã đếm lại và xác nhận số tiền cùng lý do" /></>}
        </Stack>}
        {['IN','OUT','ADJUSTMENT'].includes(dialog) && <Stack component="form" id="stock-lines" onSubmit={saveMovementLines} gap={1.5} sx={{pt:1}}>
          <Alert severity="info">Nhập giống “Hóa đơn mới · Nhập kho”: gõ mã / tên không cần dấu, Tab chọn dòng đầu, Enter thêm dòng. Đơn vị và hệ số quy đổi lấy từ cấu hình tồn kho. Kho + số lô của lần chọn đầu được ưu tiên cho các dòng tiếp theo.</Alert>
          {success && <Alert severity="success">{success}</Alert>}
          <TableContainer sx={{ maxHeight: '58vh', border: '1px solid #cbd5e1', borderRadius: 1 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1450, '& th': { fontWeight: 800, bgcolor: '#eff6ff', whiteSpace: 'nowrap' }, '& td': { p: 0.5, verticalAlign: 'top' }, '& .MuiOutlinedInput-root': { borderRadius: 0.5 } }}>
              <TableHead><TableRow>{['#','Mã / tên vật tư','Kho / số lô','Tồn hiện tại','Số lượng','Đơn vị nhập / xuất','Hệ số → BOM','SL quy đổi BOM','Đơn giá','Thành tiền','Lý do / ghi chú',''].map((label,index)=><TableCell key={index}>{label}</TableCell>)}</TableRow></TableHead>
              <TableBody>{movementLines.map((line,index)=>{
                const options = movementOptions(line)
                const inventory = line.inventory
                const factor = line.unit && line.unit === inventory?.warehouse_import_unit ? Number(inventory?.bom_unit_per_warehouse_unit || 1) : 1
                const converted = Number(line.quantity || 0) * factor
                const total = Number(line.quantity || 0) * Number(line.unitPrice || 0)
                return <TableRow key={line.id} onKeyDown={event=>{
                  if(event.key==='Enter' && !event.nativeEvent.isComposing && event.target.tagName==='INPUT' && event.target.getAttribute('aria-expanded')!=='true') { event.preventDefault(); addMovementLine(line.id) }
                }} sx={{ '&:focus-within': { bgcolor: '#f0f9ff' } }}>
                  <TableCell>{index+1}</TableCell>
                  <TableCell sx={{minWidth:300}}><Autocomplete autoHighlight options={options} filterOptions={x=>x} value={inventory} inputValue={line.materialInput}
                    onInputChange={(_,value,reason)=>{if(reason==='input') updateMovementLine(line.id,{materialInput:value,inventory:null,unit:'',unitPrice:''})}}
                    onChange={(_,value)=>selectMovementInventory(line,value)} getOptionLabel={row=>`${row.material_code} — ${row.material_name}`}
                    isOptionEqualToValue={(a,b)=>a.id===b.id} slotProps={{clearIndicator:{tabIndex:-1},popupIndicator:{tabIndex:-1}}}
                    renderOption={(props,row)=><Box component="li" {...props} key={row.id} sx={{gap:1}}><Avatar src={row.thumbnail_url || undefined} variant="rounded">{row.material_name?.[0]}</Avatar><Box><Typography>{row.material_code} · {row.material_name}</Typography><Typography variant="caption">{row.warehouse_code} / {row.batch_no} · Tồn {money(row.quantity_on_hand)} {row.unit}</Typography></Box></Box>}
                    renderInput={params=><TextField {...params} size="small" placeholder="Gõ mã / tên, không cần dấu" inputRef={node=>{movementCells.current[`${line.id}:material`]=node}} inputProps={{...params.inputProps,'aria-label':`Vật tư dòng ${index+1}`}}
                      onKeyDown={event=>{if(event.key==='Tab'&&!event.shiftKey&&!inventory&&options[0]){event.preventDefault();event.defaultMuiPrevented=true;selectMovementInventory(line,options[0]);movementCells.current[`${line.id}:quantity`]?.focus()}}}/>} /></TableCell>
                  <TableCell sx={{minWidth:170}}><Typography sx={{pt:1}}>{inventory ? `${inventory.warehouse_code} / ${inventory.batch_no}` : '—'}</Typography></TableCell>
                  <TableCell sx={{whiteSpace:'nowrap'}}><Typography sx={{pt:1}}>{inventory ? `${money(inventory.quantity_on_hand)} ${inventory.unit}` : '—'}</Typography></TableCell>
                  <TableCell sx={{minWidth:115}}><TextField size="small" fullWidth type="number" value={line.quantity} inputRef={node=>{movementCells.current[`${line.id}:quantity`]=node}} onChange={e=>updateMovementLine(line.id,{quantity:e.target.value})} inputProps={{min:dialog==='ADJUSTMENT'?undefined:0,step:'any','aria-label':`Số lượng dòng ${index+1}`}} /></TableCell>
                  <TableCell sx={{minWidth:160}}><TextField size="small" fullWidth select SelectProps={{native:true}} value={line.unit} onChange={e=>updateMovementLine(line.id,{unit:e.target.value,unitPrice:e.target.value===inventory?.warehouse_import_unit?inventory?.warehouse_import_unit_price??0:inventory?.unit_price??0})}><option value="">Chọn đơn vị</option>{[...new Set([inventory?.unit,inventory?.warehouse_import_unit].filter(Boolean))].map(unit=><option key={unit} value={unit}>{unit}</option>)}</TextField></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{inventory ? factor : '—'}</Typography></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{inventory && line.quantity !== '' ? money(converted) : '—'} {inventory?.unit || ''}</Typography></TableCell>
                  <TableCell sx={{minWidth:125}}><TextField size="small" fullWidth type="number" value={line.unitPrice} onChange={e=>updateMovementLine(line.id,{unitPrice:e.target.value})} inputProps={{min:0,step:'any','aria-label':`Đơn giá dòng ${index+1}`}} /></TableCell>
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
              <TextField select size="small" label="Thanh toán" value={financialNote.paymentMethod} onChange={e=>setFinancialNote(prev=>({...prev,paymentMethod:e.target.value}))}>
                <MenuItem value="CASH">Tiền mặt</MenuItem><MenuItem value="BANK_QR">QR / chuyển khoản</MenuItem>
              </TextField>
              <TextField required size="small" type="number" label="Số tiền" value={financialNote.amount} onChange={e=>setFinancialNote(prev=>({...prev,amount:e.target.value}))} inputProps={{min:0,step:'any'}} helperText={`Tổng dòng: ${money(movementTotal)}đ`} />
              <TextField size="small" label={dialog==='IN'?'Nhà cung cấp / người nhận':'Khách hàng / người nộp'} value={financialNote.objectName} onChange={e=>setFinancialNote(prev=>({...prev,objectName:e.target.value}))} />
              <TextField required size="small" label={dialog==='IN'?'Nội dung chi':'Nội dung thu / đơn hàng'} value={financialNote.reason} onChange={e=>setFinancialNote(prev=>({...prev,reason:e.target.value}))} inputProps={{maxLength:500}} />
            </Box>}
          </Paper>}
        </Stack>}
        {dialog==='CLOSE' && <Stack gap={2}>
          <Typography>{sample?'Lịch hôm nay: Ca 1 · 06:00–14:00 / Ca 2 · 14:00–22:00':`${state.active?.shift_name || ''} · ${state.active?.shift_date || ''}`}</Typography>
          {sample && <Alert severity="info">Dữ liệu minh họa từ tồn kho hiện tại. Tiền mẫu {money(opening)}đ, doanh thu mẫu 0đ. Không ghi vào sổ ca hay thay đổi tồn kho.</Alert>}
          <Alert severity="info">Xuất tiêu hao thực tế (sữa, nguyên liệu dùng lẻ) trước khi kiểm đếm. Ghi nhận chênh lệch không tự thay đổi tồn; điều chỉnh phải lập phiếu có lý do.</Alert>
          <Stack direction={{xs:'column',sm:'row'}} gap={2}><TextField label={`Tiền mặt thực đếm · dự kiến ${money(expectedCash)}đ`} type="number" value={cash} onChange={e=>setCash(e.target.value)} fullWidth/><TextField label={`QR / ngân hàng thực nhận · hệ thống ${money(Number(summary?.bankingIn || 0) + Number(summary?.receiptNoteBankTotal || 0))}đ`} type="number" value={bank} onChange={e=>setBank(e.target.value)} fullWidth/></Stack>
          <Stack direction={{xs:'column',sm:'row'}} gap={2}><TextField label="Người nhận bàn giao" value={receiver} onChange={e=>setReceiver(e.target.value)} fullWidth/><TextField label="Giải trình chênh lệch tiền mặt / QR" value={reason} onChange={e=>setReason(e.target.value)} fullWidth/></Stack>
          <TextField size="small" label={`Tìm hàng để kiểm đếm (${Object.values(counts).filter(r=>r.actual!=='').length}/${stock.length})`} value={search} onChange={e=>setSearch(e.target.value)}/>
          <Box sx={{maxHeight:360,overflow:'auto'}}><Table stickyHeader size="small"><TableHead><TableRow>{['Hàng / kho / lô','Tồn hệ thống','Thực đếm','Lý do chênh lệch'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{stock.filter(r=>`${r.material_code} ${r.material_name}`.toLowerCase().includes(search.toLowerCase())).map(r=><TableRow key={r.id}><TableCell>{r.material_code} · {r.material_name}<Typography variant="caption" display="block">{r.warehouse_code} / {r.batch_no}</Typography></TableCell><TableCell>{money(r.quantity_on_hand)} {r.unit}</TableCell><TableCell><TextField size="small" type="number" inputProps={{min:0,step:'any','aria-label':`Thực đếm ${r.material_code}`}} value={counts[r.id]?.actual??''} onChange={e=>setCounts(v=>({...v,[r.id]:{...v[r.id],actual:e.target.value}}))}/></TableCell><TableCell><TextField size="small" value={counts[r.id]?.reason||''} inputProps={{'aria-label':`Lý do ${r.material_code}`}} onChange={e=>setCounts(v=>({...v,[r.id]:{...v[r.id],reason:e.target.value}}))}/></TableCell></TableRow>)}</TableBody></Table></Box>
          <FormControlLabel control={<Checkbox checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>} label="Tôi đã kiểm tồn, tiền mặt và QR; xác nhận các chênh lệch cùng người nhận bàn giao." />
        </Stack>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={()=>setDialog('')}>Đóng</Button>
        {dialog==='OPEN' && <Button disabled={busy || !shiftNumber || opening==='' || (openingDiff && (!confirmed || !reason.trim()))} variant="contained" onClick={()=>act(async()=>{setState(await api('/open',{openingCash:opening,reason,confirmed,shiftNumber:Number(shiftNumber),shiftDate:state.shiftDate}));setDialog('');setSuccess('Đã mở ca')})}>Xác nhận mở ca</Button>}
        {['IN','OUT','ADJUSTMENT'].includes(dialog) && <Button disabled={busy || !movementLines.some(hasMovementInput)} type="submit" form="stock-lines" variant="contained">Lưu & khóa {movementLines.filter(hasMovementInput).length} dòng</Button>}
        {dialog==='CLOSE' && !sample && <Button disabled={busy || !confirmed || cash==='' || bank==='' || !receiver.trim()} variant="contained" onClick={()=>act(async()=>{setState(await api('/close',{shiftId:state.active.id,actualCash:cash,actualBank:bank,handoverTo:receiver,reason,confirmed,counts:stock.map(r=>({id:r.id,expected:r.quantity_on_hand,actual:counts[r.id]?.actual??'',reason:counts[r.id]?.reason||''}))}));setDialog('');setSuccess('Đã đóng và khóa ca. Tiền bàn giao sẽ chuyển sang đầu ca tiếp theo.')})}>Xác nhận đóng & khóa ca</Button>}
      </DialogActions>
    </Dialog>
  </Paper>
}
