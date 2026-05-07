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

// ─── QUERY TEMPLATES (Exact mapping to your JPA @Column names) ────────────────
const TEMPLATES = [
  {
    label: 'Material + Active BOM Join',
    sql: `	SELECT m.material_code, m.material_name, b.bom_name, b.status, b.created_at
	FROM material m
	JOIN bom b ON b.id = b.id -- Adjust join logic based on your model_id relationship
	WHERE m.tenant_id = :tenant_id 
	  AND m.company_id = :company_id 
	  AND b.status = 'ACTIVE'
	ORDER BY m.material_code ASC`,
    params: '{}',
  },
  {
    label: 'Materials',
    sql: `SELECT id, material_code, material_name, unit, material_type, price \nFROM material \nWHERE tenant_id = :tenant_id AND company_id = :company_id \nORDER BY material_code`,
    params: '{}',
  },
  {
    label: 'BOM Summary',
    sql: `SELECT id, bom_name, status, created_at \nFROM bom \nWHERE tenant_id = :tenant_id AND company_id = :company_id \nORDER BY created_at DESC`,
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
    label: 'Orders',
    sql: `SELECT id, order_number, status, production_batch_id, delivery_date_time \nFROM order_header \nWHERE tenant_id = :tenant_id AND company_id = :company_id \nORDER BY delivery_date_time DESC`,
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

  // Force Context injection into the Params box whenever Tenant/Company changes
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
      
      // Inject the context again at execution to be 100% sure
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

  const applyTemplate = (t) => {
    setSql(t.sql)
    setParams(JSON.stringify({ tenant_id: tenantId, company_id: companyId }, null, 2))
    setError(null)
  }

  return (
    <Box sx={{ 
      display: 'flex', flexDirection: 'column', 
      height: 'calc(100vh - 64px)', // Adjust based on your TopBar height
      overflow: 'hidden', bgcolor: '#f8f9fa' 
    }}>
      
      {/* 1. Responsive Header */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>ETL Console</Typography>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Chip label={`T: ${tenantId?.substring(0,8)}`} size="small" color="primary" variant="outlined" />
          <Chip label={`C: ${companyId?.substring(0,8)}`} size="small" color="secondary" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {TEMPLATES.map(t => (
            <Button 
                key={t.label} 
                variant="outlined" 
                size="small" 
                onClick={() => applyTemplate(t)} 
                sx={{ textTransform: 'none', borderRadius: '4px', fontSize: '12px' }}
            >
              {t.label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* 2. Full-Width Responsive Editor Area */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', p: 2, gap: 2, bgcolor: '#fff', borderBottom: '1px solid #ddd' }}>
        <Box sx={{ flex: { xs: '1 1 100%', md: '3 1 0' } }}>
          <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, display: 'block', color: '#666' }}>SQL EDITOR</Typography>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '220px', padding: '15px', borderRadius: '8px',
              border: '1px solid #ced4da', fontFamily: MONO, fontSize: '13px', outline: 'none',
              backgroundColor: '#fcfcfc', resize: 'vertical'
            }}
          />
        </Box>
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 0' } }}>
          <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, display: 'block', color: '#666' }}>PARAMETERS (JSON)</Typography>
          <textarea
            value={params}
            onChange={(e) => setParams(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '220px', padding: '15px', borderRadius: '8px',
              border: '1px solid #ced4da', fontFamily: MONO, fontSize: '12px', outline: 'none',
              backgroundColor: '#fff'
            }}
          />
        </Box>
      </Box>

      {/* 3. Control & Feedback Bar */}
      <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', bgcolor: '#fff' }}>
        <Button 
          variant="contained" 
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />} 
          onClick={handleRun} 
          disabled={loading || !sql.trim()}
          sx={{ borderRadius: '50px', px: 5, boxShadow: 0, fontWeight: 700 }}
        >
          {loading ? 'Executing...' : 'Execute'}
        </Button>
        {result && (
            <Button 
                variant="outlined" 
                startIcon={<DownloadIcon />} 
                onClick={handleExport}
                sx={{ borderRadius: '50px' }}
            >
                Export Excel
            </Button>
        )}
        <IconButton onClick={() => { setSql(''); setResult(null); setError(null); }} size="medium" color="error"><DeleteSweepIcon /></IconButton>
        {error && <Alert severity="error" variant="outlined" sx={{ py: 0, flexGrow: 1, borderRadius: '8px' }}>{error}</Alert>}
      </Box>

      {/* 4. Full-Screen Results Table */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fff', borderTop: '1px solid #eee' }}>
        {result ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 2 }}>
              <tr>
                {result.columns.map(col => (
                  <th key={col} style={{ textAlign: 'left', padding: '14px', borderBottom: '2px solid #dee2e6', fontWeight: 700, color: '#495057' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f3f5', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='#f8f9fa'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='transparent'}>
                  {result.columns.map(col => (
                    <td key={col} style={{ padding: '12px 14px', color: '#343a40' }}>{String(row[col] ?? '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adb5bd' }}>
            <TableChartIcon sx={{ fontSize: 80, mb: 2, opacity: 0.2 }} />
            <Typography variant="h6" sx={{ opacity: 0.5 }}>Query Result Console</Typography>
            <Typography variant="body2" sx={{ opacity: 0.5 }}>Results will appear here in tabular format</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}