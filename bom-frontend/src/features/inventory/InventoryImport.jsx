import React, { useState } from 'react'
import { importInventory } from '../../api/inventoryApi'

export default function InventoryImport({ onImportComplete }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) return alert('Choose a file')
    setUploading(true)
    try {
      const res = await importInventory(file)
      setResult(res)
      // Call callback on success to refresh grid
      if (res.success && onImportComplete) {
        setTimeout(() => onImportComplete(), 1500)
      }
    } catch (err) {
      setResult({ success: false, message: err.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3>Import Inventory (CSV)</h3>
      <form onSubmit={onSubmit}>
        <input
          type="file"
          accept=".csv"
          onChange={e => setFile(e.target.files[0])}
        />
        <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
      </form>

      {file && (
        <div style={{ marginTop: 8 }}>
          Selected: <strong>{file.name}</strong>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 8, border: '1px solid #eee', padding: 10, background: '#fafafa' }}>
          <div><strong>Success:</strong> {String(result.success)}</div>
          {result.message && <div><strong>Message:</strong> {result.message}</div>}
          <div><strong>Created:</strong> {result.created || 0}</div>
          <div><strong>Updated:</strong> {result.updated || 0}</div>
          
          {result.missingMaterials && result.missingMaterials.length > 0 && (
            <div style={{ marginTop: 8, color: 'red' }}>
              <strong>Missing Materials (not found in system):</strong>
              <ul>
                {result.missingMaterials.map((code, i) => <li key={i}>{code}</li>)}
              </ul>
            </div>
          )}
          
          {result.missingWarehouses && result.missingWarehouses.length > 0 && (
            <div style={{ marginTop: 8, color: 'red' }}>
              <strong>Missing Warehouses (not found in system):</strong>
              <ul>
                {result.missingWarehouses.map((code, i) => <li key={i}>{code}</li>)}
              </ul>
            </div>
          )}
          
          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Errors:</strong>
              <ul>
                {result.errors.map((er, i) => <li key={i}><pre style={{ margin: 0 }}>{er}</pre></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
