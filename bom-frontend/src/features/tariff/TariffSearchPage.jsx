import React, { useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { searchTariff } from '../../api/tariffSearchApi'

const statusLabel = {
  INVALID_QUERY: 'Nhập ít nhất 2 ký tự',
  NOT_CONFIGURED: 'Chưa cấu hình kết nối biểu thuế',
  FORBIDDEN: 'Token hoặc quyền không hợp lệ',
  UNAVAILABLE: 'Không kết nối được Portal',
  UPSTREAM_ERROR: 'Portal trả lỗi',
  BAD_URL: 'URL Portal không hợp lệ',
  INTERRUPTED: 'Kết nối bị ngắt'
}

/**
 * Lightweight replacement for the legacy Vaadin /app/taxitemsearch screen:
 * calls Portal's small dedicated tariff-bridge endpoint (its own 4-connection
 * read-only pool), not the full Vaadin TariffView. Reference data only.
 */
export default function TariffSearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const runSearch = async () => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setError('Nhập ít nhất 2 ký tự (mã HS hoặc tên hàng) để tìm kiếm.')
      setResult(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await searchTariff(trimmed, 30)
      if (data?.status && data.status !== 'OK') {
        setResult(null)
        setError(data.message || statusLabel[data.status] || 'Không tìm kiếm được.')
      } else {
        setResult(data)
      }
    } catch (e) {
      setResult(null)
      setError(e.message || 'Không tìm kiếm được biểu thuế.')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') runSearch() }

  return <Box sx={{ p: 2 }}>
    <Typography variant="h5" fontWeight={800} gutterBottom>Tra cứu mã HS / Biểu thuế</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Tìm theo mã HS (8 số, hoặc một phần đầu) hoặc theo tên hàng tiếng Việt.
      Dữ liệu tham khảo từ Portal (bảng biểu thuế); không tự coi là thuế suất đã xác minh hiệu lực.
    </Typography>
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center">
          <TextField
            fullWidth size="small" label="Mã HS hoặc tên hàng"
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Ví dụ: 8407 hoặc động cơ"
          />
          <Button variant="contained" startIcon={<SearchIcon />} onClick={runSearch} disabled={loading}>
            Tìm kiếm
          </Button>
          {loading && <CircularProgress size={24} />}
        </Stack>
      </CardContent>
    </Card>

    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

    {result && <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {result.count} kết quả cho "{result.query}"
        {result.count >= 30 && ' (giới hạn 30, nhập thêm ký tự để lọc bớt)'}
      </Typography>
      <TableContainer component={Card} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã HS</TableCell>
              <TableCell>Tên hàng</TableCell>
              <TableCell align="right">MFN (%)</TableCell>
              <TableCell align="right">Thường (%)</TableCell>
              <TableCell align="right">VAT (%)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(result.results || []).map((row, i) => (
              <TableRow key={row.hsCode + '-' + i} hover>
                <TableCell>{row.hsCode || '—'}</TableCell>
                <TableCell>{row.description || '—'}</TableCell>
                <TableCell align="right">{row.mfn || '—'}</TableCell>
                <TableCell align="right">{row.normalImport || '—'}</TableCell>
                <TableCell align="right">{row.vat || '—'}</TableCell>
              </TableRow>
            ))}
            {!result.results?.length && (
              <TableRow><TableCell colSpan={5} align="center">Không có kết quả.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>}
  </Box>
}
