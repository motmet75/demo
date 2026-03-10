import React, { useState } from 'react'
import { importInventory } from '../../api/inventoryApi'

const CSV_HEADERS = [
  'material_code','warehouse_code','batch_no','quantity_on_hand','quantity_total',
  'quantity_reserved','quantity_locked','contract_code','unit','unit_price','currency',
  'hs_code','origin_type','origin_country','xform_no','cds_no','purchase_no',
  'order_to_deduction','material_quota','material_quota_percentage','user_name',
  'xform_date','purchase_date_time','cds_date_time','production_date_time','expiration_date_time',
  'visible','approved','locked'
]

function downloadTemplate() {
  const csv = CSV_HEADERS.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'inventory_import_template.csv'
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

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
      <div style={{ marginBottom: 8, fontSize: 12, color: '#555' }}>
        Required columns: <code>material_code, warehouse_code, batch_no, quantity_on_hand</code>.
        Optional: <code>quantity_total</code> (defaults to quantity_on_hand if omitted).{' '}
        <button type="button" onClick={downloadTemplate} style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}>
          ⬇ Download Template
        </button>
      </div>
      <form onSubmit={onSubmit}>
        <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
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