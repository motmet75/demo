import React, { useState } from 'react'
import { createModel } from '../../api/modelApi'
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

export default function ModelImport() {
  const [file, setFile] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const handleOpenAdd = () => {
    setAddError(null)
    setAddOpen(true)
  }

  const handleCloseAdd = () => {
    if (adding) return
    setAddOpen(false)
    setAddError(null)
  }

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
      <h3>Import Models (CSV)</h3>
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{ fontSize: 12, padding: '2px 10px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 4, cursor: 'pointer' }}
        >
          ⬇ Download CSV Template
        </button>
        <span style={{ marginLeft: 8, fontSize: 11, color: '#666' }}>
          Format: model_code, model_name, hs_code, co_criteria
        </span>
      </div>
      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={handleOpenAdd} disabled={adding}>
          {adding ? 'Adding...' : 'Add Model'}
        </button>
      </div>
      <form onSubmit={(e) => e.preventDefault()}>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
        <button type="button" disabled>Upload (not implemented)</button>
      </form>

      {file && (
        <div style={{ marginTop: 8 }}>
          Selected: <strong>{file.name}</strong>
        </div>
      )}

      <ModelEditModal
        open={addOpen}
        model={null}
        onClose={handleCloseAdd}
        onSave={handleSaveAdd}
        saving={adding}
      />

      {addError ? <div style={{ color: 'red', marginTop: 8 }}>{addError}</div> : null}
    </div>
  )
}
