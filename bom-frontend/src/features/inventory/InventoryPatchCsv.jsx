import React, { useRef, useState } from 'react'
import { patchInventoryCsv, downloadPatchTemplate } from '../../api/inventoryApi'

/**
 * InventoryPatchCsv
 *
 * Lets the user:
 *   1. Download a pre-filled template CSV (id, material_code, batch_no,
 *      warehouse_code, order_to_deduction, material_quota_percentage)
 *   2. Fill in order_to_deduction and/or material_quota_percentage
 *   3. Upload the CSV back — only those two columns are patched in the DB
 */
export default function InventoryPatchCsv({ onPatchComplete }) {
  const [file, setFile]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult]     = useState(null)
  const fileRef = useRef(null)

  // ── download template ────────────────────────────────────────────
  async function handleDownloadTemplate() {
    setDownloading(true)
    setResult(null)
    try {
      const blob = await downloadPatchTemplate()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'inventory_patch_template.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setResult({ success: false, message: err.message || 'Template download failed' })
    } finally {
      setDownloading(false)
    }
  }

  // ── upload patch csv ─────────────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault()
    if (!file) { alert('Please choose a CSV file first'); return }
    setUploading(true)
    setResult(null)
    try {
      const res = await patchInventoryCsv(file)
      setResult(res)
      // reset file input
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      if (res.success && onPatchComplete) {
        setTimeout(() => onPatchComplete(), 1200)
      }
    } catch (err) {
      setResult({ success: false, message: err.message || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  // ── ui ───────────────────────────────────────────────────────────
  const successColor = '#1b5e20'
  const errorColor   = '#b71c1c'

  return (
    <div style={{ padding: '12px 0' }}>
      <h3 style={{ margin: '0 0 6px 0', fontSize: 15 }}>
        Patch Deduction &amp; Quota (CSV)
      </h3>

      {/* description */}
      <div style={{ fontSize: 12, color: '#555', marginBottom: 10, lineHeight: 1.6 }}>
        Update <strong>order_to_deduction</strong> and/or{' '}
        <strong>material_quota_percentage</strong> for existing inventory rows.
        <br />
        Only the columns present in the CSV header are changed — absent columns are left untouched.
        <br />
        Required CSV column: <code>id</code> (inventory UUID).
        Optional: <code>order_to_deduction</code>, <code>material_quota_percentage</code>.
      </div>

      {/* step 1 — download template */}
      <div style={sectionStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Step 1 — Download template</span>
        <div style={{ fontSize: 12, color: '#666', marginTop: 3, marginBottom: 8 }}>
          The template is pre-filled with all current inventory rows (id, material code, batch, warehouse).
          Just fill in the two columns and save.
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloading}
          style={btnStyle('#1565c0')}
        >
          {downloading ? '⏳ Downloading…' : '⬇ Download Template CSV'}
        </button>
      </div>

      {/* step 2 — upload filled csv */}
      <div style={sectionStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Step 2 — Upload filled CSV</span>
        <form onSubmit={handleUpload} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={e => { setFile(e.target.files[0] || null); setResult(null) }}
            style={{ fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={uploading || !file}
            style={btnStyle(uploading || !file ? '#9e9e9e' : '#2e7d32')}
          >
            {uploading ? '⏳ Uploading…' : '⬆ Upload & Patch'}
          </button>
          {file && (
            <span style={{ fontSize: 12, color: '#333' }}>
              Selected: <strong>{file.name}</strong>
            </span>
          )}
        </form>
      </div>

      {/* result panel */}
      {result && (
        <div style={{
          marginTop: 10,
          padding: '10px 14px',
          border: `1px solid ${result.success ? '#c8e6c9' : '#ffcdd2'}`,
          borderRadius: 6,
          background: result.success ? '#f1f8e9' : '#fff8f8',
          fontSize: 13
        }}>
          {/* status badge */}
          <div style={{ fontWeight: 700, color: result.success ? successColor : errorColor, marginBottom: 4 }}>
            {result.success ? '✅ Patch successful' : '❌ Patch failed'}
          </div>

          {result.message && (
            <div style={{ color: '#333', marginBottom: 4 }}>{result.message}</div>
          )}

          {/* counters */}
          <div style={{ display: 'flex', gap: 20, marginTop: 6, fontSize: 12 }}>
            {result.updated != null && (
              <span>✏️ Updated: <strong>{result.updated}</strong></span>
            )}
            {result.skipped != null && (
              <span>⏭ Skipped: <strong>{result.skipped}</strong></span>
            )}
          </div>

          {/* errors list */}
          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ color: errorColor }}>Errors ({result.errors.length}):</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {result.errors.map((er, i) => (
                  <li key={i} style={{ color: errorColor, fontFamily: 'monospace', fontSize: 12 }}>
                    {er}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── tiny style helpers ──────────────────────────────────────────────

const sectionStyle = {
  background: '#fafafa',
  border: '1px solid #e0e0e0',
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 10,
}

const btnStyle = (bg) => ({
  background: bg,
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '5px 14px',
  fontSize: 13,
  cursor: 'pointer',
  opacity: 1,
})
