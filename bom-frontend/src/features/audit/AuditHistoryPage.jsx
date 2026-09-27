import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { apiFetchJson } from '../../api/client'
import { useAppContext } from '../../context/AppContext'
import { useAuth } from '../../context/useAuth'

const labels={INSERT:'Tạo mới',UPDATE:'Cập nhật',DELETE:'Xóa'}
const parse=value=>{try{return typeof value==='string'?JSON.parse(value):value||{}}catch{return {value}}}
const show=value=>value==null?'—':typeof value==='object'?JSON.stringify(value):String(value)
export default function AuditHistoryPage() {
  const {tenantId,companyId}=useAppContext(), {user}=useAuth()
  const [filters,setFilters]=useState({actor:'',table:'',record:'',from:'',to:'',global:false})
  const [applied,setApplied]=useState(filters), [rows,setRows]=useState([]), [before,setBefore]=useState(null), [next,setNext]=useState(null)
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [selected,setSelected]=useState(null)
  const load=useCallback(async()=>{
    if(!tenantId || !companyId)return
    setBusy(true);setError('')
    try {
      const q=new URLSearchParams({actor:applied.actor,table:applied.table,record:applied.record,global:String(applied.global)})
      if(applied.from)q.set('from',new Date(`${applied.from}T00:00:00+07:00`).toISOString())
      if(applied.to)q.set('to',new Date(Date.parse(`${applied.to}T00:00:00+07:00`)+86400000).toISOString())
      if(before)q.set('before',before)
      const {res,data}=await apiFetchJson(`/bom/audit?${q}`)
      if(!res.ok)throw new Error(data?.message || 'Không tải được nhật ký')
      setRows(data.rows || []);setNext(data.nextBefore)
    }catch(e){setError(e.message);setRows([]);setNext(null)}finally{setBusy(false)}
  },[tenantId,companyId,applied,before])
  useEffect(()=>{void load()},[load])
  const old=parse(selected?.before_data), current=parse(selected?.after_data)
  return <Box sx={{p:2}}>
    <Typography variant="h5" sx={{mb:1}}>Nhật ký thay đổi</Typography>
    <Typography variant="body2" sx={{mb:2}}>Người thực hiện, thời gian và giá trị trước / sau khi lưu. Nhật ký bắt đầu từ khi bật tính năng; bản ghi cũ không được gán lại người sửa.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{mb:2}}>
      {[['actor','Tên đăng nhập'],['table','Bảng dữ liệu'],['record','ID bản ghi']].map(([key,label])=><TextField key={key} size="small" label={label} value={filters[key]} onChange={e=>setFilters(v=>({...v,[key]:e.target.value}))}/>)}
      {[['from','Từ ngày'],['to','Đến ngày']].map(([key,label])=><TextField key={key} size="small" type="date" label={label} InputLabelProps={{shrink:true}} value={filters[key]} onChange={e=>setFilters(v=>({...v,[key]:e.target.value}))}/>)}
      {user?.authorities?.includes('ROLE_SUPER_ADMIN') && <FormControlLabel label="Kèm cấu hình toàn hệ thống" control={<Checkbox checked={filters.global} onChange={e=>setFilters(v=>({...v,global:e.target.checked}))}/>} />}
      <Button variant="contained" disabled={busy} onClick={()=>{setBefore(null);setApplied({...filters})}}>Tra cứu</Button>
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <TableContainer><Table size="small"><TableHead><TableRow>{['Thời gian (VN)','Người thực hiện','Thao tác','Bảng / ID','Trường thay đổi',''].map((x,i)=><TableCell key={i}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map(row=><TableRow key={row.id}>
      <TableCell>{new Date(row.occurred_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</TableCell><TableCell>{row.actor}</TableCell><TableCell>{labels[row.operation]||row.operation}</TableCell><TableCell>{row.table_name}<Typography variant="caption" display="block">{row.record_id}</Typography></TableCell><TableCell>{(row.changed_fields||[]).join(', ')}</TableCell><TableCell><Button onClick={()=>setSelected(row)}>Chi tiết</Button></TableCell>
    </TableRow>)}</TableBody></Table></TableContainer>
    {!busy && !rows.length && !error && <Typography sx={{my:2}}>Không có thay đổi phù hợp.</Typography>}
    <Stack direction="row" gap={1} sx={{mt:2}}><Button disabled={busy} onClick={()=>{setBefore(null);if(!before)void load()}}>Mới nhất</Button><Button disabled={busy || !next} onClick={()=>setBefore(next)}>100 bản ghi tiếp</Button></Stack>
    <Dialog open={!!selected} onClose={()=>setSelected(null)} fullWidth maxWidth="lg"><DialogTitle>{selected?.actor} · {labels[selected?.operation]} · {selected?.table_name}</DialogTitle><DialogContent>
      <Typography sx={{mb:2}}>{selected?.request_path || 'Tác vụ nền / cơ sở dữ liệu'}</Typography>
      <Table size="small"><TableHead><TableRow><TableCell>Trường</TableCell><TableCell>Trước</TableCell><TableCell>Sau</TableCell></TableRow></TableHead><TableBody>{(selected?.changed_fields||[]).map(field=><TableRow key={field}><TableCell>{field}</TableCell><TableCell sx={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{show(old[field])}</TableCell><TableCell sx={{overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{show(current[field])}</TableCell></TableRow>)}</TableBody></Table>
    </DialogContent><DialogActions><Button onClick={()=>setSelected(null)}>Đóng</Button></DialogActions></Dialog>
  </Box>
}
