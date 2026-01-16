import React, { useState } from 'react'
import { importInventory } from '../../api/inventoryApi'

export default function InventoryImport() {
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
