import React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import BuildIcon from '@mui/icons-material/Build'
import { useNavigate } from 'react-router-dom'

const groups = [
  ['Máy tính', 'Cài đặt, nâng cấp, vệ sinh và sửa lỗi máy tính'],
  ['Máy in', 'Bảo trì, sửa chữa và xử lý lỗi in'],
  ['Mực in', 'Nạp mực, thay linh kiện và giao tận nơi'],
  ['Thiết bị VP', 'Sửa chữa thiết bị văn phòng khác'],
]

export default function ShopRepairPage() {
  const navigate = useNavigate()
  return <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <BuildIcon color="primary" />
      <Box><Typography variant="h5" fontWeight={800}>Sửa chữa &amp; Bảo trì</Typography><Typography variant="body2" color="text.secondary">Máy tính · Máy in · Mực in · Thiết bị VP</Typography></Box>
    </Box>
    <Grid container spacing={2}>{groups.map(([name, detail]) => <Grid item xs={12} sm={6} md={3} key={name}><Card sx={{ height: '100%' }}><CardContent><Typography variant="h6" fontWeight={800}>{name}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{detail}</Typography><Button size="small" sx={{ mt: 2, textTransform: 'none' }} onClick={() => navigate('/shop-orders')}>Tạo đơn nhanh</Button></CardContent></Card></Grid>)}</Grid>
  </Box>
}
