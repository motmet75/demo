import React, { useState } from 'react'
import { apiFetch } from '../../api/client'

export default function ContractImport() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)

  const upload = async () => {
    if (!file) return alert('Select a file')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await apiFetch('/bom/api/contracts/import', { method: 'POST', body: fd })
      const json = await res.json()
      setResult(json)
      alert('Import completed: ' + (json && json.message ? json.message : 'Done'))
    } catch (e) {
      console.error(e)
      alert('Upload failed: ' + (e && e.message ? e.message : 'Unknown error'))
    }
  }

  return (
    <div style={{ padding: 8 }}>
      <h3>Import Contracts (Excel)</h3>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
      <button onClick={upload} disabled={!file}>Upload</button>
      {result && <div style={{ marginTop: 8 }}>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </div>}
    </div>
  )
}