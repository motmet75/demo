import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { createModel, importModels } from '../../api/modelApi'
import ModelEditModal from './ModelEditModal'

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['model_code', 'model_name', 'hs_code', 'co_criteria'],
    ['MOD-001', 'Laptop Model A', '8471.30', 'CTH'],
    ['MOD-002', 'Smartphone Model B', '8517.12', 'RVC40'],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'model_import')
  XLSX.writeFile(wb, 'model_import_template.xlsx')
}

/** Parse an XLSX file into preview rows (client-side, first 50 rows) */
async function parseXlsxPreview(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  // Normalise keys: accept both snake_case and camelCase header variants
  return rows.slice(0, 50).map(r => ({
    model_code:  r['model_code']  ?? r['modelCode']  ?? '',
    model_name:  r['model_name']  ?? r['modelName']  ?? '',
    hs_code:     r['hs_code']     ?? r['hsCode']     ?? '',
    co_criteria: r['co_criteria'] ?? r['coCriteria'] ?? '',
  }))
}

const CELL = { padding: '4px 8px', border: '1px solid #ddd', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const TH = { ...CELL, background: '#f5f5f5', fontWeight: 600 }

export default function ModelImport({ onImportSuccess }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)     // {success, created, errors[], message}
  const [importError, setImportError] = useState(null)
  const [parseError, setParseError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    setFile(f || null)
    setResult(null)
    setImportError(null)
    setParseError(null)
    setPreview([])
    if (!f) return
    try {
      const rows = await parseXlsxPreview(f)
      setPreview(rows)
    } catch (err) {
      setParseError('Could not read file: ' + (err.message || 'unknown error'))
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setImportError(null)
    setParseError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!file || uploading) return
    setUploading(true)
    setResult(null)
    setImportError(null)
    try {
      // Parse XLSX → send as FormData with the original file
      // The backend endpoint receives the .xlsx; update InventoryImportService to use Apache POI
      // or convert here to JSON blob (Option B below) if the backend still expects multipart CSV
      const res = await importModels(file)
      setResult(res)
      if (res && res.success && res.created > 0 && onImportSuccess) {
        onImportSuccess()
      }
    } catch (err) {
      setImportError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleOpenAdd = () => { setAddError(null); setAddOpen(true) }
  const handleCloseAdd = () => { if (adding) return; setAddOpen(false); setAddError(null) }

  const handleSaveAdd = async (payload) => {
    if (adding) return
    setAddError(null)
    setAdding(true)
    try {
      const createPayload = { ...payload }
      if (createPayload.id) delete createPayload.id
      const res = await createModel(createPayload)
      alert('Model created: ' + (res && (res.modelName || res.modelCode) ? (res.modelName || res.modelCode) : ''))
      setAddOpen(false)
      if (onImportSuccess) onImportSuccess()
      return res
    } catch (err) {
      setAddError(err.message || 'Create failed')
      throw err
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 8 }}>Import Models (XLSX)</h3>

      {/* Template + Add */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ fontSize: 12, padding: '3px 12px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer' }}
        >
          ⬇ Download XLSX Template
        </button>
        <span style={{ fontSize: 11, color: '#888' }}>Columns: model_code, model_name, hs_code, co_criteria</span>
        <button type="button" onClick={handleOpenAdd} disabled={adding} style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 12px' }}>
          {adding ? 'Adding…' : '+ Add Model'}
        </button>
      </div>

      {/* File picker */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{ fontSize: 13 }}
        />
        {file && (
          <button type="button" onClick={handleClearFile} style={{ fontSize: 11, color: '#999', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
            clear
          </button>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ fontSize: 13, padding: '3px 18px', background: file && !uploading ? '#1976d2' : '#aaa', color: '#fff', border: 'none', borderRadius: 4, cursor: file && !uploading ? 'pointer' : 'not-allowed' }}
        >
          {uploading ? 'Uploading…' : 'Upload XLSX'}
        </button>
      </div>

      {parseError && (
        <div style={{ color: '#c62828', fontSize: 12, marginBottom: 6 }}>⚠ {parseError}</div>
      )}

      {/* Preview table */}
      {preview.length > 0 && !result && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
            Preview: {preview.length} data row{preview.length !== 1 ? 's' : ''} detected
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 220, border: '1px solid #e0e0e0', borderRadius: 4 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={TH}>#</th>
                  <th style={TH}>model_code</th>
                  <th style={TH}>model_name</th>
                  <th style={TH}>hs_code</th>
                  <th style={TH}>co_criteria</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={CELL}>{i + 1}</td>
                    <td style={CELL}>{row.model_code}</td>
                    <td style={CELL}>{row.model_name}</td>
                    <td style={CELL}>{row.hs_code}</td>
                    <td style={CELL}>{row.co_criteria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length === 50 && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Showing first 50 rows.</div>
          )}
        </div>
      )}

      {/* Upload result */}
      {result && (
        <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 4, border: `1px solid ${result.success ? '#a5d6a7' : '#ef9a9a'}`, background: result.success ? '#f1f8e9' : '#ffebee' }}>
          <div style={{ fontWeight: 600, color: result.success ? '#388e3c' : '#c62828', marginBottom: 4 }}>
            {result.success
              ? `✔ Import complete: ${result.created} model${result.created !== 1 ? 's' : ''} created`
              : `✖ Import failed: ${result.message}`}
          </div>
          {result.errors && result.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#b71c1c', marginBottom: 2 }}>
                {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#c62828' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          <button type="button" onClick={handleClearFile} style={{ marginTop: 8, fontSize: 11, padding: '2px 10px', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      )}

      {/* Upload / general error */}
      {importError && (
        <div style={{ marginTop: 8, color: '#c62828', fontSize: 13, background: '#ffebee', padding: '6px 12px', borderRadius: 4, border: '1px solid #ef9a9a' }}>
          ✖ {importError}
        </div>
      )}

      {/* Add single model modal */}
      <ModelEditModal
        open={addOpen}
        model={null}
        onClose={handleCloseAdd}
        onSave={handleSaveAdd}
        saving={adding}
      />
      {addError && <div style={{ color: 'red', marginTop: 6, fontSize: 12 }}>{addError}</div>}
    </div>
  )
}