import React, {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress,
  FormControlLabel, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material'
import {fetchInventoryView} from '../../api/inventoryApi'
import {
  fetchInvoiceStockOutDocuments, fetchInvoiceStockOutPosted, fetchInvoiceStockOutInventorySuppliers,
  fetchInvoiceStockOutDocument, uploadInvoiceStockOutDocument,
  confirmInvoiceStockOut, openInvoiceStockOutPdf
} from '../../api/invoiceStockOutApi'
import {useAuth} from '../../context/useAuth'
import InvoiceInventoryPickerDialog, {inventorySupplierLabels, stockAvailable} from './InvoiceInventoryPickerDialog'
import {formatVnNumber, parseVnNumber, parseMachineNumber} from '../../utils/vietnameseNumbers'

const amount = value => formatVnNumber(Number(value||0),2)
const number = value => parseVnNumber(value)
const vatOf = value => {
  const m=String(value||'').match(/(\d+(?:[.,]\d+)?)\s*%?/)
  return m ? Number(m[1].replace(',','.')) : 0
}
const today=()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function newLine(item,index,vatRate){
  return {invoiceLineIndex:index,description:item.description||'',invoiceQuantity:parseMachineNumber(item.quantity),
    inventoryId:'',quantity:formatVnNumber(parseMachineNumber(item.quantity),6),
    unitPrice:formatVnNumber(parseMachineNumber(item.unitPrice),4),
    vatRate:formatVnNumber(vatRate,3),originalUnit:item.unit||''}
}

export default function InvoiceStockOutPage(){
  const {hasInventoryPriceAccess} = useAuth()
  const [docs,setDocs]=useState([])
  const [posted,setPosted]=useState([])
  const [stock,setStock]=useState([])
  const [supplierReceipts,setSupplierReceipts]=useState([])
  const [supplierWarning,setSupplierWarning]=useState('')
  const [pickingLine,setPickingLine]=useState(null)
  const [selectedDoc,setSelectedDoc]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [buyer,setBuyer]=useState({buyerType:'PERSONAL',buyerName:'',buyerTaxId:'',buyerAddress:''})
  const [header,setHeader]=useState({invoiceDate:today(),invoiceSerial:'',invoiceNumber:'',
    exportType:'SALE',vatRate:'8'})
  const [rows,setRows]=useState([])
  const [acknowledgeMismatch,setAcknowledgeMismatch]=useState(false)
  const [acknowledgeHistoricalDate,setAcknowledgeHistoricalDate]=useState(false)

  const load=useCallback(async()=>{
    setError('')
    setSupplierWarning('')
    try{
      const [documents,inventory,history,sources]=await Promise.all([
        fetchInvoiceStockOutDocuments(),fetchInventoryView(),fetchInvoiceStockOutPosted(),
        fetchInvoiceStockOutInventorySuppliers().catch(error=>{
          setSupplierWarning('Không tải được nhà cung cấp từ hóa đơn nhập: '+error.message)
          return []
        })])
      setDocs(Array.isArray(documents)?documents:[])
      setStock(Array.isArray(inventory)?inventory:[])
      setPosted(Array.isArray(history)?history:[])
      setSupplierReceipts(Array.isArray(sources)?sources:[])
    }catch(e){setError(e.message||'Không tải được dữ liệu')}
  },[])
  useEffect(()=>{void load()},[load])

  const selectDocument=async doc=>{
    if(!doc){setSelectedDoc(null);setRows([]);return}
    setBusy(true);setError('');setSuccess('')
    try{
      // Always fetch the latest Invoice Desk corrections before mapping to stock.
      const fresh=await fetchInvoiceStockOutDocument(doc.id)
      setSelectedDoc(fresh)
      const vat=vatOf(fresh.vatRate)
      setBuyer({buyerType:fresh.buyerType||'PERSONAL',buyerName:fresh.buyer||'',
        buyerTaxId:fresh.buyerTaxId||'',buyerAddress:fresh.buyerAddress||''})
      setHeader({invoiceDate:fresh.date||today(),invoiceSerial:fresh.serial||'',
        invoiceNumber:fresh.number||'',exportType:'SALE',vatRate:formatVnNumber(vat,3)})
      setRows((fresh.items||[]).map((item,i)=>newLine(item,i,vat)))
      setAcknowledgeMismatch(false);setAcknowledgeHistoricalDate(false)
    }catch(e){setError(e.message||'Không đọc được dữ liệu hóa đơn')}
    finally{setBusy(false)}
  }
  const upload=async e=>{
    const file=e.target.files?.[0]
    e.target.value=''
    if(!file)return
    setBusy(true);setError('');setSuccess('')
    try{
      const doc=await uploadInvoiceStockOutDocument(file)
      setDocs(prev=>[doc,...prev.filter(x=>x.id!==doc.id)])
      // Apply preview directly because selectDocument also needs an API call.
      const vat=vatOf(doc.vatRate)
      setSelectedDoc(doc)
      setBuyer({buyerType:doc.buyerType||'PERSONAL',buyerName:doc.buyer||'',
        buyerTaxId:doc.buyerTaxId||'',buyerAddress:doc.buyerAddress||''})
      setHeader({invoiceDate:doc.date||today(),invoiceSerial:doc.serial||'',
        invoiceNumber:doc.number||'',exportType:'SALE',vatRate:formatVnNumber(vat,3)})
      setRows((doc.items||[]).map((item,i)=>newLine(item,i,vat)))
      setAcknowledgeMismatch(false);setAcknowledgeHistoricalDate(false)
    }catch(err){setError(err.message||'Lỗi OCR');}
    finally{setBusy(false)}
  }
  const patchLine=(idx,patch)=>setRows(old=>old.map((row,i)=>i===idx?{...row,...patch}:row))
  const available=useMemo(()=>stock.filter(x=>stockAvailable(x)>0 && !x.locked),[stock])
  const inventorySourceMap=useMemo(()=>{
    const result=new Map()
    supplierReceipts.forEach(source=>{
      const id=String(source.inventoryId||'')
      if(!result.has(id))result.set(id,[])
      result.get(id).push(source)
    })
    return result
  },[supplierReceipts])
  const suggestStock=description=>{
    const query=clean(description)
    if(!query)return []
    return available.filter(v=>clean(v.materialName).split(' ').filter(x=>x.length>3)
      .some(token=>query.includes(token))).slice(0,5)
  }
  const totals=useMemo(()=>rows.reduce((acc,r)=>{
    const base=number(r.quantity)*number(r.unitPrice)
    return {subtotal:acc.subtotal+base,vat:acc.vat+base*number(r.vatRate)/100}
  },{subtotal:0,vat:0}),[rows])
  const expectedSubtotal=parseMachineNumber(selectedDoc?.subtotal)||0
  const expectedVat=parseMachineNumber(selectedDoc?.vat)||0
  const expectedTotal=parseMachineNumber(selectedDoc?.total)||0
  const mismatch=(Boolean(selectedDoc?.subtotal) && Math.abs(totals.subtotal-expectedSubtotal)>1)
    || (Boolean(selectedDoc?.vat) && Math.abs(totals.vat-expectedVat)>1)
    || (Boolean(selectedDoc?.total) && Math.abs(totals.subtotal+totals.vat-expectedTotal)>1)
  const historical=header.invoiceDate!==today()
  const missing=rows.some(r=>!r.inventoryId || !Number.isFinite(number(r.quantity)) ||
    number(r.quantity)<=0 || !Number.isFinite(number(r.unitPrice)) || number(r.unitPrice)<0 ||
    !Number.isFinite(number(r.vatRate)) || number(r.vatRate)<0 || number(r.vatRate)>100)
  const onConfirm=async()=>{
    setError('');setSuccess('')
    if(!window.confirm('Xác nhận xuất kho theo hóa đơn? Hành động này trừ tồn kho thực tế và tạo các phiếu OUT.'))return
    setBusy(true)
    try{
      const result=await confirmInvoiceStockOut({
        documentId:selectedDoc.id,invoiceDate:header.invoiceDate,
        invoiceSerial:header.invoiceSerial,invoiceNumber:header.invoiceNumber,
        buyerType:buyer.buyerType,buyerName:buyer.buyerName,buyerTaxId:buyer.buyerTaxId,
        buyerAddress:buyer.buyerAddress,exportType:header.exportType,
        vatRate:number(header.vatRate),acknowledgeHistoricalDate,
        acknowledgeMismatch,
        lines:rows.map(r=>({invoiceLineIndex:r.invoiceLineIndex,inventoryId:r.inventoryId,
          quantity:number(r.quantity),unitPrice:number(r.unitPrice),vatRate:number(r.vatRate)})),
      })
      setSuccess('Xuất kho thành công: '+result.lineCount+' dòng, '+result.movements?.length+' phiếu OUT. Mã chứng từ: '+result.id)
      setSelectedDoc(null);setRows([])
      await load()
    }catch(e){setError(e.message||'Xuất kho thất bại; dữ liệu chưa xác nhận.')}
    finally{setBusy(false)}
  }
  if(!hasInventoryPriceAccess)return <Alert severity="error">Bạn cần quyền quản lý kho để xuất theo hóa đơn.</Alert>
  return <Box sx={{p:2,overflowY:'auto',height:'100%',bgcolor:'#f8fafc'}}>
    <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" gap={1} sx={{mb:2}}>
      <Box>
        <Typography variant="h6" fontWeight={800}>Xuất kho theo hóa đơn PDF</Typography>
        <Typography variant="caption" color="text.secondary">
          PDF → Invoice Desk OCR → đối chiếu khách hàng và dòng hàng → chọn lô kho → xác nhận OUT theo ngày hóa đơn.
        </Typography>
      </Box>
      <Stack direction="row" gap={1}>
        <Button variant="outlined" size="small" href="/bom-inventory/invoice-desk" target="_blank">
          Mở Invoice Desk
        </Button>
        <Button variant="outlined" size="small" onClick={()=>void load()} disabled={busy}>Làm mới</Button>
        <Button variant="contained" size="small" component="label" disabled={busy}>
          {busy?'Đang xử lý...':'Tải PDF hóa đơn'}
          <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp" onChange={upload}/>
        </Button>
      </Stack>
    </Stack>
    {error&&<Alert severity="error" sx={{mb:1.5}} onClose={()=>setError('')}>{error}</Alert>}
    {success&&<Alert severity="success" sx={{mb:1.5}} onClose={()=>setSuccess('')}>{success}</Alert>}
    {supplierWarning&&<Alert severity="warning" sx={{mb:1.5}}>{supplierWarning}</Alert>}
    <Paper variant="outlined" sx={{p:2,mb:2}}>
      <Stack spacing={2}>
        <Autocomplete size="small" options={docs}
          getOptionLabel={d=>[d.serial,d.number,d.date,d.buyer||d.source].filter(Boolean).join(' · ')}
          value={selectedDoc ? docs.find(d=>d.id===selectedDoc.id)||selectedDoc : null}
          isOptionEqualToValue={(a,b)=>a.id===b.id}
          onChange={(_,doc)=>void selectDocument(doc)}
          renderInput={params=><TextField {...params} label="Chọn hóa đơn đã đọc bằng Invoice Desk" placeholder="Ký hiệu, số hóa đơn, tên người mua..." />}/>
        {busy&&<CircularProgress size={20}/>}
        {selectedDoc&&<>
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Chip size="small" color="primary" label={selectedDoc.source}/>
            <Chip size="small" label={'Số '+(selectedDoc.number||'?')+' · '+(selectedDoc.serial||'?')}/>
            <Chip size="small" label={(selectedDoc.items||[]).length+' dòng OCR'}/>
            <Button size="small" onClick={()=>void openInvoiceStockOutPdf(selectedDoc.id).catch(e=>setError(e.message))}>Xem PDF gốc</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">Người bán từ PDF: {selectedDoc.seller||'Chưa xác định'} · MST: {selectedDoc.sellerTaxId||'—'}. Kiểm tra đúng công ty phát hành trước khi trừ kho.</Typography>
          {selectedDoc.warnings?.length>0&&<Alert severity="warning">Invoice Desk cần kiểm tra: {selectedDoc.warnings.slice(0,5).join(' · ')}</Alert>}
          <Typography fontWeight={800}>1. Khách hàng và thông tin xuất hóa đơn</Typography>
          <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(3,minmax(0,1fr))'},gap:1.5}}>
            <TextField select size="small" label="Loại khách hàng" value={buyer.buyerType}
              onChange={e=>setBuyer(b=>({...b,buyerType:e.target.value}))}>
              <MenuItem value="PERSONAL">Cá nhân</MenuItem><MenuItem value="COMPANY">Công ty</MenuItem>
            </TextField>
            <TextField size="small" label={buyer.buyerType==='PERSONAL'?'Họ tên người mua':'Tên công ty'} value={buyer.buyerName}
              onChange={e=>setBuyer(b=>({...b,buyerName:e.target.value}))}/>
            <TextField size="small" label="Mã số thuế (nếu có)" value={buyer.buyerTaxId}
              onChange={e=>setBuyer(b=>({...b,buyerTaxId:e.target.value}))}/>
            <TextField size="small" label="Địa chỉ người mua" value={buyer.buyerAddress} sx={{gridColumn:{md:'span 3'}}}
              onChange={e=>setBuyer(b=>({...b,buyerAddress:e.target.value}))}/>
          </Box>
          <Typography fontWeight={800}>2. Ngày, loại xuất kho, giá bán và VAT</Typography>
          <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(3,minmax(0,1fr))'},gap:1.5}}>
            <TextField size="small" type="date" label="Ngày hóa đơn / ngày hạch toán" InputLabelProps={{shrink:true}}
              value={header.invoiceDate} onChange={e=>setHeader(h=>({...h,invoiceDate:e.target.value}))}/>
            <TextField size="small" label="Ký hiệu" value={header.invoiceSerial} onChange={e=>setHeader(h=>({...h,invoiceSerial:e.target.value}))}/>
            <TextField size="small" label="Số hóa đơn" value={header.invoiceNumber} onChange={e=>setHeader(h=>({...h,invoiceNumber:e.target.value}))}/>
            <TextField size="small" select label="Loại xuất kho" value={header.exportType}
              onChange={e=>setHeader(h=>({...h,exportType:e.target.value}))}>
              <MenuItem value="SALE">Bán hàng</MenuItem>
              <MenuItem value="WARRANTY">Bảo hành</MenuItem>
              <MenuItem value="GIFT">Tặng hàng</MenuItem>
              <MenuItem value="OTHER">Khác</MenuItem>
            </TextField>
            <TextField size="small" label="VAT mặc định (%)" value={header.vatRate}
              onChange={e=>{const rate=e.target.value;setHeader(h=>({...h,vatRate:rate}));setRows(r=>r.map(v=>({...v,vatRate:rate})))}}/>
          </Box>
          {historical&&<Alert severity="warning" sx={{mt:1}}>
            Đây là ngày hóa đơn trước ngày hiện tại. Giao dịch sẽ giảm tồn kho hiện tại, nhưng ngày hạch toán OUT sẽ là ngày trên hóa đơn. Không tự tái dựng số dư kho trong quá khứ.
          </Alert>}
          <Typography fontWeight={800}>3. Đối chiếu danh sách hàng trên PDF với tồn kho</Typography>
          <TableContainer sx={{border:'1px solid',borderColor:'divider',borderRadius:1}}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>STT / Tên trên hóa đơn</TableCell>
                <TableCell width={330}>Chọn hàng / Kho / Lô</TableCell>
                <TableCell width={95}>SL</TableCell>
                <TableCell width={120}>Giá xuất</TableCell>
                <TableCell width={85}>VAT %</TableCell>
                <TableCell align="right">Thành tiền</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {rows.length===0&&<TableRow><TableCell colSpan={6}>
                  <Alert severity="error">OCR chưa nhận dạng được dòng hàng. Mở Invoice Desk để sửa danh sách trước khi xuất kho.</Alert>
                </TableCell></TableRow>}
                {rows.map((line,i)=>{
                  const selected=stock.find(x=>String(x.inventoryId)===String(line.inventoryId))||null
                  const sources=selected?inventorySupplierLabels(selected,inventorySourceMap):[]
                  const inputCell=(field,digits)=>({
                    size:'small',value:line[field],inputProps:{inputMode:'decimal'},
                    onChange:e=>patchLine(i,{[field]:e.target.value}),
                    onBlur:()=>{const parsed=number(line[field]);if(Number.isFinite(parsed))
                      patchLine(i,{[field]:formatVnNumber(parsed,digits)})}
                  })
                  return <TableRow key={i}>
                    <TableCell sx={{minWidth:200}}>
                      <Typography fontWeight={700} variant="body2">{i+1}. {line.description||'(Không có tên)'}</Typography>
                      <Typography variant="caption" color="text.secondary">SL PDF: {formatVnNumber(line.invoiceQuantity,6)} {line.originalUnit}</Typography>
                    </TableCell>
                    <TableCell sx={{minWidth:290}}>
                      <Button variant={selected?'outlined':'contained'} size="small"
                        onClick={()=>setPickingLine(i)}>
                        {selected?'Đổi hàng / Kho / Lô':'Chọn hàng / Kho / Lô'}
                      </Button>
                      {selected&&<Box sx={{mt:0.75}}>
                        <Typography variant="body2" fontWeight={700}>
                          {selected.materialName} · {selected.materialCode}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Kho: {selected.warehouseName||selected.warehouseCode} · Lô: {selected.batchNo}
                        </Typography>
                        <Typography variant="caption" display="block">
                          NCC: {sources.join(' / ')} · Khả dụng: {formatVnNumber(stockAvailable(selected),6)}
                        </Typography>
                      </Box>}
                    </TableCell>
                    <TableCell><TextField {...inputCell('quantity',6)}
                      error={!Number.isFinite(number(line.quantity))||number(line.quantity)<=0}/></TableCell>
                    <TableCell><TextField {...inputCell('unitPrice',4)}
                      error={!Number.isFinite(number(line.unitPrice))||number(line.unitPrice)<0}/></TableCell>
                    <TableCell><TextField {...inputCell('vatRate',3)}
                      error={!Number.isFinite(number(line.vatRate))||number(line.vatRate)<0||number(line.vatRate)>100}/></TableCell>
                    <TableCell align="right">{Number.isFinite(number(line.quantity)*number(line.unitPrice))
                      ?amount(number(line.quantity)*number(line.unitPrice)):'—'}</TableCell>
                  </TableRow>
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
            <Chip label={'Tiền hàng: '+amount(totals.subtotal)+'đ'} color="primary"/>
            <Chip label={'VAT ước tính: '+amount(totals.vat)+'đ'}/>
            <Chip label={'Tổng: '+amount(totals.subtotal+totals.vat)+'đ'} color="success"/>
            <Chip label={'PDF tiền hàng: '+amount(expectedSubtotal)+'đ'}/>
            <Chip label={'PDF VAT: '+amount(expectedVat)+'đ'}/>
            <Chip label={'PDF tổng: '+amount(expectedTotal)+'đ'}/>
          </Stack>
          {mismatch&&<Alert severity="warning">
            Tiền hàng / VAT / tổng cộng có chênh lệch với PDF. Kiểm tra số lượng, giá xuất, thuế suất và hóa đơn gốc trước khi xác nhận.
          </Alert>}
          {mismatch&&<FormControlLabel control={<Checkbox checked={acknowledgeMismatch}
            onChange={e=>setAcknowledgeMismatch(e.target.checked)}/>}
            label="Tôi đã kiểm tra và chấp nhận chênh lệch giữa giá xuất và PDF"/>}
          {historical&&<FormControlLabel control={<Checkbox checked={acknowledgeHistoricalDate}
            onChange={e=>setAcknowledgeHistoricalDate(e.target.checked)}/>}
            label="Tôi xác nhận xuất kho theo ngày hóa đơn (hạch toán hồi tố)"/>}
          <Alert severity="info">Giá, số lượng dùng định dạng Việt Nam (1.000.000,50). Chọn đúng <b>inventory ID, kho, lô, nhà cung cấp</b>. Chỉ trừ kho sau khi xác nhận.</Alert>
          <Button variant="contained" color="error" size="large" disabled={busy||rows.length===0||missing||!buyer.buyerName.trim()
            ||!header.invoiceSerial.trim()||!header.invoiceNumber.trim()||(mismatch&&!acknowledgeMismatch)
            ||(historical&&!acknowledgeHistoricalDate)}
            onClick={()=>void onConfirm()}>
            {busy?'Đang ghi xuất kho...':'Xác nhận xuất kho · tạo Inventory OUT'}
          </Button>
        </>}
      </Stack>
    </Paper>
    <InvoiceInventoryPickerDialog
      open={pickingLine!==null}
      onClose={()=>setPickingLine(null)}
      invoiceLine={pickingLine===null?null:rows[pickingLine]||null}
      currentInventoryId={pickingLine===null?'':rows[pickingLine]?.inventoryId||''}
      allocatedLines={rows}
      supplierReceipts={supplierReceipts}
      inventory={available}
      onSelect={picked=>{
        if(pickingLine!==null)patchLine(pickingLine,{inventoryId:picked.inventoryId})
        setPickingLine(null)
      }}
    />
    <Paper variant="outlined" sx={{p:2}}>
      <Typography fontWeight={800} sx={{mb:1}}>Lịch sử xuất kho bằng hóa đơn</Typography>
      <TableContainer><Table size="small"><TableHead><TableRow>
        <TableCell>Ngày hóa đơn</TableCell><TableCell>Ký hiệu / Số</TableCell>
        <TableCell>Người mua</TableCell><TableCell>Loại xuất</TableCell><TableCell>Đã hạch toán</TableCell>
      </TableRow></TableHead><TableBody>
        {posted.map(p=><TableRow key={p.id}><TableCell>{String(p.invoice_date||'').slice(0,10)}</TableCell>
          <TableCell>{p.invoice_serial} / {p.invoice_number}</TableCell><TableCell>{p.buyer_name}</TableCell>
          <TableCell>{p.export_type}</TableCell><TableCell>{p.confirmed_by}</TableCell></TableRow>)}
        {posted.length===0&&<TableRow><TableCell colSpan={5}>Chưa có hóa đơn đã xuất kho.</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
    </Paper>
  </Box>
}
