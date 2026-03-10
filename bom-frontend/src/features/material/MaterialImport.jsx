import React, { useState } from 'react'
import { importMaterials, createMaterial } from '../../api/materialApi'
import MaterialEditModal from './MaterialEditModal'

export default function MaterialImport({ onImportComplete }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) return alert('Choose a file')
    setUploading(true)
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

  const handleOpenAdd = () => {
    setAddError(null)
    setAddOpen(true)
  }

  const handleCloseAdd = () => {
    if (adding) return // prevent closing while adding
    setAddOpen(false)
    setAddError(null)
  }

  const handleSaveAdd = async (payload) => {
    if (adding) return
    setAddError(null)
    setAdding(true)
    try {
      // remove id if present
      const createPayload = { ...payload }
      if (createPayload.id) delete createPayload.id
      const res = await createMaterial(createPayload)
      // show basic success notification
      alert('Material created: ' + (res && (res.materialName || res.materialCode) ? (res.materialName || res.materialCode) : ''))
      setAddOpen(false)
      return res
    } catch (err) {
      console.error('Create failed', err)
      setAddError(err.message || 'Create failed')
      // rethrow so modal shows error via returned promise handling
      throw err
    } finally {
      setAdding(false)
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3>Import Materials (CSV)</h3>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={handleOpenAdd} disabled={uploading || adding}>
          {adding ? 'Adding...' : 'Add Material'}
        </button>
      </div>
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

      {/* Add modal for manual material creation */}
      <MaterialEditModal
        open={addOpen}
        material={null}
        onClose={handleCloseAdd}
        onSave={handleSaveAdd}
        saving={adding}
      />

      {/* show add error if present (fixes ESLint unused var) */}
      {addError ? <div style={{ color: 'red', marginTop: 8 }}>{addError}</div> : null}
    </div>
  )
}