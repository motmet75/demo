import React, {useEffect, useMemo, useState} from 'react'
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography, Alert
} from '@mui/material'
import {formatVnNumber, parseVnNumber} from '../../utils/vietnameseNumbers'

const fold = value => String(value ?? '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g,'d')
  .toLowerCase().replace(/\s+/g,' ').trim()

const stockId = row => String(row.inventoryId ?? row.id ?? '')
export const stockAvailable = row => {
  const onHand=Number(row.quantityOnHand||0)
  const reserved=Number(row.quantityReserved||0)
  const held=Number(row.quantityLocked||0)
  return Math.max(0, onHand-reserved-held)
}

/**
 * The inventory table has no supplier column. Resolve suppliers from
 * PURCHASE invoices linked to stock-IN movements, with the specific
 * inventoryId as the join key. A batch may have multiple suppliers.
 */
export function inventorySupplierLabels(row, sourceByInventory) {
  const sources=sourceByInventory.get(stockId(row))||[]
  const names=[...new Set(sources.map(s=>String(s.supplierName||'').trim()).filter(Boolean))]
  return names.length ? names : ['Chưa xác định']
}

export default function InvoiceInventoryPickerDialog({
  open, onClose, onSelect, inventory=[], supplierReceipts=[], invoiceLine=null,
  currentInventoryId='', allocatedLines=[]
}) {
  const [search,setSearch]=useState('')
  const [supplier,setSupplier]=useState('ALL')
  const [warehouse,setWarehouse]=useState('ALL')
  const [page,setPage]=useState(0)
  const [size,setSize]=useState(15)

  useEffect(()=>{
    if(open){
      setSearch('')
      setSupplier('ALL')
      setWarehouse('ALL')
      setPage(0)
    }
  },[open,invoiceLine?.invoiceLineIndex])

  const byInventory=useMemo(()=>{
    const result=new Map()
    supplierReceipts.forEach(source=>{
      const key=String(source.inventoryId||'')
      if(!key)return
      if(!result.has(key))result.set(key,[])
      result.get(key).push(source)
    })
    return result
  },[supplierReceipts])

  const allocated=useMemo(()=>{
    const result=new Map()
    allocatedLines.forEach(row=>{
      if(row.invoiceLineIndex===invoiceLine?.invoiceLineIndex || !row.inventoryId)return
      const key=String(row.inventoryId)
      result.set(key,(result.get(key)||0)+(parseVnNumber(row.quantity)||0))
    })
    return result
  },[allocatedLines,invoiceLine?.invoiceLineIndex])

  const rows=useMemo(()=>inventory.map(row=>{
    const id=stockId(row)
    const sources=byInventory.get(id)||[]
    const suppliers=inventorySupplierLabels(row,byInventory)
    const stock=stockAvailable(row)
    const remaining=stock-(allocated.get(id)||0)
    const lookup=fold([
      row.materialCode,row.materialName,row.batchNo,row.warehouseCode,
      row.warehouseName,row.contractCode,id,...suppliers,
      ...sources.map(s=>s.purchaseInvoiceNumber)
    ].join(' '))
    const name=fold(invoiceLine?.description)
    // A text match is only a hint. The operator must choose the batch.
    const words=name.split(' ').filter(x=>x.length>=4)
    const suggestion=words.length>0 && words.some(w=>fold(row.materialName).includes(w))
    return {...row,inventoryId:id,suppliers,sources,stock,remaining,lookup,suggestion}
  }),[inventory,byInventory,allocated,invoiceLine?.description])

  const suppliers=useMemo(()=>[...new Set(rows.flatMap(r=>r.suppliers))].sort((a,b)=>
    a.localeCompare(b,'vi')),[rows])
  const warehouses=useMemo(()=>[...new Map(rows.map(r=>
    [String(r.warehouseId),{id:String(r.warehouseId),name:r.warehouseName||r.warehouseCode||'Không rõ kho'}])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name,'vi')),[rows])

  const filtered=useMemo(()=>{
    const q=fold(search)
    return rows.filter(row=>{
      if(row.locked || row.remaining<=0)return false
      if(supplier!=='ALL' && !row.suppliers.includes(supplier))return false
      if(warehouse!=='ALL' && String(row.warehouseId)!==warehouse)return false
      return !q || q.split(' ').every(token=>row.lookup.includes(token))
    }).sort((a,b)=>
      Number(b.inventoryId===currentInventoryId)-Number(a.inventoryId===currentInventoryId) ||
      Number(b.suggestion)-Number(a.suggestion) ||
      String(a.materialName||'').localeCompare(String(b.materialName||''),'vi') ||
      String(a.batchNo||'').localeCompare(String(b.batchNo||''),'vi'))
  },[rows,supplier,warehouse,search,currentInventoryId])

  useEffect(()=>setPage(0),[search,supplier,warehouse])
  const paged=filtered.slice(page*size,(page+1)*size)
  const required=parseVnNumber(invoiceLine?.quantity)
  const unit=invoiceLine?.originalUnit || 'đơn vị'

  return <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth
    PaperProps={{sx:{height:{xs:'95vh',md:'85vh'},maxHeight:'95vh'}}}>
    <DialogTitle sx={{fontWeight:800}}>
      Chọn hàng từ kho · Lô / Nhà cung cấp
      <Typography variant="body2" color="text.secondary">
        Dòng hóa đơn: {invoiceLine?.description||'—'} · Số lượng cần xuất: {Number.isFinite(required)?formatVnNumber(required,6):'—'} {unit}
      </Typography>
    </DialogTitle>
    <DialogContent dividers sx={{display:'flex',flexDirection:'column',gap:1.5}}>
      <Alert severity="info">
        Nhà cung cấp được lấy từ <strong>hóa đơn nhập kho đã ghi nhận</strong>.
        Nếu một lô có nhiều hóa đơn nhập, hệ thống hiển thị tất cả nhà cung cấp.
        Chọn đúng lô hàng; việc chọn không tự trừ tồn kho.
      </Alert>
      <Stack direction={{xs:'column',md:'row'}} spacing={1}>
        <TextField label="Tìm mã hàng, tên, số máy, lô, hóa đơn nhập, NCC..."
          fullWidth size="small" autoFocus value={search} onChange={e=>setSearch(e.target.value)}/>
        <FormControl size="small" sx={{minWidth:{md:245}}}>
          <InputLabel>Nhà cung cấp</InputLabel>
          <Select value={supplier} label="Nhà cung cấp" onChange={e=>setSupplier(e.target.value)}>
            <MenuItem value="ALL">Tất cả nhà cung cấp</MenuItem>
            {suppliers.map(name=><MenuItem key={name} value={name}>{name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{minWidth:{md:200}}}>
          <InputLabel>Kho</InputLabel>
          <Select value={warehouse} label="Kho" onChange={e=>setWarehouse(e.target.value)}>
            <MenuItem value="ALL">Tất cả kho</MenuItem>
            {warehouses.map(w=><MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Chip label={'Có '+filtered.length+' lô hàng phù hợp'} size="small"/>
        <Chip label={'Tổng '+rows.length+' lô đã ghi nhận'} size="small" variant="outlined"/>
        <Typography color="text.secondary" variant="caption">
          Số lượng khả dụng = tồn kho − đã giữ − khóa − đã chọn trong hóa đơn này.
        </Typography>
      </Stack>
      <TableContainer sx={{flex:1,minHeight:120,border:1,borderColor:'divider',borderRadius:1}}>
        <Table size="small" stickyHeader sx={{minWidth:1150}}>
          <TableHead><TableRow>
            <TableCell sx={{fontWeight:700}}>Mã hàng / Tên hàng</TableCell>
            <TableCell sx={{fontWeight:700}}>Nhà cung cấp</TableCell>
            <TableCell sx={{fontWeight:700}}>HĐ nhập kho</TableCell>
            <TableCell sx={{fontWeight:700}}>Kho</TableCell>
            <TableCell sx={{fontWeight:700}}>Lô / Batch / Số máy</TableCell>
            <TableCell sx={{fontWeight:700}} align="right">Tồn kho</TableCell>
            <TableCell sx={{fontWeight:700}} align="right">Khả dụng</TableCell>
            <TableCell sx={{fontWeight:700}}>Đơn vị</TableCell>
            <TableCell align="right">Chọn</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {paged.map(row=>{
              const isCurrent=row.inventoryId===String(currentInventoryId)
              const insufficient=Number.isFinite(required) && row.remaining<required
              return <TableRow key={row.inventoryId} hover selected={isCurrent}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{row.materialName||'—'}</Typography>
                  <Typography variant="caption">{row.materialCode||'—'}</Typography>
                  {row.suggestion&&<Chip size="small" color="info" label="Gợi ý khớp tên" sx={{ml:1}}/>}
                </TableCell>
                <TableCell>
                  {row.suppliers.map(name=><Typography key={name} variant="body2">{name}</Typography>)}
                </TableCell>
                <TableCell>
                  {[...new Set(row.sources.map(src=>src.purchaseInvoiceNumber).filter(Boolean))]
                    .slice(0,4).map(n=><Typography key={n} variant="caption" display="block">{n}</Typography>)}
                  {row.sources.length===0&&'—'}
                </TableCell>
                <TableCell>{row.warehouseName||row.warehouseCode||'—'}</TableCell>
                <TableCell sx={{maxWidth:240,overflowWrap:'anywhere'}}>{row.batchNo||'—'}</TableCell>
                <TableCell align="right">{formatVnNumber(row.quantityOnHand,6)}</TableCell>
                <TableCell align="right">
                  <Typography color={insufficient?'error.main':'success.main'} fontWeight={800}>
                    {formatVnNumber(row.remaining,6)}
                  </Typography>
                </TableCell>
                <TableCell>{row.unit||'—'}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant={isCurrent?'contained':'outlined'}
                    onClick={()=>onSelect(row)}
                    disabled={insufficient||row.remaining<=0}>
                    {isCurrent?'Đang chọn':'Chọn lô'}
                  </Button>
                </TableCell>
              </TableRow>
            })}
            {paged.length===0&&<TableRow><TableCell colSpan={9}>
              Không tìm thấy lô khả dụng. Thử chọn nhà cung cấp khác hoặc kiểm tra hàng nhập kho.
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={filtered.length} page={page} rowsPerPage={size}
        rowsPerPageOptions={[10,15,25,50]} labelRowsPerPage="Dòng/trang"
        onPageChange={(_,p)=>setPage(p)}
        onRowsPerPageChange={e=>{setSize(Number(e.target.value));setPage(0)}}/>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
  </Dialog>
}
