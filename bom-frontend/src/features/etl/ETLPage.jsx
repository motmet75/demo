import React, { useState, useEffect } from 'react'
import { Typography, Button, IconButton, CircularProgress, Chip, Alert, Tooltip, Collapse } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import StorageIcon from '@mui/icons-material/Storage'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { runEtlQuery } from '../../api/etlApi'
import { useAppContext } from '../../context/AppContext'
import * as XLSX from 'xlsx'

const MONO = '"Roboto Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'

// ─── Skeleton placeholder data ────────────────────────────────────────────────
const SKELETON_COLS = ['id', 'code', 'name', 'type', 'unit', 'status', 'created_at', 'updated_at']
const SKELETON_WIDTHS = [32, 72, 120, 60, 40, 55, 90, 90, 48, 80, 110, 50, 65, 95, 42, 78]
const SKELETON_ROWS = Array.from({ length: 22 })

// ─── QUERY TEMPLATES ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: 'Material + Active BOM Join',
    sql: `SELECT m.material_code, m.material_name, b.bom_name, b.status, b.created_at
FROM material m
JOIN bom b ON b.id = b.id
WHERE m.tenant_id = :tenant_id 
  AND m.company_id = :company_id 
  AND b.status = 'ACTIVE'
ORDER BY m.material_code ASC`,
  },
  {
    label: 'Materials',
    sql: `SELECT id, material_code, material_name, unit, material_type, price
FROM material
WHERE tenant_id = :tenant_id AND company_id = :company_id
ORDER BY material_code`,
  },
  {
    label: 'BOM Summary',
    sql: `SELECT id, bom_name, status, created_at
FROM bom
WHERE tenant_id = :tenant_id AND company_id = :company_id
ORDER BY created_at DESC`,
  },
  {
    label: 'Inventory Status',
    sql: `SELECT m.material_code, i.batch_no, i.quantity_on_hand, i.quantity_locked
FROM inventory i
JOIN material m ON i.material_id = m.id
WHERE i.tenant_id = :tenant_id AND i.company_id = :company_id`,
  },
  {
    label: 'Orders',
    sql: `SELECT id, order_number, status, production_batch_id, delivery_date_time
FROM order_header
WHERE tenant_id = :tenant_id AND company_id = :company_id
ORDER BY delivery_date_time DESC`,
  },
]

export default function ETLPage() {
  const { tenantId, companyId } = useAppContext()
  const [sql, setSql] = useState(TEMPLATES[0].sql)
  const [params, setParams] = useState('{}')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [showParams, setShowParams] = useState(false)

  useEffect(() => {
    setParams(prev => {
      try {
        const current = JSON.parse(prev || '{}')
        return JSON.stringify({ ...current, tenant_id: tenantId || '', company_id: companyId || '' }, null, 2)
      } catch {
        return JSON.stringify({ tenant_id: tenantId, company_id: companyId }, null, 2)
      }
    })
  }, [tenantId, companyId])

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const parsedParams = JSON.parse(params || '{}')
      const finalParams = { ...parsedParams, tenant_id: tenantId, company_id: companyId }
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
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `etl_export_${Date.now()}.xlsx`)
  }

  const applyTemplate = (t, idx) => {
    setSql(t.sql)
    setParams(JSON.stringify({ tenant_id: tenantId, company_id: companyId }, null, 2))
    setError(null)
    setActiveIdx(idx)
  }

  const displayCols = result ? result.columns : SKELETON_COLS

  return (
    // ── Root: same pattern as MaterialGrid ──────────────────────────────────
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: '#f0f2f5' }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{
        width: 210,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#1a2035',
        borderRight: '1px solid #252d45',
        overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #252d45', display: 'flex', alignItems: 'center', gap: 8 }}>
          <StorageIcon style={{ fontSize: 17, color: '#60a5fa' }} />
          <span style={{ fontWeight: 800, fontSize: 13, color: '#e2e8f0', letterSpacing: '0.06em' }}>ETL CONSOLE</span>
        </div>

        {/* Context chips */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #252d45', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Tooltip title={tenantId || ''} placement="right">
            <Chip
              label={`Tenant: ${tenantId?.substring(0, 8) || '—'}`}
              size="small"
              style={{ fontSize: 10, height: 22, background: '#1e3a5f', color: '#93c5fd', border: '1px solid #2d5080', cursor: 'default' }}
            />
          </Tooltip>
          <Tooltip title={companyId || ''} placement="right">
            <Chip
              label={`Company: ${companyId?.substring(0, 8) || '—'}`}
              size="small"
              style={{ fontSize: 10, height: 22, background: '#2d1f4e', color: '#c4b5fd', border: '1px solid #4a3580', cursor: 'default' }}
            />
          </Tooltip>
        </div>

        {/* Templates label */}
        <div style={{ padding: '12px 16px 4px', fontSize: 10, fontWeight: 700, color: '#3d4f6b', letterSpacing: '0.1em' }}>
          TEMPLATES
        </div>

        {/* Template list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {TEMPLATES.map((t, idx) => (
            <div
              key={t.label}
              onClick={() => applyTemplate(t, idx)}
              style={{
                padding: '8px 12px',
                marginBottom: 4,
                borderRadius: 6,
                cursor: 'pointer',
                borderLeft: activeIdx === idx ? '3px solid #3b82f6' : '3px solid transparent',
                background: activeIdx === idx ? 'rgba(59,130,246,0.12)' : 'transparent',
                transition: 'all 0.12s',
              }}
              onMouseOver={e => { if (activeIdx !== idx) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseOut={e => { if (activeIdx !== idx) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                fontSize: 12,
                lineHeight: 1.45,
                color: activeIdx === idx ? '#93c5fd' : '#7a8faa',
                fontWeight: activeIdx === idx ? 600 : 400,
              }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT MAIN AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Editor panel ── */}
        <div style={{ background: '#fff', borderBottom: '2px solid #e8ecf0', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px 10px' }}>

            {/* Label + params toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em' }}>SQL EDITOR</span>
              <Button
                size="small"
                variant={showParams ? 'contained' : 'outlined'}
                startIcon={showParams
                  ? <LockOpenIcon style={{ fontSize: 13 }} />
                  : <LockIcon style={{ fontSize: 13 }} />
                }
                onClick={() => setShowParams(v => !v)}
                style={{
                  textTransform: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  height: 24,
                  padding: '0 10px',
                  borderRadius: 5,
                  minWidth: 0,
                  boxShadow: 'none',
                  ...(showParams
                    ? { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }
                    : { borderColor: '#e2e8f0', color: '#94a3b8' }
                  ),
                }}
              >
                {showParams ? 'Hide Params' : 'Show Params'}
              </Button>
            </div>

            {/* SQL textarea */}
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              spellCheck={false}
              style={{
                width: '100%',
                height: 180,
                padding: '10px 13px',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                fontFamily: MONO,
                fontSize: 13,
                outline: 'none',
                background: '#f8fafc',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.65,
                color: '#1e293b',
              }}
            />

            {/* Action buttons — directly below SQL */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={15} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleRun}
                disabled={loading || !sql.trim()}
                size="small"
                style={{
                  borderRadius: 6, padding: '4px 18px', boxShadow: 'none', fontWeight: 700,
                  textTransform: 'none', fontSize: 13,
                  background: '#2563eb',
                }}
              >
                {loading ? 'Running…' : 'Execute'}
              </Button>

              {result && (
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon style={{ fontSize: 16 }} />}
                  onClick={handleExport}
                  size="small"
                  style={{ borderRadius: 6, textTransform: 'none', borderColor: '#d1d5db', color: '#475569' }}
                >
                  XLSX
                </Button>
              )}

              <Tooltip title="Clear editor & results">
                <IconButton
                  onClick={() => { setSql(''); setResult(null); setError(null) }}
                  size="small"
                  color="error"
                  style={{ marginLeft: 'auto' }}
                >
                  <DeleteSweepIcon style={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </div>

            {error && (
              <Alert severity="error" variant="outlined" style={{ marginTop: 8, padding: '2px 12px', fontSize: 11.5, borderRadius: 6 }}>
                {error}
              </Alert>
            )}
          </div>

          {/* Collapsible Parameters panel */}
          <Collapse in={showParams} timeout={200}>
            <div style={{
              margin: '0 16px 14px',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #fde68a',
              background: '#fffbeb',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <LockOpenIcon style={{ fontSize: 13, color: '#d97706' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', letterSpacing: '0.1em' }}>
                  PARAMETERS (JSON) — SENSITIVE
                </span>
              </div>
              <textarea
                value={params}
                onChange={e => setParams(e.target.value)}
                spellCheck={false}
                style={{
                  width: '100%',
                  height: 100,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #fcd34d',
                  fontFamily: MONO,
                  fontSize: 12,
                  outline: 'none',
                  background: '#fff',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.65,
                  color: '#1e293b',
                }}
              />
            </div>
          </Collapse>
        </div>

        {/* ── Results: fills all remaining height, both-axis scroll ── */}
        <div style={{ flex: 1, overflow: 'auto', background: '#fff', position: 'relative' }}>

          {/* Sticky meta bar */}
          <div style={{
            position: 'sticky',
            top: 0,
            left: 0,
            zIndex: 4,
            background: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            padding: '5px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: 'max-content',
            minWidth: '100%',
            boxSizing: 'border-box',
          }}>
            {result ? (
              <>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  {result.rows.length.toLocaleString()} row{result.rows.length !== 1 ? 's' : ''}
                </span>
                <span style={{ width: 1, height: 12, background: '#cbd5e1', display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  {result.columns.length} column{result.columns.length !== 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                {loading ? 'Executing query…' : 'Execute a query to populate this table'}
              </span>
            )}
          </div>

          {/* Table — always present */}
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                {displayCols.map(col => (
                  <th key={col} style={{
                    position: 'sticky',
                    top: 31,
                    zIndex: 3,
                    textAlign: 'left',
                    padding: '10px 16px',
                    borderBottom: '2px solid #e2e8f0',
                    fontWeight: 700,
                    fontSize: 12,
                    color: result ? '#374151' : '#c8d6e5',
                    background: '#f8fafc',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result ? (
                result.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {result.columns.map(col => (
                      <td key={col} style={{
                        padding: '8px 16px',
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        maxWidth: 340,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {String(row[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                SKELETON_ROWS.map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    {SKELETON_COLS.map((col, j) => (
                      <td key={col} style={{ padding: '9px 16px' }}>
                        <div style={{
                          height: 12,
                          borderRadius: 3,
                          background: i % 2 === 0 ? '#f1f5f9' : '#f8fafc',
                          width: SKELETON_WIDTHS[(i * SKELETON_COLS.length + j) % SKELETON_WIDTHS.length],
                          animation: loading
                            ? `etl-shimmer 1.4s ease-in-out ${(i * 0.05).toFixed(2)}s infinite`
                            : 'none',
                        }} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Shimmer keyframes injected once */}
          <style>{`
            @keyframes etl-shimmer {
              0%, 100% { opacity: 0.4; }
              50%       { opacity: 1;   }
            }
          `}</style>
        </div>

      </div>
    </div>
  )
}