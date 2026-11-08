import React, {useCallback,useEffect,useMemo,useState} from 'react'
import {
  Alert,Autocomplete,Box,Button,Chip,CircularProgress,Dialog,DialogActions,
  DialogContent,DialogTitle,FormControlLabel,MenuItem,Stack,Switch,
  Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TextField,Typography
} from '@mui/material'
import {customsUpload,customsConfirm,customsDocument,customsHistory} from '../../api/customsDeclarationStockApi'
import {fetchMaterials} from '../../api/materialApi'
import {fetchWarehouses} from '../../api/warehouseApi'
import {fetchInventoryView} from '../../api/inventoryApi'
import {formatVnNumber,parseVnNumber} from '../../utils/vietnameseNumbers'

const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[đĐ]/g,'d').toLowerCase().trim()
const parseNumber=v=>parseVnNumber(v)
const optionMaterial=m=>[m.materialCode,m.materialName].filter(Boolean).join(' · ')
const optionStock=x=>[x.materialCode,x.materialName,x.warehouseName,x.batchNo,
  'Khả dụng '+formatVnNumber(
    Number(x.quantityOnHand||0)-Number(x.quantityReserved||0)-Number(x.quantityLocked||0),6)
].filter(Boolean).join(' · ')
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)
const safeNum=v=>Number.isFinite(Number(v))?Number(v):0
const today=()=>{const d=new Date();return [
  d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')
].join('-')}
const newRow=(item,warehouses)=>({
  lineIndex:item.lineIndex,materialId:'',inventoryId:'',
  warehouseId:warehouses.length===1?String(warehouses[0].id):'',
  batchNo:'',newMaterial:false,
  newMaterialCode:'',newMaterialName:item.description||'',
  newMaterialUnit:item.unit||'cái',
  conversionRatio:'1',
})

export default function CustomsDeclarationStockDialog({open,onClose,onComplete,initialDirection='IN'}){
  const [direction,setDirection]=useState(initialDirection)
  const [doc,setDoc]=useState(null)
  const [materials,setMaterials]=useState([])
  const [warehouses,setWarehouses]=useState([])
  const [stock,setStock]=useState([])
  const [history,setHistory]=useState([])
  const [rows,setRows]=useState([])
  const [number,setNumber]=useState('')
  const [date,setDate]=useState('')
  const [currency,setCurrency]=useState('VND')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [confirmed,setConfirmed]=useState(false)

  const load=useCallback(async()=>{
    const [ma,wh,inv,h]=await Promise.all([
      fetchMaterials(),fetchWarehouses(),fetchInventoryView(),customsHistory()
    ])
    setMaterials(Array.isArray(ma)?ma:[])
    setWarehouses(Array.isArray(wh)?wh:[])
    setStock(Array.isArray(inv)?inv:[])
    setHistory(Array.isArray(h)?h:[])
  },[])

  useEffect(()=>{
    if(!open)return
    setDirection(initialDirection)
    setDoc(null);setRows([]);setNumber('');setDate('');setCurrency('VND')
    setError('');setSuccess('');setConfirmed(false)
    void load().catch(e=>setError(e.message||'Không tải được dữ liệu kho.'))
  },[open,initialDirection,load])

  const applyDoc=payload=>{
    setDoc(payload)
    setNumber(payload.declarationNumber||'')
    setDate(validDate(payload.declarationDate)?payload.declarationDate:
      validDate(payload.dateHint)?payload.dateHint:today())
    setCurrency(payload.items?.find(i=>i.currency)?.currency||'VND')
    setRows((payload.items||[]).map(item=>newRow(item,warehouses)))
    setConfirmed(payload.status==='POSTED')
    setSuccess('')
  }
  const upload=async event=>{
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    setBusy(true);setError('')
    try{applyDoc(await customsUpload(file))}
    catch(e){setError(e.message||'Không đọc được Excel HQ.')}
    finally{setBusy(false)}
  }
  const loadDocument=async id=>{
    setBusy(true);setError('')
    try{applyDoc(await customsDocument(id))}
    catch(e){setError(e.message||'Không tải được tờ khai.')}
    finally{setBusy(false)}
  }
  const edit=(index,patch)=>setRows(prev=>prev.map(row=>
    row.lineIndex===index?{...row,...patch}:row))
  const mapStock=useMemo(()=>new Map(stock.map(item=>[
    String(item.inventoryId||item.id),item
  ])),[stock])
  const available=useMemo(()=>stock.filter(item=>
    !item.locked && Number(item.quantityOnHand||0)-
      Number(item.quantityReserved||0)-Number(item.quantityLocked||0)>0
  ),[stock])

  const ready=Boolean(doc)&&doc.status!=='POSTED'&&rows.length===doc.items?.length
    &&rows.length>0&&number.trim()&&validDate(date)
    &&rows.every((row,i)=>{
      const original=doc.items[i]
      const ratio=parseNumber(row.conversionRatio)
      if(!Number.isFinite(ratio)||ratio<=0||!Number.isFinite(safeNum(original.quantity)*ratio))return false
      if(direction==='IN')return Boolean(row.warehouseId&&row.batchNo.trim()&&
        (row.newMaterial?(row.newMaterialCode.trim()&&row.newMaterialName.trim()&&row.newMaterialUnit.trim()):row.materialId))
      return Boolean(row.inventoryId&&row.warehouseId)
    })

  const confirm=async()=>{
    setError('');setSuccess('')
    if(!ready)return
    const type=direction==='IN'?'NHẬP':'XUẤT'
    if(!window.confirm('Xác nhận '+type+' kho theo tờ khai HQ '+number+
      '? Giao dịch sẽ cập nhật tồn kho thật và không thể xác nhận lần hai.'))return
    setBusy(true)
    try{
      const result=await customsConfirm({
        documentId:doc.id,direction,declarationNumber:number,declarationDate:date,
        currency,lines:rows.map(row=>({
          lineIndex:row.lineIndex,materialId:direction==='OUT'?mapStock.get(String(row.inventoryId))?.materialId:
            row.newMaterial?null:row.materialId||null,
          newMaterialCode:direction==='IN'&&row.newMaterial?row.newMaterialCode:null,
          newMaterialName:direction==='IN'&&row.newMaterial?row.newMaterialName:null,
          newMaterialUnit:direction==='IN'&&row.newMaterial?row.newMaterialUnit:null,
          warehouseId:row.warehouseId,
          inventoryId:direction==='OUT'?row.inventoryId:null,
          batchNo:direction==='IN'?row.batchNo:mapStock.get(String(row.inventoryId))?.batchNo||'',
          conversionRatio:parseNumber(row.conversionRatio)
        }))
      })
      setSuccess('Đã '+(direction==='IN'?'nhập':'xuất')+' kho '+result.postedLines.length+
        ' dòng theo tờ khai '+number)
      setConfirmed(true)
      await load()
      onComplete?.()
    }catch(e){setError(e.message||'Lỗi ghi kho; giao dịch không được xác nhận.')}
    finally{setBusy(false)}
  }

  return <Dialog open={open} onClose={busy?undefined:onClose} maxWidth="xl" fullWidth
    PaperProps={{sx:{height:'92vh',maxHeight:'95vh'}}}>
    <DialogTitle sx={{fontWeight:800}}>Nhập / Xuất kho bằng tờ khai Hải quan</DialogTitle>
    <DialogContent dividers sx={{display:'flex',flexDirection:'column',gap:1.5}}>
      {error&&<Alert severity="error">{error}</Alert>}
      {success&&<Alert severity="success">{success}</Alert>}
      <Stack direction={{xs:'column',sm:'row'}} gap={1} flexWrap="wrap">
        <TextField select size="small" label="Loại giao dịch" value={direction}
          disabled={busy||confirmed} onChange={e=>{
            setDirection(e.target.value)
            setRows(old=>old.map(row=>({...row,materialId:'',inventoryId:'',newMaterial:false})))
          }} sx={{minWidth:195}}>
          <MenuItem value="IN">Nhập kho · Tờ khai nhập</MenuItem>
          <MenuItem value="OUT">Xuất kho · Tờ khai xuất</MenuItem>
        </TextField>
        <Button variant="contained" size="small" component="label" disabled={busy}>
          {busy?'Đang xử lý...':'Tải Excel tờ khai HQ (.xls/.xlsx)'}
          <input hidden type="file" accept=".xls,.xlsx" onChange={e=>void upload(e)}/>
        </Button>
        <TextField select size="small" label="Hoặc chọn tờ khai đã tải" value="" sx={{minWidth:255,flex:1}}
          disabled={busy} onChange={e=>void loadDocument(e.target.value)}>
          <MenuItem value="">Chọn tờ khai</MenuItem>
          {history.map(h=><MenuItem key={h.id} value={h.id}>
            {h.declarationNumber||h.fileName} · {h.status==='POSTED'?'Đã ghi kho':'Chưa ghi'}
          </MenuItem>)}
        </TextField>
        {busy&&<CircularProgress size={20}/>}
      </Stack>
      <Alert severity="info">Đọc Excel theo cách xuất dữ liệu của Portal (dòng <code>&lt;IMP&gt;</code>).
        Bản Excel phải có mã HS/mô tả/số lượng. **Không tự động nhập/xuất** khi tải tờ khai.
        Kiểm tra số tờ khai, ngày, hệ số quy đổi và mã vật tư trước khi xác nhận. Giá khai báo hải quan chỉ lưu để đối chiếu, không thay đổi giá vốn/giá mua đang lưu trong kho.
      </Alert>
      {doc&&<>
        {confirmed&&<Alert severity="warning">Tờ khai này đã ghi kho, chỉ có thể xem để đối chiếu.</Alert>}
        <Stack direction={{xs:'column',sm:'row'}} gap={1}>
          <TextField size="small" label="Số tờ khai HQ" value={number}
            disabled={confirmed} onChange={e=>setNumber(e.target.value)} sx={{flex:2}}/>
          <TextField size="small" type="date" label="Ngày tờ khai"
            InputLabelProps={{shrink:true}} value={date}
            disabled={confirmed} onChange={e=>setDate(e.target.value)} sx={{flex:1}}/>
          <TextField size="small" label="Tiền tệ" value={currency}
            disabled={confirmed} onChange={e=>setCurrency(e.target.value)} sx={{width:115}}/>
        </Stack>
        <Typography variant="body2" fontWeight={700}>Nguồn: {doc.fileName} · {doc.items?.length||0} dòng khai báo</Typography>
        <TableContainer sx={{flex:1,minHeight:150,border:'1px solid',borderColor:'divider',borderRadius:1}}>
          <Table size="small" stickyHeader sx={{minWidth:1370}}>
            <TableHead><TableRow>
              <TableCell>STT / HS / Tên theo tờ khai</TableCell>
              <TableCell sx={{minWidth:300}}>Mã và tên nguyên vật liệu gốc</TableCell>
              <TableCell>Kho / Lô hàng</TableCell>
              <TableCell align="right">SL khai báo</TableCell>
              <TableCell>Hệ số sang ĐV kho</TableCell>
              <TableCell align="right">SL kho</TableCell>
              <TableCell align="right">Giá khai báo</TableCell>
            </TableRow></TableHead><TableBody>
              {(doc.items||[]).map((item,i)=>{
                const line=rows[i]
                if(!line)return null
                const warehouse=warehouses.find(w=>String(w.id)===line.warehouseId)||null
                const chosen=mapStock.get(String(line.inventoryId))
                const chosenMaterial=materials.find(m=>String(m.id)===line.materialId)||null
                const ratio=parseNumber(line.conversionRatio)
                const qty=safeNum(item.quantity)*ratio
                return <TableRow key={item.lineIndex}>
                  <TableCell sx={{minWidth:265}}>
                    <Typography variant="body2" fontWeight={800}>{i+1}. {item.description}</Typography>
                    <Typography variant="caption" display="block">HS {item.hsCode||'—'} · {item.originCountry||'Không rõ xuất xứ'}</Typography>
                  </TableCell>
                  <TableCell>
                    {direction==='IN'?<Stack spacing={0.7}>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        <Button size="small" variant={!line.newMaterial?'contained':'outlined'} onClick={()=>
                          edit(i,{newMaterial:false})} disabled={confirmed}>Chọn mã có sẵn</Button>
                        <Button size="small" variant={line.newMaterial?'contained':'outlined'} onClick={()=>
                          edit(i,{newMaterial:true,materialId:''})} disabled={confirmed}>Tạo mới tại đây</Button>
                      </Stack>
                      {line.newMaterial?<Stack spacing={0.5}>
                        <TextField size="small" label="Mã vật tư mới" value={line.newMaterialCode}
                          disabled={confirmed} onChange={e=>edit(i,{newMaterialCode:e.target.value})}/>
                        <TextField size="small" label="Tên nguyên vật liệu gốc" value={line.newMaterialName}
                          disabled={confirmed} onChange={e=>edit(i,{newMaterialName:e.target.value})}/>
                        <TextField size="small" label="Đơn vị kho" value={line.newMaterialUnit}
                          disabled={confirmed} onChange={e=>edit(i,{newMaterialUnit:e.target.value})}/>
                      </Stack>:
                        <Autocomplete size="small" options={materials} value={chosenMaterial}
                          disabled={confirmed} getOptionLabel={optionMaterial}
                          isOptionEqualToValue={(a,b)=>String(a.id)===String(b.id)}
                          onChange={(_,m)=>edit(i,{materialId:m?.id||''})}
                          renderInput={params=><TextField {...params} size="small" label="Vật tư gốc (mã/tên)"/>}/>}
                    </Stack>:<Autocomplete size="small" options={available} value={chosen||null}
                      disabled={confirmed}
                      getOptionLabel={optionStock}
                      isOptionEqualToValue={(a,b)=>String(a.inventoryId||a.id)===String(b.inventoryId||b.id)}
                      onChange={(_,picked)=>edit(i,{
                        inventoryId:picked?.inventoryId||picked?.id||'',
                        warehouseId:picked?.warehouseId||'',materialId:picked?.materialId||''
                      })}
                      renderInput={params=><TextField {...params} size="small" label="Chọn lô tồn kho cần xuất"/>}/>}
                  </TableCell>
                  <TableCell sx={{minWidth:190}}>
                    {direction==='IN'?<Stack spacing={0.5}>
                      <TextField select size="small" label="Kho nhận" value={line.warehouseId}
                        disabled={confirmed} onChange={e=>edit(i,{warehouseId:e.target.value})}>
                        <MenuItem value="">Chọn kho</MenuItem>
                        {warehouses.map(w=><MenuItem key={w.id} value={String(w.id)}>
                          {w.name||w.warehouseName||w.code||w.warehouseCode}
                        </MenuItem>)}
                      </TextField>
                      <TextField size="small" label="Số lô" value={line.batchNo}
                        disabled={confirmed} onChange={e=>edit(i,{batchNo:e.target.value})}/>
                    </Stack>:<Typography variant="body2">
                      {chosen?.warehouseName||'—'} · {chosen?.batchNo||'—'}
                    </Typography>}
                  </TableCell>
                  <TableCell align="right">{formatVnNumber(item.quantity,6)} {item.unit}</TableCell>
                  <TableCell>
                    <TextField size="small" value={line.conversionRatio} disabled={confirmed}
                      onChange={e=>edit(i,{conversionRatio:e.target.value})}
                      inputProps={{inputMode:'decimal'}} helperText="1 đơn vị khai báo = ? đơn vị kho"/>
                  </TableCell>
                  <TableCell align="right">{Number.isFinite(qty)?formatVnNumber(qty,6):'—'}</TableCell>
                  <TableCell align="right">{item.unitPrice==null?'—':formatVnNumber(item.unitPrice,4)} {item.currency||currency}</TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>Đóng</Button>
      <Button color="primary" variant="contained" disabled={!ready||busy||confirmed}
        onClick={()=>void confirm()}>{busy?'Đang ghi kho...':
          direction==='IN'?'Xác nhận nhập kho theo tờ khai':'Xác nhận xuất kho theo tờ khai'}</Button>
    </DialogActions>
  </Dialog>
}
