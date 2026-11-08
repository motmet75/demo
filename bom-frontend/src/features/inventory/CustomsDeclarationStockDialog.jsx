import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react'
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
  conversionRatio:'1',vatRate:'0',
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
  const [queuedDocs,setQueuedDocs]=useState([])
  const [postedIds,setPostedIds]=useState([])
  const [notice,setNotice]=useState('')
  const reviewCache=useRef({})

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
    setQueuedDocs([]);setPostedIds([]);setNotice('');reviewCache.current={}
    void load().catch(e=>setError(e.message||'Không tải được dữ liệu kho.'))
  },[open,initialDirection,load])

  const applyDoc=payload=>{
    const saved=reviewCache.current[payload.id]
    setDoc(payload)
    setNumber(saved?.number??payload.declarationNumber??'')
    setDate(saved?.date??(validDate(payload.declarationDate)?payload.declarationDate:
      validDate(payload.dateHint)?payload.dateHint:today()))
    setCurrency(saved?.currency??payload.items?.find(i=>i.currency)?.currency??'VND')
    setRows(saved?.rows||(payload.items||[]).map(item=>newRow(item,warehouses)))
    setConfirmed(payload.status==='POSTED'||postedIds.includes(payload.id))
    setSuccess('')
  }
  const saveReview=()=>{
    if(doc)reviewCache.current[doc.id]={number,date,currency,rows}
  }
  const selectDoc=payload=>{
    if(!payload)return
    if(doc?.id===payload.id)return
    saveReview()
    applyDoc(payload)
    setNotice('')
  }
  const addToQueue=(documents,{activate=false}={})=>{
    if(!documents.length)return
    setQueuedDocs(prev=>{
      const result=[...prev]
      documents.forEach(item=>{
        const i=result.findIndex(v=>v.id===item.id)
        if(i>=0)result[i]=item
        else result.push(item)
      })
      return result
    })
    if(activate||!doc)selectDoc(documents[0])
  }
  const upload=async event=>{
    const files=Array.from(event.target.files||[])
    event.target.value=''
    if(!files.length)return
    if(files.length>30){setError('Tối đa 30 tờ khai mỗi lượt.');return}
    setBusy(true);setError('');setNotice('')
    const succeeded=[],failed=[]
    for(const file of files){
      try{succeeded.push(await customsUpload(file))}
      catch(e){failed.push(file.name+': '+(e.message||'Không đọc được Excel HQ.'))}
    }
    if(succeeded.length)addToQueue(succeeded)
    setNotice('Đã thêm '+succeeded.length+' tờ khai. Đối chiếu và xác nhận từng tờ khai.')
    if(failed.length)setError('Tờ khai lỗi: '+failed.join(' | '))
    setBusy(false)
  }
  const loadDocument=async id=>{
    if(!id)return
    setBusy(true);setError('')
    try{
      const item=queuedDocs.find(x=>String(x.id)===String(id))||await customsDocument(id)
      addToQueue([item],{activate:true})
    }catch(e){setError(e.message||'Không tải được tờ khai.')}
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
  const taxSummary=useMemo(()=>{
    if(!doc)return {subtotal:0,vat:0,total:0,missing:0}
    let subtotal=0,vat=0,missing=0
    doc.items.forEach((item,i)=>{
      if(item.unitPrice==null||!Number.isFinite(Number(item.unitPrice))){
        missing++;return
      }
      const base=Number(item.unitPrice)*Number(item.quantity||0)
      const rate=parseVnNumber(rows[i]?.vatRate||'0')
      if(!Number.isFinite(base)||!Number.isFinite(rate)){missing++;return}
      subtotal+=base
      vat+=Math.round(base*rate/100*10000)/10000
    })
    return {subtotal,vat,total:subtotal+vat,missing}
  },[doc,rows])
  const commonVatRate=rows.length&&rows.every(row=>row.vatRate===rows[0].vatRate)
    ?rows[0].vatRate:''

  const ready=Boolean(doc)&&doc.status!=='POSTED'&&rows.length===doc.items?.length
    &&rows.length>0&&number.trim()&&validDate(date)
    &&rows.every((row,i)=>{
      const original=doc.items[i]
      const ratio=parseNumber(row.conversionRatio)
      const rate=parseNumber(row.vatRate)
      if(!Number.isFinite(rate)||rate<0||rate>100)return false
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
          conversionRatio:parseNumber(row.conversionRatio),
          vatRate:parseNumber(row.vatRate)
        }))
      })
      setSuccess('Đã '+(direction==='IN'?'nhập':'xuất')+' kho '+result.postedLines.length+
        ' dòng theo tờ khai '+number)
      setConfirmed(true)
      setPostedIds(prev=>prev.includes(doc.id)?prev:[...prev,doc.id])
      delete reviewCache.current[doc.id]
      await load()
      const next=queuedDocs.find(x=>x.id!==doc.id&&!postedIds.includes(x.id)&&x.status!=='POSTED')
      if(next){
        setNotice('Đã ghi kho tờ khai '+number+'. Tiếp tục đối chiếu tờ khai kế tiếp.')
        applyDoc(next)
      } else {
        onComplete?.()
      }
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
          {busy?'Đang xử lý...':'Chọn một hoặc nhiều tờ khai Excel'}
          <input hidden type="file" multiple accept=".xls,.xlsx" onChange={e=>void upload(e)}/>
        </Button>
        <TextField select size="small" label="Hoặc chọn tờ khai đã tải" value="" sx={{minWidth:255,flex:1}}
          disabled={busy} onChange={e=>void loadDocument(e.target.value)}>
          <MenuItem value="">Chọn tờ khai</MenuItem>
          {history.map(h=><MenuItem key={h.id} value={h.id}>
            {h.declarationNumber||h.fileName} · {h.status==='POSTED'?'Đã ghi kho':'Chưa ghi'}
          </MenuItem>)}
        </TextField>
        {busy&&<CircularProgress size={20}/>}
        {queuedDocs.length>0&&<Chip label={`Đã chọn ${queuedDocs.length} tờ khai`} color="info" size="small"/>}
      </Stack>
      {notice&&<Alert severity="success">{notice}</Alert>}
      {queuedDocs.length>0&&<Stack direction="row" gap={0.5} flexWrap="wrap">
        {queuedDocs.map((item,i)=><Button key={item.id} size="small"
          variant={item.id===doc?.id?'contained':'outlined'}
          disabled={busy||postedIds.includes(item.id)||item.status==='POSTED'}
          onClick={()=>selectDoc(item)}>
          {i+1}. {item.declarationNumber||item.fileName||'Tờ khai'}
          {postedIds.includes(item.id)||item.status==='POSTED'?' ✓':''}
        </Button>)}
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
              <TableCell>VAT (%)</TableCell>
              <TableCell align="right">Sau VAT</TableCell>
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
                  <TableCell sx={{minWidth:100}}>
                    <TextField size="small" value={line.vatRate} disabled={confirmed}
                      onChange={e=>edit(i,{vatRate:e.target.value})}
                      inputProps={{inputMode:'decimal'}}
                      error={!Number.isFinite(parseNumber(line.vatRate))||parseNumber(line.vatRate)<0||parseNumber(line.vatRate)>100}/>
                  </TableCell>
                  <TableCell align="right" sx={{whiteSpace:'nowrap'}}>
                    {item.unitPrice==null?'—':
                      formatVnNumber(Number(item.quantity)*Number(item.unitPrice)*
                        (1+(parseNumber(line.vatRate)||0)/100),2)} {currency}
                  </TableCell>
                </TableRow>
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" justifyContent="flex-end">
          <TextField size="small" label="VAT chung (%)" value={commonVatRate}
            disabled={confirmed} sx={{width:125}} inputProps={{inputMode:'decimal'}}
            onChange={e=>setRows(prev=>prev.map(row=>({...row,vatRate:e.target.value})))}/>
          <Chip label={`Trị giá khai báo: ${formatVnNumber(taxSummary.subtotal,2)} ${currency}`}/>
          <Chip label={`VAT: ${formatVnNumber(taxSummary.vat,2)} ${currency}`}/>
          <Chip color="success" label={`Tổng sau VAT: ${formatVnNumber(taxSummary.total,2)} ${currency}`}/>
        </Stack>
        {taxSummary.missing>0&&<Alert severity="warning">
          Có {taxSummary.missing} dòng chưa đủ đơn giá/SL từ tờ khai.
          Tổng tiền chỉ tính các dòng có giá, không phải tổng đầy đủ.
        </Alert>}
        <Typography variant="caption" color="text.secondary">
          VAT là tỷ lệ do người dùng đối chiếu, không tự suy ra từ thuế nhập khẩu.
          Giá tính bằng tiền tệ đã chọn; nếu các dòng khác tiền tệ cần quy đổi trước khi dùng tổng.
        </Typography>
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
