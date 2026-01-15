import React, { useEffect, useState } from 'react'
import { fetchModelBoms } from '../../api/modelApi'

export default function ModelBomDialog({ open, onClose, model }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const all = await fetchModelBoms()
        // filter for model
        const filtered = all.filter(i => i.model && i.model.modelCode === (model && model.modelCode))
        if (!mounted) return
        setItems(filtered)
      } catch (e) {
        console.error('Failed to fetch model boms', e)
        setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [open, model])

  if (!open) return null

  function downloadCsv() {
    if (!items || items.length === 0) { alert('No BOM data to download'); return }
    const rows = items.map(it => ({ modelCode: it.model && it.model.modelCode, materialCode: it.material && it.material.materialCode, qtyPerUnit: it.qtyPerUnit }))
    const header = Object.keys(rows[0])
    const csv = [header.join(','), ...rows.map(r => header.map(h => r[h] == null ? '' : String(r[h])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model && model.modelCode ? model.modelCode : 'model'}-bom.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ width: 700, maxWidth: '96%', background: '#fff', borderRadius: 6, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>BOM for {model && model.modelCode}</h3>
          <div>
            <button onClick={onClose}>Close</button>
            <button onClick={downloadCsv} style={{ marginLeft: 8 }}>Download CSV</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? <div>Loading...</div> : null}
          {!loading && (!items || items.length === 0) ? <div>No BOM lines for this model.</div> : null}
          {!loading && items && items.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Material Code</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Material Name</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd' }}>Qty per Unit</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.id}>
                    <td style={{ padding: '6px 8px' }}>{it.material && it.material.materialCode}</td>
                    <td style={{ padding: '6px 8px' }}>{it.material && it.material.materialName}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{it.qtyPerUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
