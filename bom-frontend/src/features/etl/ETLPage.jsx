import React, { useState, useEffect } from 'react'
import { Box, Typography, Button, IconButton, CircularProgress, Chip, Alert, Paper, Divider } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import TableChartIcon from '@mui/icons-material/TableChart'
import StorageIcon from '@mui/icons-material/Storage'
import { runEtlQuery } from '../../api/etlApi'
import { useAppContext } from '../../context/AppContext'
import * as XLSX from 'xlsx'

const MONO = '"Roboto Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'

// ─── QUERY TEMPLATES (Using exact @Column(name) from JPA files) ────────────────
const TEMPLATES = [
  {
    label: 'Material + Active BOM Join',
    sql: `SELECT m.material_code, m.material_name, b.bom_name, b.status, b.created_at
FROM material m
JOIN bom b ON b.id = b.id -- Adjust join logic based on your model_id relationship
WHERE m.tenant_id = :tenant_id 
  AND m.company_id = :company_id 
  AND b.status = 'ACTIVE'
ORDER BY m.material_code ASC`,
    params: '{}',
  },
  {
    label: 'Inventory Status',
    sql: `SELECT m.material_code, i.batch_no, i.quantity_on_hand, i.quantity_locked 
FROM inventory i 
JOIN material m ON i.material_id = m.id 
WHERE i.tenant_id = :tenant_id AND i.company_id = :company_id`,
    params: '{}',
  },
  {
    label: 'Order Header List',
    sql: `SELECT order_no, status, total_amount, order_date 
FROM order_header 
WHERE tenant_id = :tenant_id AND company_id = :company_id 
ORDER BY created_at DESC`,
    params: '{}',
  }
]

export default function ETLPage() {
  const { tenantId, companyId } = useAppContext()
  const [sql, setSql] = useState(TEMPLATES[0].sql)
  const [params, setParams] = useState(TEMPLATES[0].params)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('table')

  // Keep the JSON parameters in sync with the AppContext (Tenant/Company)
  useEffect(() => {
    setParams(prev => {
      try {
        const current = JSON.parse(prev || '{}')
        return JSON.stringify({
          ...current,
          tenant_id: tenantId || '',
          company_id: companyId || ''
        }, null, 2)
      } catch (e) {
        return JSON.stringify({ tenant_id: tenantId, company_id: companyId }, null, 2)
      }
    })
  }, [tenantId, companyId])

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      let parsedParams = JSON.parse(params || '{}')
      
      // FORCE INJECTION: Ensure context is always passed to the backend
      const finalParams = {
        ...parsedParams,
        tenant_id: tenantId,
        company_id: companyId
      }

      const data = await runEtlQuery(sql, finalParams)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Query Execution Failed')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!result?.rows.length) return
    const ws = XLSX.utils.json_to_sheet(result.rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.writeFile(wb, `etl_export_${Date.now()}.xlsx`)
  }

  return (
    <Box sx={{ 
      display: 'flex', flexDirection: 'column', 
      height: 'calc(100vh - 64px)', // Adjust 64px if your header height differs
      overflow: 'hidden', bgcolor: '#f4f6f8' 
    }}>
      
      {/* 1. Header Bar */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>ETL Console</Typography>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Chip label={`Tenant: ${tenantId?.split('-')[0]}`} size="small" variant="outlined" />
          <Chip label={`Company: ${companyId?.split('-')[0]}`} size="small" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {TEMPLATES.map(t => (
            <Button key={t.label} size="small" onClick={() => { setSql(t.sql); setError(null); }} sx={{ textTransform: 'none' }}>
              {t.label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* 2. Main Editor Area (Responsive Grid) */}
      <Box sx={{ display: 'flex', flex: '0 0 auto', p: 2, gap: 2, borderBottom: '1px solid #ddd' }}>
        <Box sx={{ flex: 2 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, display: 'block' }}>SQL EDITOR</Typography>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '180px', padding: '12px', borderRadius: '4px',
              border: '1px solid #ccc', fontFamily: MONO, fontSize: '13px', outline: 'none'
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, display: 'block' }}>PARAMS (JSON)</Typography>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '180px', padding: '12px', borderRadius: '4px',
              border: '1px solid #ccc', fontFamily: MONO, fontSize: '12px', outline: 'none'
            }}
          />
        </Box>
      </Box>

      {/* 3. Action & Results Area */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', bgcolor: '#fff' }}>
        <Button 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} 
          onClick={handleRun} 
          disabled={loading}
          sx={{ borderRadius: '20px', px: 4 }}
        >
          Run
        </Button>
        {result && <Button startIcon={<DownloadIcon />} onClick={handleExport}>Export Excel</Button>}
        <IconButton onClick={() => { setSql(''); setResult(null); }} size="small"><DeleteSweepIcon /></IconButton>
        {error && <Alert severity="error" sx={{ py: 0, flexGrow: 1 }}>{error}</Alert>}
      </Box>

      {/* 4. Scrollable Table Results */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#fff' }}>
        {result ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9', zIndex: 1 }}>
              <tr>
                {result.columns.map(col => (
                  <th key={col} style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #ddd', fontWeight: 600 }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  {result.columns.map(col => (
                    <td key={col} style={{ padding: '10px 12px' }}>{String(row[col] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, color: '#ccc' }}>
            <TableChartIcon sx={{ fontSize: 60, mb: 1 }} />
            <Typography>Execute a SELECT query to see results</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}