import React, { useRef, useState } from 'react'
import { createModel, importModels } from '../../api/modelApi'
import ModelEditModal from './ModelEditModal'

const MODEL_CSV_TEMPLATE = [
  'model_code,model_name,hs_code,co_criteria',
  'MOD-001,Laptop Model A,8471.30,CTH',
  'MOD-002,Smartphone Model B,8517.12,RVC40',
].join('\n')

function downloadTemplate() {
  const blob = new Blob([MODEL_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'model_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

/** Parse a CSV file into preview rows (client-side, first 20 rows) */
function parseCsvPreview(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const rows = []
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    if (i === 0 && (cols[0].toLowerCase().includes('model') || cols[0].toLowerCase().includes('code'))) {
      // header row — skip
      continue
    }
    rows.push({
      model_code: cols[0] || '',
      model_name: cols[1] || '',
      hs_code: cols[2] || '',
      co_criteria: cols[3] || '',
    })
  }
  return rows
}

const CELL = { padding: '4px 8px', border: '1px solid #ddd', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const TH = { ...CELL, background: '#f5f5f5', fontWeight: 600 }

export default function ModelImport({ onImportSuccess }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])   // {model_code, model_name, hs_code, co_criteria}
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)   // {success, created, errors[], message}
  const [importError, setImportError] = useState(null)

  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    setFile(f || null)
    setResult(null)
    setImportError(null)
    setPreview([])
    if (!f) return
    try {
      const text = await f.text()
      setPreview(parseCsvPreview(text))
    } catch {
      // preview unavailable
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!file || uploading) return
    setUploading(true)
    setResult(null)
    setImportError(null)
    try {
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
      <h3 style={{ marginBottom: 8 }}>Import Models (CSV)</h3>

      {/* Template + Add */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ fontSize: 12, padding: '3px 12px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer' }}
        >
          ⬇ Download CSV Template
        </button>
        <span style={{ fontSize: 11, color: '#888' }}>Format: model_code, model_name, hs_code, co_criteria</span>
        <button type="button" onClick={handleOpenAdd} disabled={adding} style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 12px' }}>
          {adding ? 'Adding…' : '+ Add Model'}
        </button>
      </div>

      {/* File picker */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
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
          {uploading ? 'Uploading…' : 'Upload CSV'}
        </button>
      </div>

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
                {preview.slice(0, 50).map((row, i) => (
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
          {preview.length > 50 && (
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Showing first 50 of {preview.length} rows.</div>
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
          <button
            type="button"
            onClick={handleClearFile}
            style={{ marginTop: 8, fontSize: 11, padding: '2px 10px', cursor: 'pointer' }}
          >
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