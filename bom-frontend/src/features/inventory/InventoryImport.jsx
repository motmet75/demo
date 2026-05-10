import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { importInventory } from '../../api/inventoryApi'

const XLSX_HEADERS = [
  'material_code','warehouse_code','batch_no','quantity_on_hand','quantity_total',
  'quantity_reserved','quantity_locked','contract_code','unit','unit_price','currency',
  'hs_code','origin_type','origin_country','xform_no','cds_no','purchase_no',
  'order_to_deduction','material_quota','material_quota_percentage','user_name',
  'xform_date','purchase_date_time','cds_date_time','production_date_time','expiration_date_time',
  'visible','approved','locked'
]

// Numeric columns that may contain thousand-separator commas (e.g. "5,919.51")
const NUMERIC_COLS = new Set([
  'quantity_on_hand','quantity_total','quantity_reserved','quantity_locked',
  'unit_price','order_to_deduction','material_quota','material_quota_percentage'
])

function cleanNumeric(val) {
  if (val === null || val === undefined || val === '') return val
  // Remove thousand separators then parse; return original string if not numeric
  const cleaned = String(val).replace(/,/g, '')
  const n = Number(cleaned)
  return isNaN(n) ? val : cleaned
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([XLSX_HEADERS])

  // Style header row width hints
  ws['!cols'] = XLSX_HEADERS.map(() => ({ wch: 20 }))

  XLSX.utils.book_append_sheet(wb, ws, 'inventory_import')
  XLSX.writeFile(wb, 'inventory_import_template.xlsx')
}

/**
 * Parse an XLSX file into an array of plain row objects.
 * Numeric columns have thousand-separator commas stripped.
 */
async function parseXlsx(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  // raw: true keeps cell values as-is so we can clean commas ourselves
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

  return rows.map(row => {
    const cleaned = {}
    for (const [k, v] of Object.entries(row)) {
      cleaned[k] = NUMERIC_COLS.has(k) ? cleanNumeric(v) : v
    }
    return cleaned
  })
}

export default function InventoryImport({ onImportComplete }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [parseError, setParseError] = useState(null)

  async function handleFileChange(e) {
    const f = e.target.files[0]
    setFile(f || null)
    setResult(null)
    setParseError(null)
    setPreview([])
    if (!f) return
    try {
      const rows = await parseXlsx(f)
      setPreview(rows.slice(0, 5))
    } catch (err) {
      setParseError('Could not read file: ' + (err.message || 'unknown error'))
    }
  }

  async function handleUpload() {
    if (!file || uploading) return
    setUploading(true)
    setResult(null)
    try {
      const res = await importInventory(file)
      setResult(res)
      if (res.success && onImportComplete) {
        setTimeout(() => onImportComplete(), 1500)
      }
    } catch (err) {
      setResult({ success: false, message: err.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const CELL = { padding: '3px 8px', border: '1px solid #e0e0e0', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const TH = { ...CELL, background: '#f5f5f5', fontWeight: 600 }
  const PREVIEW_COLS = ['material_code','warehouse_code','batch_no','quantity_on_hand','unit_price']

  return (
    <div style={{ marginBottom: 20 }}>
      <h3>Import Inventory (XLSX)</h3>

      <div style={{ marginBottom: 8, fontSize: 12, color: '#555' }}>
        Required columns: <code>material_code, warehouse_code, batch_no, quantity_on_hand</code>.
        Optional: <code>quantity_total</code> (defaults to quantity_on_hand if omitted).
        Numeric values may use thousand-separator commas — they are cleaned automatically.{' '}
        <button type="button" onClick={downloadTemplate} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
          ⬇ Download Template (.xlsx)
        </button>
      </div>

      {/* File picker */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ fontSize: 13 }} />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            fontSize: 13, padding: '3px 18px',
            background: file && !uploading ? '#1976d2' : '#aaa',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: file && !uploading ? 'pointer' : 'not-allowed'
          }}
        >
          {uploading ? 'Uploading…' : 'Upload XLSX'}
        </button>
      </div>

      {parseError && (
        <div style={{ color: '#c62828', fontSize: 12, marginBottom: 6 }}>⚠ {parseError}</div>
      )}

      {/* 5-row preview */}
      {preview.length > 0 && !result && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Preview (first 5 rows, key columns):</div>
          <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 4 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {PREVIEW_COLS.map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                    {PREVIEW_COLS.map(h => <td key={h} style={CELL}>{row[h] ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {file && !result && (
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Selected: <strong>{file.name}</strong>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 8, border: '1px solid #eee', padding: 10, background: '#fafafa', borderRadius: 4 }}>
          <div><strong>Success:</strong> {String(result.success)}</div>
          {result.message && <div><strong>Message:</strong> {result.message}</div>}
          <div><strong>Created:</strong> {result.created || 0}</div>
          <div><strong>Updated:</strong> {result.updated || 0}</div>

          {result.missingMaterials && result.missingMaterials.length > 0 && (
            <div style={{ marginTop: 8, color: 'red' }}>
              <strong>Missing Materials (not found in system):</strong>
              <ul>{result.missingMaterials.map((code, i) => <li key={i}>{code}</li>)}</ul>
            </div>
          )}

          {result.missingWarehouses && result.missingWarehouses.length > 0 && (
            <div style={{ marginTop: 8, color: 'red' }}>
              <strong>Missing Warehouses (not found in system):</strong>
              <ul>{result.missingWarehouses.map((code, i) => <li key={i}>{code}</li>)}</ul>
            </div>
          )}

          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Errors:</strong>
              <ul>{result.errors.map((er, i) => <li key={i}><pre style={{ margin: 0 }}>{er}</pre></li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}