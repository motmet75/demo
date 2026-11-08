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
import {generateMaterialCode} from '../../utils/materialCode'
import CustomsTariffComparison from './CustomsTariffComparison'
import {matchMaterialByDescription,normalizeMaterialDescription} from '../../utils/materialBulkMatching'

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
  batchNo:'',newMaterial:false,newMaterialAutoCode:true,
  newMaterialCode:'',newMaterialName:item.description||'',
  newMaterialUnit:item.unit||'cái',
  // Customs import VAT is based on VND customs taxable value + import duty.
  // Do not silently apply its percentage to foreign-currency purchase cost.
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
  const [showValidation,setShowValidation]=useState(false)
  // Separate draft: typing a VAT rate never modifies declaration line VAT.
  const [bulkVatInput,setBulkVatInput]=useState('')
  const [bulkBatchNo,setBulkBatchNo]=useState('')
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
    setError('');setSuccess('');setConfirmed(false);setShowValidation(false);setBulkVatInput('')
    setQueuedDocs([]);setPostedIds([]);setNotice('');reviewCache.current={}
    void load().catch(e=>setError(e.message||'Không tải được dữ liệu kho.'))
  },[open,initialDirection,load])

  const applyDoc=payload=>{
    setShowValidation(false)
    setBulkVatInput('')
    setBulkBatchNo(reviewCache.current[payload.id]?.bulkBatchNo??payload.declarationNumber??'')
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
    if(doc)reviewCache.current[doc.id]={number,date,currency,rows,bulkBatchNo}
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
  const suggestCode=(index)=>generateMaterialCode([
    ...materials.map(item=>item.materialCode),
    ...rows.filter(row=>row.lineIndex!==index).map(row=>row.newMaterialCode)
  ])
  const createNewAtLine=(index,item)=>{
    const current=rows.find(row=>row.lineIndex===index)
    edit(index,{
      newMaterial:true,materialId:'',
      newMaterialAutoCode:current?.newMaterialAutoCode!==false,
      newMaterialCode:current?.newMaterialCode?.trim()||
        (current?.newMaterialAutoCode!==false?suggestCode(index):''),
      // Default to the exact customs item description; keep it editable.
      newMaterialName:current?.newMaterialName?.trim()||item.description||''
    })
  }
  const mapStock=useMemo(()=>new Map(stock.map(item=>[
    String(item.inventoryId||item.id),item
  ])),[stock])
  const available=useMemo(()=>stock.filter(item=>
    !item.locked && Number(item.quantityOnHand||0)-
      Number(item.quantityReserved||0)-Number(item.quantityLocked||0)>0
  ),[stock])

  const bulkAllowed=Boolean(doc)&&!busy&&!confirmed&&doc.status!=='POSTED'

  const bulkCreateMaterials=()=>{
    if(!bulkAllowed||direction!=='IN')return
    if(!window.confirm('Chuẩn bị TẠO MỚI vật tư cho tất cả các dòng tờ khai?\nCác mã đã chọn sẽ bị thay bằng mã mới. Chưa ghi kho cho đến khi xác nhận.'))return
    const usedCodes=materials.map(m=>m.materialCode)
    const byDefinition=new Map()
    let created=0
    const prepared=rows.map((row,i)=>{
      const source=doc.items[i]||{}
      const name=String(source.description||row.newMaterialName||'').trim()
      const unit=String(source.unit||row.newMaterialUnit||'cái').trim()
      if(!name||!unit)return row
      // Two exactly identical customs lines should create one catalog material.
      const key=JSON.stringify([name,unit])
      let code=byDefinition.get(key)
      if(!code){
        code=generateMaterialCode(usedCodes)
        usedCodes.push(code)
        byDefinition.set(key,code)
        created++
      }
      return {...row,newMaterial:true,materialId:'',inventoryId:'',
        newMaterialAutoCode:true,newMaterialCode:code,
        newMaterialName:name,newMaterialUnit:unit}
    })
    setRows(prepared)
    setShowValidation(false)
    setNotice('Đã chuẩn bị '+created+' mã vật tư mới cho '+prepared.filter(r=>r.newMaterial).length+
      ' dòng. Vật tư chỉ được tạo trong Materials khi xác nhận nhập kho thành công.')
    setError('')
  }

  const bulkMatchMaterials=()=>{
    if(!bulkAllowed)return
    let matched=0,ambiguous=0,missing=0,skipped=0,insufficient=0,needsConversion=0
    const allocated=new Map()
    if(direction==='OUT'){
      rows.forEach((r,i)=>{
        if(!r.inventoryId)return
        const qty=safeNum(doc.items[i]?.quantity)*parseNumber(r.conversionRatio)
        if(Number.isFinite(qty)&&qty>0)
          allocated.set(String(r.inventoryId),(allocated.get(String(r.inventoryId))||0)+qty)
      })
    }
    const prepared=rows.map((row,i)=>{
      if(row.materialId||row.newMaterial||row.inventoryId){skipped++;return row}
      const source=doc.items[i]||{}
      const result=matchMaterialByDescription(source.description,
        direction==='IN'?materials:available,source.unit)
      if(result.status!=='matched'){
        if(result.status==='ambiguous')ambiguous++
        else missing++
        return row
      }
      const sourceUnit=normalizeMaterialDescription(source.unit)
      const materialUnit=normalizeMaterialDescription(result.material.unit)
      const conversionNeeded=!sourceUnit||!materialUnit||sourceUnit!==materialUnit
      if(direction==='IN'){
        matched++
        if(conversionNeeded)needsConversion++
        return {...row,newMaterial:false,materialId:String(result.material.id),
          conversionRatio:conversionNeeded?'':row.conversionRatio}
      }
      // OUT requires a unique eligible warehouse/batch AND known units;
      // never estimate a ratio before stock availability is verified.
      if(conversionNeeded){needsConversion++;return row}
      const lot=result.material
      const id=String(lot.inventoryId||lot.id)
      const free=Number(lot.quantityOnHand||0)-Number(lot.quantityReserved||0)-
        Number(lot.quantityLocked||0)
      const qty=safeNum(source.quantity)*parseNumber(row.conversionRatio)
      if(!Number.isFinite(qty)||qty<=0||qty+(allocated.get(id)||0)>free){
        insufficient++;return row
      }
      allocated.set(id,(allocated.get(id)||0)+qty)
      matched++
      return {...row,materialId:String(lot.materialId||''),inventoryId:id,
        warehouseId:String(lot.warehouseId||'')}
    })
    setRows(prepared)
    setShowValidation(false)
    setNotice('Đã tự chọn '+matched+' dòng theo TÊN TRÙNG CHÍNH XÁC (không dấu/không phân biệt hoa thường). '+
      'Bỏ qua: '+ambiguous+' tên trùng nhiều mã/lô, '+missing+' không tìm thấy, '+
      insufficient+' không đủ tồn, '+skipped+' đã chọn trước, '+
      needsConversion+' cần kiểm tra hệ số quy đổi. Hãy kiểm tra từng dòng.')
    setError('')
  }

  const bulkClearMaterials=()=>{
    if(!bulkAllowed)return
    if(!window.confirm('Bỏ tất cả mã vật tư/lô đã chọn của tờ khai hiện tại? Số lượng, VAT và số lô nhập giữ nguyên.'))return
    setRows(prev=>prev.map((row,i)=>({
      ...row,materialId:'',inventoryId:'',newMaterial:false,newMaterialAutoCode:true,
      newMaterialCode:'',newMaterialName:doc.items[i]?.description||'',
      newMaterialUnit:doc.items[i]?.unit||'cái',
      warehouseId:direction==='OUT'?'':row.warehouseId
    })))
    setShowValidation(false)
    setNotice('Đã bỏ chọn mã vật tư trên tất cả dòng. Không xóa vật tư trong hệ thống.')
    setError('')
  }

  const applyBatchToAll=()=>{
    if(!bulkAllowed||direction!=='IN')return
    const batch=String(bulkBatchNo||number||'').trim()
    if(!batch||batch.length>50){
      setError('Nhập số lô chung từ 1 đến 50 ký tự (có thể dùng số tờ khai).')
      return
    }
    setRows(prev=>prev.map(row=>({...row,batchNo:batch})))
    setBulkBatchNo(batch)
    setNotice('Đã áp dụng số lô '+batch+' cho tất cả '+rows.length+' dòng tờ khai.')
    setError('')
  }
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
  const bulkVatValue=parseVnNumber(bulkVatInput)
  const canApplyBulkVat=rows.length>0 && Number.isFinite(bulkVatValue)
    && bulkVatValue>=0 && bulkVatValue<=100
    && (bulkVatInput.split(',')[1]?.length||0)<=3
  const applyVatToAll=()=>{
    if(busy||confirmed||doc?.status==='POSTED'||!rows.length)return
    if(!canApplyBulkVat){
      setError('Nhập VAT chung từ 0 đến 100%, tối đa 3 chữ số thập phân (ví dụ: 8 hoặc 8,5).')
      return
    }
    const rate=formatVnNumber(bulkVatValue,3)
    if(!window.confirm(
      `Áp dụng VAT ${rate}% cho tất cả ${rows.length} dòng của tờ khai hiện tại?\n\n` +
      'Thao tác này sẽ ghi đè VAT riêng từng dòng. Bạn có chắc chắn?'
    ))return
    setRows(prev=>prev.map(row=>({...row,vatRate:rate})))
    setBulkVatInput('')
    setError('')
  }


  // Actionable explanations for every field that prevents posting.
  // Keep the confirmation button clickable so the user can see these messages.
  const validationErrors=useMemo(()=>{
    if(!doc||confirmed||doc.status==='POSTED')return []
    const issues=[]
    if(!doc.items?.length)return ['Tờ khai không có dòng hàng để nhập/xuất kho.']
    if(rows.length!==doc.items.length)
      issues.push('Số dòng đối chiếu chưa khớp tờ khai. Hãy tải lại tờ khai.')
    if(!number.trim())issues.push('Chưa nhập số tờ khai hải quan.')
    else if(number.trim().length>80)issues.push('Số tờ khai vượt quá 80 ký tự.')
    const parsedDate=new Date(date+'T00:00:00')
    const normalizedDate=Number.isNaN(parsedDate.getTime())?'':[
      parsedDate.getFullYear(),String(parsedDate.getMonth()+1).padStart(2,'0'),
      String(parsedDate.getDate()).padStart(2,'0')
    ].join('-')
    if(!validDate(date)||date!==normalizedDate||date>today())
      issues.push('Ngày tờ khai không hợp lệ hoặc nằm trong tương lai.')
    if(!['VND','USD','EUR','JPY','CNY'].includes(currency.trim().toUpperCase()))
      issues.push('Tiền tệ phải là VND, USD, EUR, JPY hoặc CNY.')

    const existingCodes=new Set(materials.map(m=>String(m.materialCode||'').trim().toUpperCase()))
    const newCodes=new Map()
    const requestedStock=new Map()
    rows.forEach((row,index)=>{
      const source=doc.items[index]
      const label='Dòng '+(index+1)
      if(!source){issues.push(label+': Không có dữ liệu trong tờ khai.');return}
      const quantity=Number(source.quantity)
      const ratio=parseNumber(row.conversionRatio)
      const vat=parseNumber(row.vatRate)
      if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000000)
        issues.push(label+': Số lượng tờ khai phải lớn hơn 0 và hợp lệ.')
      if(!Number.isFinite(ratio)||ratio<=0||ratio>1000000000||
         !Number.isFinite(quantity*ratio)||quantity*ratio>1000000000)
        issues.push(label+': Hệ số quy đổi và số lượng kho phải lớn hơn 0, trong giới hạn cho phép.')
      if(!Number.isFinite(vat)||vat<0||vat>100||
         (String(row.vatRate||'').split(/[.,]/)[1]?.length||0)>3)
        issues.push(label+': VAT phải từ 0 đến 100%, tối đa 3 chữ số thập phân.')

      if(direction==='IN'){
        if(!row.warehouseId)issues.push(label+': Chưa chọn kho nhận.')
        else if(!warehouses.some(w=>String(w.id)===String(row.warehouseId)))
          issues.push(label+': Kho nhận đã chọn không tồn tại. Hãy chọn lại.')
        if(!String(row.batchNo||'').trim())issues.push(label+': Chưa nhập số lô.')
        else if(String(row.batchNo).trim().length>50)
          issues.push(label+': Số lô không được vượt quá 50 ký tự.')
        if(row.newMaterial){
          const code=String(row.newMaterialCode||'').trim()
          const name=String(row.newMaterialName||'').trim()
          const unit=String(row.newMaterialUnit||'').trim()
          if(!code)issues.push(label+': Chưa có mã vật tư; bật "Tự sinh mã" hoặc nhập mã thủ công.')
          else if(code.length>50)issues.push(label+': Mã vật tư tối đa 50 ký tự.')
          else if(existingCodes.has(code.toUpperCase()))
            issues.push(label+': Mã vật tư '+code+' đã tồn tại. Hãy chọn vật tư có sẵn hoặc tạo mã khác.')
          if(!name)issues.push(label+': Chưa nhập tên vật tư mới.')
          else if(name.length>500)issues.push(label+': Tên vật tư tối đa 500 ký tự.')
          if(!unit)issues.push(label+': Chưa nhập đơn vị kho của vật tư mới.')
          else if(unit.length>20)issues.push(label+': Đơn vị kho tối đa 20 ký tự.')
          if(code){
            const key=code.toUpperCase()
            const first=newCodes.get(key)
            if(first&&(first.name!==name||first.unit!==unit))
              issues.push(label+': Mã '+code+' trùng dòng '+first.index+' nhưng tên/đơn vị khác nhau.')
            if(!first)newCodes.set(key,{name,unit,index:index+1})
          }
        } else if(!row.materialId)
          issues.push(label+': Chưa chọn mã vật tư. Chọn mã có sẵn hoặc nhấn "Tạo mới tại đây".')
        else if(!materials.some(m=>String(m.id)===String(row.materialId)))
          issues.push(label+': Mã vật tư đã chọn không tồn tại. Hãy chọn lại.')
      } else {
        if(!row.inventoryId)issues.push(label+': Chưa chọn lô tồn kho để xuất.')
        else {
          const batch=mapStock.get(String(row.inventoryId))
          if(!batch)issues.push(label+': Lô tồn kho đã chọn không còn tồn tại. Hãy chọn lại.')
          else {
            if(batch.locked)issues.push(label+': Lô tồn kho đang bị khóa.')
            if(!row.warehouseId||String(row.warehouseId)!==String(batch.warehouseId))
              issues.push(label+': Kho xuất không khớp với lô tồn kho.')
            if(Number.isFinite(quantity*ratio)&&quantity*ratio>0)
              requestedStock.set(String(row.inventoryId),
                (requestedStock.get(String(row.inventoryId))||0)+quantity*ratio)
          }
        }
      }
    })
    if(direction==='OUT')requestedStock.forEach((requested,id)=>{
      const batch=mapStock.get(id)
      if(!batch)return
      const free=Number(batch.quantityOnHand||0)-Number(batch.quantityReserved||0)-
        Number(batch.quantityLocked||0)
      if(requested>free)
        issues.push('Lô '+(batch.batchNo||id)+': Số lượng xuất '+formatVnNumber(requested,6)+
          ' vượt tồn khả dụng '+formatVnNumber(free,6)+'.')
    })
    return issues
  },[doc,confirmed,rows,number,date,currency,direction,materials,warehouses,mapStock])
  const ready=Boolean(doc)&&!confirmed&&doc.status!=='POSTED'&&validationErrors.length===0

  const confirm=async()=>{
    setError('');setSuccess('')
    setShowValidation(true)
    if(!ready){return}
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
      </Stack>}
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
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{p:1,bgcolor:'action.hover',borderRadius:1}}>
          <Button size="small" variant="outlined" disabled={!bulkAllowed||direction!=='IN'} onClick={bulkCreateMaterials}>
            Tạo mới vật tư tất cả dòng
          </Button>
          <Button size="small" variant="outlined" disabled={!bulkAllowed} onClick={bulkMatchMaterials}>
            Tự chọn vật tư theo tên mô tả
          </Button>
          <Button size="small" color="warning" variant="outlined" disabled={!bulkAllowed} onClick={bulkClearMaterials}>
            Bỏ chọn vật tư tất cả
          </Button>
          {direction==='IN'&&<>
            <TextField size="small" label="Số lô chung" value={bulkBatchNo}
              placeholder={number||'Nhập số lô'}
              disabled={!bulkAllowed} onChange={e=>setBulkBatchNo(e.target.value)}
              sx={{minWidth:180,flex:'1 1 180px'}}/>
            <Button size="small" variant="outlined" disabled={!bulkAllowed} onClick={applyBatchToAll}>
              Điền số lô tất cả
            </Button>
          </>}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Tự chọn chỉ ghép tên trùng chính xác sau chuẩn hóa; tên trùng nhiều mã hoặc nhiều lô sẽ bỏ qua.
          Xuất kho chỉ tự chọn khi xác định duy nhất lô còn đủ hàng. Tất cả thao tác chỉ chuẩn bị dữ liệu, chưa ghi kho.
        </Typography>
        <TableContainer sx={{flex:1,minHeight:150,border:'1px solid',borderColor:'divider',borderRadius:1}}>
          <Table size="small" stickyHeader sx={{minWidth:2050}}>
            <TableHead><TableRow>
              <TableCell>STT / HS / Tên theo tờ khai</TableCell>
              <TableCell sx={{minWidth:300}}>Mã và tên nguyên vật liệu gốc</TableCell>
              <TableCell>Kho / Lô hàng</TableCell>
              <TableCell align="right">SL khai báo</TableCell>
              <TableCell>Hệ số sang ĐV kho</TableCell>
              <TableCell align="right">SL kho</TableCell>
              <TableCell align="right">Đơn giá hóa đơn gốc</TableCell>
              <TableCell align="right">Trị giá hóa đơn gốc</TableCell>
              <TableCell align="right">Thuế NK gốc</TableCell>
              <TableCell align="right">VAT HQ gốc</TableCell>
              <TableCell>VAT nhập kho (%)</TableCell>
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
                          createNewAtLine(i,item)} disabled={confirmed}>Tạo mới tại đây</Button>
                      </Stack>
                      {line.newMaterial?<Stack spacing={0.5}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <FormControlLabel sx={{m:0,flexShrink:0}}
                            label={<Typography variant="caption">Tự sinh mã</Typography>}
                            control={<Switch size="small" checked={line.newMaterialAutoCode!==false}
                              disabled={confirmed} onChange={e=>edit(i,{
                                newMaterialAutoCode:e.target.checked,
                                newMaterialCode:e.target.checked?suggestCode(i):''
                              })}/>} />
                          <TextField size="small" label="Mã vật tư" fullWidth value={line.newMaterialCode}
                            disabled={confirmed}
                            inputProps={{readOnly:line.newMaterialAutoCode!==false}}
                            helperText="Mã được kiểm tra trùng khi ghi kho"
                            onChange={e=>edit(i,{newMaterialCode:e.target.value})}/>
                        </Stack>
                        <TextField size="small" label="Tên nguyên vật liệu gốc" value={line.newMaterialName}
                          helperText="Mặc định từ tên hàng trên tờ khai; có thể sửa"
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
                  <TableCell align="right">
                    {item.unitPrice==null?'—':formatVnNumber(item.unitPrice,4)} {item.currency||currency}
                  </TableCell>
                  <TableCell align="right" sx={{whiteSpace:'nowrap'}}>
                    {item.invoiceValue!=null?formatVnNumber(Number(item.invoiceValue),2):
                      item.unitPrice!=null?formatVnNumber(Number(item.quantity)*Number(item.unitPrice),2):'—'}
                    {' '}{item.currency||currency}
                    <Typography variant="caption" display="block">
                      SL {formatVnNumber(item.quantity,4)} {item.unit}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{whiteSpace:'nowrap'}}>
                    <Typography variant="caption" display="block">
                      Giá tính NK: {item.importTaxableValueVnd==null?'—':
                        formatVnNumber(Number(item.importTaxableValueVnd),2)} VND
                    </Typography>
                    <Typography variant="caption" display="block">
                      {item.importTaxRate==null?'—':item.importTaxRate+'%'}
                      {item.importTariffCode?' · mã '+item.importTariffCode:''}
                    </Typography>
                    <Typography fontWeight={700}>
                      {item.importTaxAmountVnd==null?'—':
                        formatVnNumber(Number(item.importTaxAmountVnd),2)} VND
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{whiteSpace:'nowrap'}}>
                    <Typography variant="caption" display="block">
                      Giá tính VAT: {item.vatTaxableValueVnd==null?'—':
                        formatVnNumber(Number(item.vatTaxableValueVnd),2)} VND
                    </Typography>
                    <Typography variant="caption" display="block">
                      {item.vatRate==null?'—':item.vatRate+'%'}
                      {item.vatTariffCode?' · mã '+item.vatTariffCode:''}
                    </Typography>
                    <Typography fontWeight={700}>
                      {item.vatAmountVnd==null?'—':
                        formatVnNumber(Number(item.vatAmountVnd),2)} VND
                    </Typography>
                  </TableCell>
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
          <TextField size="small" label="VAT chung (%)" value={bulkVatInput}
            placeholder={commonVatRate!==''?`Hiện tại: ${commonVatRate}%`:'Ví dụ: 8 hoặc 8,5'}
            helperText="Chỉ áp dụng sau khi xác nhận"
            disabled={confirmed||busy} sx={{width:175}} inputProps={{inputMode:'decimal'}}
            error={bulkVatInput!==''&&!canApplyBulkVat}
            onChange={e=>setBulkVatInput(e.target.value)}/>
          <Button variant="outlined" size="small" disabled={!canApplyBulkVat||confirmed||busy}
            onClick={applyVatToAll}>Áp dụng tất cả</Button>
          <Chip label={`SL × đơn giá HĐ: ${formatVnNumber(taxSummary.subtotal,2)} ${currency}`}/>
          <Chip label={`VAT nhập kho tạm tính: ${formatVnNumber(taxSummary.vat,2)} ${currency}`}/>
          <Chip color="success" label={`Tổng nhập kho tạm tính: ${formatVnNumber(taxSummary.total,2)} ${currency}`}/>
        </Stack>
        {taxSummary.missing>0&&<Alert severity="warning">
          Có {taxSummary.missing} dòng chưa đủ đơn giá/SL từ tờ khai.
          Tổng tiền chỉ tính các dòng có giá, không phải tổng đầy đủ.
        </Alert>}
        <Typography variant="caption" color="text.secondary">
          Trị giá hóa đơn gốc, thuế NK gốc và VAT Hải quan gốc được đọc riêng từ file Excel;
          không bị ghi đè khi bạn thay đổi VAT nhập kho hoặc tra cứu FTA. Các chip tổng phía trên
          chỉ mô phỏng giá trị hóa đơn và VAT nhập kho theo đơn vị tiền đang chọn,
          KHÔNG phải tổng thuế phải nộp Hải quan. Nếu khác tiền tệ, cần quy đổi trước khi cộng tổng.
        </Typography>
        <CustomsTariffComparison key={doc.id} doc={doc} direction={direction}
          currency={currency} date={date}/>
      </>}
    </DialogContent>
    <DialogActions sx={{flexWrap:'wrap'}}>
      {doc&&!confirmed&&error&&
        <Alert severity="error" sx={{width:'100%',textAlign:'left',whiteSpace:'pre-wrap'}}>
          <Typography variant="subtitle2" fontWeight={700}>Không xác nhận được tờ khai</Typography>
          {error}
        </Alert>}
      {doc&&!confirmed&&showValidation&&validationErrors.length>0&&
        <Alert severity="warning" sx={{width:'100%',textAlign:'left'}}>
          <Typography variant="subtitle2" fontWeight={700}>
            Chưa thể xác nhận {direction==='IN'?'nhập':'xuất'} kho: cần sửa {validationErrors.length} lỗi sau
          </Typography>
          <Box component="ol" sx={{pl:3,my:0.5,maxHeight:170,overflowY:'auto'}}>
            {validationErrors.map((message,index)=><li key={index}>{message}</li>)}
          </Box>
          <Typography variant="caption">Sửa thông tin ở đúng dòng rồi nhấn xác nhận lại.</Typography>
        </Alert>}
      <Button onClick={onClose} disabled={busy}>Đóng</Button>
      <Button color="primary" variant="contained" disabled={!doc||busy||confirmed}
        onClick={()=>void confirm()}>{busy?'Đang ghi kho...':
          direction==='IN'?'Xác nhận nhập kho theo tờ khai':'Xác nhận xuất kho theo tờ khai'}</Button>
    </DialogActions>
  </Dialog>
}
