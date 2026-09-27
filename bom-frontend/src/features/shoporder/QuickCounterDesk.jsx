import React, { useState } from 'react'
import { Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material'

function vietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

function currentShiftWindow(shiftState) {
  const now = new Date()
  const parts = vietnamDateParts(now)
  const today = shiftState?.shiftDate || `${parts.year}-${parts.month}-${parts.day}`
  const latestToday = (shiftState?.history || []).find(shift => shift.shift_date === today)
  const shift = shiftState?.active || latestToday
  const shiftNumber = Number(shift?.shift_number || shiftState?.suggestedShift) || (Number(parts.hour) < 14 ? 1 : 2)
  const startHour = shiftNumber === 1 ? 6 : 14
  const endHour = shiftNumber === 1 ? 14 : 22
  return {
    from: new Date(`${shift?.shift_date || today}T${String(startHour).padStart(2, '0')}:00:00+07:00`),
    to: new Date(`${shift?.shift_date || today}T${String(endHour).padStart(2, '0')}:00:00+07:00`),
    label: shift?.shift_name || `Ca ${shiftNumber} · ${String(startHour).padStart(2, '0')}:00–${String(endHour).padStart(2, '0')}:00`,
  }
}

export default function QuickCounterDesk({ rows, actions, onNew, shiftState }) {
  const [search,setSearch]=useState('')
  const shiftWindow=currentShiftWindow(shiftState)
  const groups=[{title:'1 · Nhận đơn',statuses:['PENDING'],color:'#eff6ff'}, {title:'2 · Chuẩn bị món',statuses:['CONFIRMED','PREPARING'],color:'#fffbeb'}, {title:'3 · Thanh toán & trả món',statuses:['READY'],color:'#f0fdf4'}, {title:'4 · Đã hoàn tất trong ca',statuses:['COMPLETED'],color:'#f8fafc'}]
  const active=rows.filter(r=>['PENDING','CONFIRMED','PREPARING','READY'].includes(r.status))
  const completed=rows.filter(r=>{
    if(r.status!=='COMPLETED') return false
    const completedAt=new Date(r.completedAt || r.updatedAt || r.createdAt)
    return !Number.isNaN(completedAt.getTime()) && completedAt>=shiftWindow.from && completedAt<shiftWindow.to
  })
  const filtered=[...active,...completed].filter(r=>`${r.orderNumber} ${r.orderCode} ${r.tableName} ${r.customerName}`.toLowerCase().includes(search.toLowerCase()))
  return <Box sx={{p:2}}>
    <Stack direction={{xs:'column',sm:'row'}} gap={2} sx={{mb:2}}><Button variant="contained" size="large" onClick={onNew}>+ Tạo đơn · chọn món & bàn</Button><TextField size="small" label="Tìm bàn / số đơn / khách" value={search} onChange={e=>setSearch(e.target.value)} sx={{flex:1}}/><Chip label={`${active.length} đang phục vụ · ${completed.length} hoàn tất`} /><Chip variant="outlined" label={shiftWindow.label} /></Stack>
    <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(2,minmax(0,1fr))',xl:'repeat(4,minmax(0,1fr))'},gap:2}}>{groups.map(group=><Box key={group.title} sx={{bgcolor:group.color,p:1.5,borderRadius:2}}><Typography fontWeight={800} sx={{mb:1.5}}>{group.title} · {filtered.filter(r=>group.statuses.includes(r.status)).length}</Typography>{filtered.filter(r=>group.statuses.includes(r.status)).map(order=><Paper key={order.id} sx={{p:1.5,mb:1.5,borderRadius:2}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={800}>{order.tableName || order.customerTableTag || 'Mang đi'} · #{order.orderNumber ?? order.dailySeq}</Typography><Chip size="small" color={order.paymentStatus==='PAID'?'success':'warning'} label={order.paymentStatus==='PAID'?'Đã thu':'Chưa thu'} /></Stack>
      <Typography variant="body2" color="text.secondary">{(order.items||[]).map(i=>`${i.quantity} × ${i.modelName || i.name || ''}`).join(' · ')}</Typography>
      <Typography sx={{my:1}} fontWeight={800}>{Math.max(0,Number(order.totalAmount||0)-Number(order.discountAmount||0)).toLocaleString('vi-VN')}đ · {order.paymentMethod==='BANK_QR'?'QR / chuyển khoản':order.paymentMethod==='SPLIT'?'Tiền mặt + QR':'Tiền mặt'}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}><Button variant="outlined" onClick={()=>actions.detail(order)}>Chi tiết</Button>
        {order.status==='PENDING' && <Button variant="contained" onClick={()=>actions.receive(order)}>Xác nhận</Button>}
        {order.status==='CONFIRMED' && <Button variant="contained" onClick={()=>actions.prepare(order)}>Bắt đầu làm</Button>}
        {order.status==='PREPARING' && <Button variant="contained" onClick={()=>actions.ready(order)}>Món đã sẵn sàng</Button>}
        {order.paymentStatus!=='PAID' && ['CONFIRMED','PREPARING','READY'].includes(order.status) && <><Button onClick={()=>actions.markPaid(order)}>Đã nhận tiền</Button>{order.paymentMethod==='BANK_QR' && <Button onClick={()=>actions.payQr(order)}>Hiện QR</Button>}</>}
        {order.status==='READY' && <><Button variant="outlined" onClick={()=>actions.printTag(order)}>In phiếu</Button><Button variant="contained" color="success" onClick={()=>actions.complete(order)}>{order.paymentStatus==='PAID'?'Hoàn tất / trả món':'Xác nhận đã thu & hoàn tất'}</Button></>}
      </Stack>
    </Paper>)}</Box>)}</Box>
  </Box>
}
