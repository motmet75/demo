import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { importMaterials, createMaterial } from '../../api/materialApi'
import MaterialEditModal from './MaterialEditModal'

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['material_code', 'material_name', 'unit', 'material_type', 'description'],
    ['MAT-001', 'Steel Plate', 'kg', 'RAW_MATERIAL', 'Cold-rolled steel plate'],
    ['MAT-002', 'Copper Wire', 'm', 'RAW_MATERIAL', '2mm copper wire'],
  ])
  ws['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 8 }, { wch: 16 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(wb, ws, 'material_import')
  XLSX.writeFile(wb, 'material_import_template.xlsx')
}

async function parseXlsxPreview(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', raw: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.slice(0, 50).map(r => ({
    material_code: r['material_code'] ?? r['materialCode'] ?? '',
    material_name: r['material_name'] ?? r['materialName'] ?? '',
    unit:          r['unit'] ?? '',
    material_type: r['material_type'] ?? r['materialType'] ?? '',
    description:   r['description'] ?? '',
  }))
}

const CELL = { padding: '4px 8px', border: '1px solid #ddd', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const TH = { ...CELL, background: '#f5f5f5', fontWeight: 600 }

export default function MaterialImport({ onImportComplete }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    setFile(f || null)
    setResult(null)
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
    setParseError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file || uploading) return
    setUploading(true)
    setResult(null)
    try {
      const res = await importMaterials(file)
      setResult(res)
      if (res && res.success && typeof onImportComplete === 'function') {
        onImportComplete()
      }
    } catch (err) {
      setResult({ success: false, message: err.message || 'Upload failed' })
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
      const res = await createMaterial(createPayload)
      alert('Material created: ' + (res && (res.materialName || res.materialCode) ? (res.materialName || res.materialCode) : ''))
      setAddOpen(false)
      return res
    } catch (err) {
      console.error('Create failed', err)
      setAddError(err.message || 'Create failed')
      throw err
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 8 }}>Import Materials (XLSX)</h3>

      {/* Template + Add */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ fontSize: 12, padding: '3px 12px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer' }}
        >
          ⬇ Download XLSX Template
        </button>
        <span style={{ fontSize: 11, color: '#888' }}>
          Columns: material_code, material_name, unit, material_type, description
        </span>
        <button
          type="button"
          onClick={handleOpenAdd}
          disabled={uploading || adding}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '3px 12px' }}
        >
          {adding ? 'Adding…' : '+ Add Material'}
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
          <button
            type="button"
            onClick={handleClearFile}
            style={{ fontSize: 11, color: '#999', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
          >
            clear
          </button>
        )}
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
                  <th style={TH}>material_code</th>
                  <th style={TH}>material_name</th>
                  <th style={TH}>unit</th>
                  <th style={TH}>material_type</th>
                  <th style={TH}>description</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={CELL}>{i + 1}</td>
                    <td style={CELL}>{row.material_code}</td>
                    <td style={CELL}>{row.material_name}</td>
                    <td style={CELL}>{row.unit}</td>
                    <td style={CELL}>{row.material_type}</td>
                    <td style={CELL}>{row.description}</td>
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
        <div style={{
          marginTop: 8, padding: '10px 14px', borderRadius: 4,
          border: `1px solid ${result.success ? '#a5d6a7' : '#ef9a9a'}`,
          background: result.success ? '#f1f8e9' : '#ffebee'
        }}>
          <div style={{ fontWeight: 600, color: result.success ? '#388e3c' : '#c62828', marginBottom: 4 }}>
            {result.success
              ? `✔ Import complete: ${result.created || 0} material${(result.created || 0) !== 1 ? 's' : ''} created`
              : `✖ Import failed: ${result.message}`}
          </div>
          {result.message && result.success && (
            <div style={{ fontSize: 12, color: '#555' }}>{result.message}</div>
          )}
          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 12, color: '#b71c1c', marginBottom: 2 }}>
                {result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped:
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#c62828' }}>
                {result.errors.map((er, i) => <li key={i}><pre style={{ margin: 0 }}>{er}</pre></li>)}
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

      <MaterialEditModal
        open={addOpen}
        material={null}
        onClose={handleCloseAdd}
        onSave={handleSaveAdd}
        saving={adding}
      />

      {addError && <div style={{ color: 'red', marginTop: 8, fontSize: 12 }}>{addError}</div>}
    </div>
  )
}