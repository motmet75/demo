import React, {useEffect,useMemo,useState} from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material'
import {fetchInventoryView} from '../../api/inventoryApi'
import {createModel,createModelBom} from '../../api/modelApi'
import {
  calculateBulkMenuPrice, inventoryMenuCode, resolveMenuInventoryVndBase
} from '../../utils/bulkMenuPricing'

const text = val => String(val ?? '')
const norm = val => text(val).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim()
const money = val => val == null ? '—' : Number(val).toLocaleString('vi-VN',{
  maximumFractionDigits:2
})
const rowKey = row => text(row.inventoryId || row.id)
const realNumber = value => value !== '' && value != null && Number.isFinite(Number(value))
const percentFor = (edit, global) => edit?.percent === undefined ? global : edit.percent

export default function BulkMenuFromInventoryDialog({open,onClose,onCreated,existingModels=[]}) {
  const [inventory,setInventory]=useState([])
  const [loading,setLoading]=useState(false)
  const [fetchError,setFetchError]=useState('')
  const [search,setSearch]=useState('')
  const [warehouse,setWarehouse]=useState('')
  const [batch,setBatch]=useState('')
  const [selected,setSelected]=useState([])
  const [edits,setEdits]=useState({})
  const [markup,setMarkup]=useState('30')
  const [fxRates,setFxRates]=useState({})
  const [roundTo,setRoundTo]=useState('1000')
  const [roundMode,setRoundMode]=useState('up')
  const [category,setCategory]=useState('Hàng hóa')
  const [appendBatch,setAppendBatch]=useState(true)
  const [linkBom,setLinkBom]=useState(false)
  const [saving,setSaving]=useState(false)
  const [progress,setProgress]=useState('')
  const [notice,setNotice]=useState('')
  const [errors,setErrors]=useState([])
  const [newCodes,setNewCodes]=useState([])

  useEffect(()=>{
    if(!open)return
    let alive=true
    setLoading(true)
    setFetchError('')
    setNotice('')
    setErrors([])
    setSelected([])
    setEdits({})
    setNewCodes([])
    fetchInventoryView().then(rows=>{
      if(alive) setInventory(Array.isArray(rows)?rows:[])
    }).catch(error=>{
      if(alive)setFetchError(error.message||'Không tải được danh sách tồn kho.')
    }).finally(()=>{if(alive)setLoading(false)})
    return ()=>{alive=false}
  },[open])

  const warehouses=useMemo(()=>[...new Set(inventory
    .map(row=>text(row.warehouseCode)).filter(Boolean))].sort(),[inventory])
  const filtered=useMemo(()=>inventory.filter(row=>{
    if(warehouse&&text(row.warehouseCode)!==warehouse)return false
    if(batch&&!norm(row.batchNo).includes(norm(batch)))return false
    return !search||norm([row.materialName,row.materialCode,row.batchNo,
      row.warehouseName].join(' ')).includes(norm(search))
  }),[inventory,search,warehouse,batch])

  const foreignCurrencies=useMemo(()=>[...new Set(inventory.map(row=>
    String(row.currency||'').trim().toUpperCase()).filter(c=>c&&c!=='VND'))].sort(),[inventory])

  const currentCodes=useMemo(()=>new Set([
    ...existingModels.map(model=>text(model.modelCode).toUpperCase()),
    ...newCodes
  ]),[existingModels,newCodes])
  const chosen=new Set(selected)
  const selectedRows=inventory.filter(row=>chosen.has(rowKey(row)))
  const editable=(row)=>{
    const id=rowKey(row)
    const edit=edits[id]||{}
    const name=edit.name===undefined?
      (text(row.materialName||row.materialCode) +
        (appendBatch&&row.batchNo?' · Lô '+text(row.batchNo):'')):edit.name
    const cost=resolveMenuInventoryVndBase(row,fxRates)
    const base=edit.base===undefined?(cost.value??''):edit.base
    const percent=percentFor(edit,markup)
    const automatic=calculateBulkMenuPrice(base,percent,roundTo,roundMode)
    const finalPrice=edit.priceOverride===undefined||edit.priceOverride===''?
      automatic:(realNumber(edit.priceOverride)?Number(edit.priceOverride):null)
    const code=inventoryMenuCode(row.inventoryId||row.id)
    return {name,base,percent,automatic,finalPrice,code,
      priceSource:cost.status,fxRate:cost.fxRate,
      alreadyCreated:currentCodes.has(code)}
  }
  const patch=(id,values)=>setEdits(prev=>({
    ...prev,[id]:{...prev[id],...values}
  }))
  const selectAll=()=>setSelected(prev=>Array.from(new Set([
    ...prev,...filtered.map(row=>rowKey(row))
  ])))
  const toggleRow=(id,checked)=>setSelected(prev=>
    checked?Array.from(new Set([...prev,id])):prev.filter(value=>value!==id))

  const saveAll=async()=>{
    if(saving||!selectedRows.length)return
    const prepared=selectedRows.map(row=>({row, ...editable(row)}))
    const invalid=prepared.filter(row=>
      !row.code || !row.name.trim() ||
      row.finalPrice==null || !Number.isFinite(row.finalPrice) ||
      row.finalPrice<=0 || row.finalPrice>999999999999 ||
      (linkBom&&!row.row.materialId)
    )
    if(invalid.length){
      setErrors(invalid.slice(0,12).map(row=>
        (row.name||row.row.materialCode||row.row.materialName||'Dòng tồn kho')+
        ': chưa có giá bán VND hợp lệ hoặc thiếu tỷ giá, đơn giá và liên kết BOM.'))
      return
    }
    setSaving(true)
    setErrors([])
    setNotice('')
    const created=[]
    const failures=[]
    const codes=new Set(currentCodes)
    try{
      for(let i=0;i<prepared.length;i++){
        const entry=prepared[i]
        setProgress(`Đang tạo menu ${i+1}/${prepared.length}: ${entry.name}`)
        if(codes.has(entry.code)){
          failures.push(`${entry.name}: mã ${entry.code} đã có, bỏ qua để tránh tạo trùng.`)
          continue
        }
        try{
          const model=await createModel({
            modelCode:entry.code,
            modelName:entry.name.trim(),
            sellingPrice:entry.finalPrice,
            category:category.trim()||'Hàng hóa',
            isActive:true
          })
          codes.add(entry.code)
          created.push(model)
          // Material linkage is optional: one finished menu unit consumes one
          // material base unit. Batch is a SOURCE filter, not a stock reservation.
          if(linkBom){
            try{
              await createModelBom({modelId:model.id,materialId:entry.row.materialId,qtyPerUnit:1})
            }catch(e){
              failures.push(`${entry.name}: đã tạo menu nhưng không liên kết được BOM 1:1: ${e.message}`)
            }
          }
        }catch(e){
          failures.push(`${entry.name}: ${e.message||'Không tạo được menu.'}`)
        }
      }
      if(created.length){
        setNewCodes(prev=>[...prev,...created.map(m=>text(m.modelCode).toUpperCase())])
        onCreated?.(created)
      }
      setNotice(`Đã tạo ${created.length}/${prepared.length} menu. ${failures.length} dòng bỏ qua hoặc cần kiểm tra.`)
      setErrors(failures)
    }finally{
      setSaving(false)
      setProgress('')
    }
  }

  return <Dialog open={open} onClose={saving?undefined:onClose}
      maxWidth="xl" fullWidth PaperProps={{sx:{width:'min(98vw,1440px)',maxHeight:'95dvh'}}}>
    <DialogTitle sx={{fontWeight:800}}>Tạo menu hàng loạt từ tồn kho · Kho / Lô / Giá</DialogTitle>
    <DialogContent dividers sx={{p:{xs:1.5,sm:2}}}>
      <Stack spacing={2}>
        <Alert severity="info">
          Tìm vật tư theo tên, kho và số lô rồi chọn nhiều dòng để tạo menu.
          Hệ thống đọc <strong>currency</strong> và <strong>unitPrice</strong> từ từng lô
          trong Inventory. Hàng đã định giá VND dùng trực tiếp; USD/CAD/EUR phải nhập
          tỷ giá VND/ngoại tệ để tự tính giá gốc VND trước khi tăng % và làm tròn.
          Tỷ giá chỉ dùng tạo giá bán menu, KHÔNG đổi giá vốn hoặc đơn vị tiền trong kho.
        </Alert>
        {fetchError&&<Alert severity="error">{fetchError}</Alert>}
        <Stack direction={{xs:'column',sm:'row'}} spacing={1.5}>
          <TextField size="small" fullWidth label="Tìm tên / mã vật tư" value={search}
            onChange={e=>setSearch(e.target.value)}/>
          <TextField select size="small" fullWidth label="Kho hàng" value={warehouse}
            onChange={e=>setWarehouse(e.target.value)}>
            <MenuItem value="">Tất cả kho</MenuItem>
            {warehouses.map(w=><MenuItem key={w} value={w}>{w}</MenuItem>)}
          </TextField>
          <TextField size="small" fullWidth label="Lô / batch" value={batch}
            onChange={e=>setBatch(e.target.value)}/>
        </Stack>
        {foreignCurrencies.length>0&&<Stack spacing={1}>
          <Typography fontWeight={700}>Tỷ giá định giá menu · VND cho 1 đơn vị ngoại tệ</Typography>
          <Stack direction={{xs:'column',sm:'row'}} spacing={1.5} flexWrap="wrap">
            {foreignCurrencies.map(c=><TextField key={c} size="small" type="number"
              label={`1 ${c} = ? VND`}
              placeholder="Nhập tỷ giá để tính giá menu"
              value={fxRates[c]??''}
              disabled={saving}
              onChange={e=>setFxRates(prev=>({...prev,[c]:e.target.value}))}
              inputProps={{min:'0.000001',step:'any'}}
              sx={{minWidth:225}}/>)}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Chưa có tỷ giá thì không tự tính giá bán cho các dòng ngoại tệ.
            Bạn vẫn có thể nhập giá gốc VND riêng cho từng dòng để định giá thủ công.
          </Typography>
        </Stack>}
        <Stack direction={{xs:'column',sm:'row'}} spacing={1.5} alignItems={{sm:'center'}}>
          <TextField size="small" label="Tăng giá so với giá gốc (%)" type="number"
            value={markup} onChange={e=>setMarkup(e.target.value)}
            inputProps={{step:'0.5',min:-100,max:10000}} sx={{minWidth:190}}/>
          <TextField select size="small" label="Làm tròn đến" value={roundTo}
            onChange={e=>setRoundTo(e.target.value)} sx={{minWidth:200}}>
            <MenuItem value="cent">2 số thập phân (0,01)</MenuItem>
            <MenuItem value="1000">1.000 VND (3 chữ số)</MenuItem>
            <MenuItem value="10000">10.000 VND (4 chữ số)</MenuItem>
            <MenuItem value="100000">100.000 VND (5 chữ số)</MenuItem>
          </TextField>
          <TextField select size="small" label="Cách làm tròn" value={roundMode}
            onChange={e=>setRoundMode(e.target.value)} sx={{minWidth:165}}>
            <MenuItem value="up">Lên</MenuItem>
            <MenuItem value="down">Xuống</MenuItem>
            <MenuItem value="nearest">Gần nhất</MenuItem>
          </TextField>
          <TextField size="small" label="Danh mục menu mới" value={category}
            onChange={e=>setCategory(e.target.value)} sx={{minWidth:190}}/>
        </Stack>
        <Stack direction={{xs:'column',sm:'row'}} gap={1} flexWrap="wrap">
          <FormControlLabel control={<Checkbox checked={appendBatch}
            onChange={e=>setAppendBatch(e.target.checked)}/>}
            label="Thêm số lô vào tên menu"/>
          <FormControlLabel control={<Checkbox checked={linkBom}
            onChange={e=>setLinkBom(e.target.checked)}/>}
            label="Tùy chọn: liên kết BOM 1 menu = 1 đơn vị vật tư"/>
        </Stack>
        {linkBom&&<Alert severity="warning">
          Liên kết BOM 1:1 sẽ dùng vật tư theo mã, không khóa riêng batch đã chọn.
          Chỉ bật nếu 1 món/hàng bán thực sự tiêu hao đúng 1 đơn vị vật tư.
          Bạn có thể sửa định mức BOM sau khi tạo menu.
        </Alert>}
        <Stack direction="row" gap={1} alignItems="center">
          <Chip label={`Hiển thị: ${filtered.length}`}/>
          <Chip color={selected.length?'primary':'default'} label={`Đã chọn: ${selected.length}`}/>
          <Button size="small" onClick={selectAll} disabled={!filtered.length||saving}>
            Chọn tất cả đang lọc
          </Button>
          <Button size="small" onClick={()=>setSelected([])} disabled={saving}>Bỏ chọn</Button>
        </Stack>
        <TableContainer sx={{maxHeight:'48dvh',border:'1px solid',borderColor:'divider'}}>
          <Table stickyHeader size="small" sx={{minWidth:1350}}>
            <TableHead><TableRow>
              <TableCell>Chọn</TableCell><TableCell>Tên menu / vật tư</TableCell>
              <TableCell>Kho · Lô · Tồn</TableCell><TableCell>Giá nhập kho</TableCell>
              <TableCell>Giá đơn vị tồn</TableCell><TableCell>Giá gốc VND nhập</TableCell>
              <TableCell>% riêng</TableCell><TableCell>Giá bán tính tự động VND</TableCell>
              <TableCell>Giá bán sửa tay (nếu cần)</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.map(row=>{
                const id=rowKey(row)
                const edit=editable(row)
                return <TableRow key={id} selected={chosen.has(id)}>
                  <TableCell><Checkbox size="small" checked={chosen.has(id)}
                    disabled={saving} onChange={e=>toggleRow(id,e.target.checked)}/></TableCell>
                  <TableCell sx={{minWidth:240}}>
                    <TextField size="small" fullWidth disabled={saving}
                      value={edit.name} onChange={e=>patch(id,{name:e.target.value})}/>
                    <Typography variant="caption" color="text.secondary">
                      {row.materialCode} {edit.alreadyCreated?'· Đã có menu cùng UUID':''}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{minWidth:145}}>
                    {row.warehouseCode||'—'} · {row.batchNo||'—'}
                    <Typography variant="caption" display="block">Tồn: {money(row.quantityOnHand)} {row.unit||''}</Typography>
                  </TableCell>
                  <TableCell>{money(row.warehouseImportUnitPrice)} {row.currency||''}
                    <Typography variant="caption" display="block">{row.warehouseImportUnit||'đv nhập'}</Typography>
                  </TableCell>
                  <TableCell>{money(row.unitPrice)} {row.currency||''}
                    <Typography variant="caption" display="block">{row.unit||'đv tồn'}</Typography>
                  </TableCell>
                  <TableCell sx={{minWidth:155}}><TextField size="small" type="number"
                    value={edit.base} disabled={saving} placeholder="Giá gốc VND"
                    inputProps={{min:0,step:'0.01'}}
                    error={chosen.has(id)&&!realNumber(edit.base)}
                    helperText={edit.priceSource==='CONVERTED'
                      ?`Tự đổi ${row.currency} × ${edit.fxRate} → VND`
                      : edit.priceSource==='VND'?'Giá kho VND theo đơn vị tồn'
                      : row.currency&&row.currency!=='VND'?'Nhập tỷ giá phía trên hoặc giá VND tại dòng'
                      :'Chưa có đơn giá/tiền tệ hợp lệ'}
                    onChange={e=>patch(id,{base:e.target.value})} fullWidth/></TableCell>
                  <TableCell sx={{minWidth:100}}><TextField size="small" type="number" fullWidth
                    disabled={saving} value={edit.percent}
                    onChange={e=>patch(id,{percent:e.target.value})}
                    inputProps={{step:0.5,min:-100,max:10000}}/></TableCell>
                  <TableCell sx={{fontWeight:800,minWidth:130}}>
                    {money(edit.automatic)} VND
                  </TableCell>
                  <TableCell sx={{minWidth:175}}><TextField fullWidth size="small" type="number"
                    disabled={saving} value={edits[id]?.priceOverride??''}
                    placeholder="Để trống: tự tính"
                    inputProps={{min:0,step:'0.01'}}
                    onChange={e=>patch(id,{priceOverride:e.target.value})}
                    helperText={edit.finalPrice==null?'Chưa đủ dữ liệu':`Giá áp dụng: ${money(edit.finalPrice)}đ`}/></TableCell>
                </TableRow>
              })}
              {!filtered.length&&<TableRow><TableCell colSpan={9}>
                {loading?<CircularProgress size={22}/>: 'Không có dòng tồn kho phù hợp bộ lọc.'}
              </TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        {notice&&<Alert severity={errors.length?'warning':'success'}>{notice}</Alert>}
        {errors.length>0&&<Alert severity="warning">
          {errors.slice(0,20).map((msg,i)=><Typography key={i} variant="caption" display="block">{msg}</Typography>)}
          {errors.length>20&&<Typography variant="caption">Còn {errors.length-20} lỗi khác.</Typography>}
        </Alert>}
        {progress&&<Alert severity="info">{progress}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Đóng</Button>
      <Button variant="contained" disabled={saving||!selected.length||loading}
        startIcon={saving?<CircularProgress size={17}/>:null}
        onClick={saveAll}>Tạo {selected.length} menu từ tồn kho</Button>
    </DialogActions>
  </Dialog>
}
