import React, { useState } from 'react'
import { Box, Button, Checkbox, Chip, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'

function currentShiftWindow(shiftState) {
  const shift = shiftState?.active
  const openedAt = shift?.opened_at ? new Date(shift.opened_at) : null
  if (!openedAt || Number.isNaN(openedAt.getTime())) {
    return { active: false, from: null, to: null, label: 'Chưa mở ca hiện tại' }
  }
  return {
    active: true,
    from: openedAt,
    to: new Date(),
    label: `${shift.shift_name || 'Ca hiện tại'} · từ ${openedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
  }
}

export default function QuickCounterDesk({ rows, actions, onNew, shiftState }) {
  const [search,setSearch]=useState('')
  const [showFinished,setShowFinished]=useState(false)
  const shiftWindow=currentShiftWindow(shiftState)
  const isServedUnpaid=order=>['COMPLETED','PICKED_UP'].includes(order.status) && order.paymentStatus!=='PAID' && !order.tableClearedAt
  const isFinishedPaid=order=>['COMPLETED','PICKED_UP'].includes(order.status) && order.paymentStatus==='PAID'
  const needsTableClear=order=>isFinishedPaid(order) && Boolean(order.tableId) && !order.tableClearedAt
  const groups=[
    {title:'1 · Nhận đơn',matches:order=>order.status==='PENDING',color:'#eff6ff'},
    {title:'2 · Chuẩn bị món',matches:order=>['CONFIRMED','PREPARING'].includes(order.status),color:'#fffbeb'},
    {title:'3 · Thanh toán & trả món',matches:order=>order.status==='READY',color:'#f0fdf4'},
    {title:'4 · Đã trả món · chưa thanh toán',matches:isServedUnpaid,color:'#fff1f2'},
    {title:'5 · Đã thanh toán · chờ dọn bàn',matches:needsTableClear,color:'#f0fdfa'},
    ...(showFinished?[{title:'6 · Đã hoàn tất trong ca',matches:order=>isFinishedPaid(order) && !needsTableClear(order),color:'#f8fafc'}]:[]),
  ]
  const active=rows.filter(r=>['PENDING','CONFIRMED','PREPARING','READY'].includes(r.status))
  const servedUnpaid=rows.filter(isServedUnpaid)
  const waitingTableClear=rows.filter(needsTableClear)
  const finished=rows.filter(r=>{
    if(!shiftWindow.active || !isFinishedPaid(r)) return false
    const completedAt=new Date(r.completedAt || r.updatedAt || r.createdAt)
    return !Number.isNaN(completedAt.getTime()) && completedAt>=shiftWindow.from && completedAt<shiftWindow.to
  })
  const filtered=[...new Map([...active,...servedUnpaid,...waitingTableClear,...(showFinished?finished:[])].map(order=>[order.id,order])).values()].filter(r=>`${r.orderNumber} ${r.orderCode} ${r.tableName} ${r.customerName}`.toLowerCase().includes(search.toLowerCase()))
  return <Box sx={{p:2}}>
    <Stack direction={{xs:'column',sm:'row'}} gap={2} alignItems={{sm:'center'}} sx={{mb:2}}><Button variant="contained" size="large" onClick={onNew}>+ Tạo đơn · chọn món & bàn</Button><TextField size="small" label="Tìm bàn / số đơn / khách" value={search} onChange={e=>setSearch(e.target.value)} sx={{flex:1}}/><Chip color={servedUnpaid.length?'error':'default'} label={`${active.length} đang phục vụ · ${servedUnpaid.length} đã trả món chưa thu`} /><Chip color={waitingTableClear.length?'warning':'default'} label={`${waitingTableClear.length} chờ dọn bàn`} /><FormControlLabel control={<Checkbox checked={showFinished} onChange={event=>setShowFinished(event.target.checked)} />} label={`Hiện đơn đã hoàn tất trong ca (${finished.length})`} /><Chip color={shiftWindow.active?'primary':'warning'} variant="outlined" label={shiftWindow.label} /></Stack>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(2,minmax(0,1fr))',xl:`repeat(${groups.length},minmax(0,1fr))`},gap:2}}>{groups.map(group=><Box key={group.title} sx={{bgcolor:group.color,p:1.5,borderRadius:2,border:group.title.includes('chưa thanh toán')?'2px solid #ef4444':'none'}}><Typography fontWeight={800} color={group.title.includes('chưa thanh toán')?'error.main':'inherit'} sx={{mb:1.5}}>{group.title} · {filtered.filter(group.matches).length}</Typography>{filtered.filter(group.matches).map(order=>{const unpaidServed=isServedUnpaid(order);return <Paper key={order.id} sx={{p:1.5,mb:1.5,borderRadius:2,border:unpaidServed?'2px solid #ef4444':'1px solid transparent',bgcolor:unpaidServed?'#fff7f7':'background.paper'}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>{order.tableName || order.customerTableTag || 'Mang đi'} · #{order.orderNumber ?? order.dailySeq}</Typography><Chip size="small" color={unpaidServed?'error':order.paymentStatus==='PAID'?'success':'warning'} label={unpaidServed?'ĐÃ TRẢ MÓN · CHƯA THU':order.paymentStatus==='PAID'?'Đã thu':'Chưa thu'} /></Stack>
      <Typography variant="body2" color="text.secondary">{(order.items||[]).map(i=>`${i.quantity} × ${i.modelName || i.name || ''}`).join(' · ')}</Typography>
      <Typography sx={{my:1}} fontWeight={800}>{Math.max(0,Number(order.totalAmount||0)-Number(order.discountAmount||0)).toLocaleString('vi-VN')}đ · {order.paymentMethod==='BANK_QR'?'QR / chuyển khoản':order.paymentMethod==='SPLIT'?'Tiền mặt + QR':order.paymentMethod==='PAY_LATER'?'Trả sau':'Tiền mặt'}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}><Button variant="outlined" onClick={()=>actions.detail(order)}>Chi tiết</Button>
        <Button variant="outlined" color="warning" onClick={()=>actions.printAlert(order)}>In báo đơn</Button>
        {order.status==='PENDING' && <Button variant="contained" onClick={()=>actions.receive(order)}>Xác nhận</Button>}
        {order.status==='CONFIRMED' && <Button variant="contained" onClick={()=>actions.prepare(order)}>Bắt đầu làm</Button>}
        {order.status==='PREPARING' && <Button variant="contained" onClick={()=>actions.ready(order)}>Món đã sẵn sàng</Button>}
        {order.paymentStatus!=='PAID' && ['CONFIRMED','PREPARING','READY','COMPLETED','PICKED_UP'].includes(order.status) && <><Button variant={unpaidServed?'contained':'text'} color={unpaidServed?'error':'primary'} onClick={()=>actions.markPaid(order)}>Đã nhận tiền</Button>{order.paymentMethod==='BANK_QR' && <Button onClick={()=>actions.payQr(order)}>Hiện QR</Button>}</>}
        {order.status==='READY' && <Button variant="outlined" onClick={()=>actions.printTag(order)}>In phiếu</Button>}
        {!['COMPLETED','PICKED_UP','CANCELLED'].includes(order.status) && <Button variant="contained" color="success" onClick={()=>actions.complete(order)}>Hoàn tất & trả món</Button>}
        {needsTableClear(order) && <Button variant="contained" color="warning" onClick={()=>actions.clearTable(order)}>Dọn đơn khỏi bàn</Button>}
      </Stack>
    </Paper>})}</Box>)}</Box>
  </Box>
}
