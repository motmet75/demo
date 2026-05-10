import React, { useState } from 'react'
import { importModelBoms } from '../../api/modelApi'
import { useAppContext } from '../../context/AppContext'

// Minimal modal dialog - updated to support XLSX Excel imports
export default function ModelBomImportDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const { tenantId, companyId } = useAppContext()

  if (!open) return null

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) return alert('Choose a file')
    setUploading(true)
    try {
      const res = await importModelBoms(file, { tenantId, companyId })
      setResult(res)
      if (res && res.success) {
        // notify parent to refresh
        try { if (typeof onSuccess === 'function') onSuccess(res) } catch (err) { console.debug('onSuccess callback threw', err) }
        // close after short delay so user sees message
        setTimeout(() => { try { onClose() } catch (err) { console.debug('onClose callback threw', err) } }, 600)
      }
    } catch (err) {
      setResult({ success: false, message: err.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    try { onClose && onClose() } catch (err) { console.debug('onClose callback threw', err) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ width: 640, maxWidth: '92%', background: '#fff', borderRadius: 6, padding: 16, boxShadow: '0 6px 24px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Import Model BOM (Excel XLSX)</h3>
          <button onClick={handleClose} aria-label="Close">Close</button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 8 }}>
            {/* Updated accept attribute for Excel files */}
            <input type="file" accept=".xlsx, .xls" onChange={e => setFile(e.target.files[0])} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            <button type="button" onClick={handleClose} disabled={uploading}>Cancel</button>
          </div>
        </form>

        {file && (
          <div style={{ marginTop: 8 }}>Selected: <strong>{file.name}</strong></div>
        )}

        {result && (
          <div style={{ marginTop: 12, border: '1px solid #eee', padding: 10, background: '#fafafa' }}>
            <div><strong>Success:</strong> {String(result.success)}</div>
            {result.message && <div><strong>Message:</strong> {result.message}</div>}
            <div><strong>Models affected:</strong> {result.modelsAffected || 0}</div>
            <div><strong>BOM lines imported:</strong> {result.bomLinesImported || 0}</div>
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
    </div>
  )
}