import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import {draftInventoryCurrencyPatch} from '../../utils/inventoryCurrencyPatch'
import { patchInventoryXlsx, downloadPatchTemplate } from '../../api/inventoryApi'

/**
 * InventoryPatchCsv
 *
 * Lets the user:
 *   1. Download a pre-filled template CSV (id, material_code, batch_no,
 *      warehouse_code, order_to_deduction, material_quota_percentage)
 *   2. Fill in order_to_deduction and/or material_quota_percentage
 *   3. Upload the CSV back — only those two columns are patched in the DB
 */
export default function InventoryPatchCsv({ onPatchComplete, selectedRows = [], priceOnly = false }) {
  const [file, setFile]         = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult]     = useState(null)
  const fileRef = useRef(null)
  const [targetCurrency,setTargetCurrency] = useState('')
  const [currencyMode,setCurrencyMode] = useState('KEEP')
  const [usdToVnd,setUsdToVnd] = useState('')
  const [relabelConfirmed,setRelabelConfirmed] = useState(false)

  // ── download template ────────────────────────────────────────────
  async function handleDownloadTemplate() {
    setDownloading(true)
    setResult(null)
    try {
      const blob = !priceOnly ? await downloadPatchTemplate() : (() => {
        if (!selectedRows.length) throw new Error('Chọn các dòng tồn kho trước khi tải Excel.')
        if (targetCurrency && currencyMode === 'KEEP')
          throw new Error('Chọn Quy đổi hoặc Chỉ sửa nhãn tiền tệ.')
        if (currencyMode === 'RELABEL' && targetCurrency && !relabelConfirmed)
          throw new Error('Cần xác nhận việc đổi nhãn mà không quy đổi số tiền.')
        const {updates,problems} = draftInventoryCurrencyPatch(selectedRows,{
          targetCurrency,mode:currencyMode,usdToVnd
        })
        if (problems.length) throw new Error(problems.slice(0,6).join(' | '))
        const sheet = XLSX.utils.json_to_sheet(updates,{header:[
          'id','material_code','material_name','warehouse_code','batch_no',
          'original_currency','original_unit_price','currency','unit_price',
          'confirm_currency_change'
        ]})
        sheet['!cols'] = [
          {wch:38},{wch:23},{wch:46},{wch:20},{wch:22},{wch:18},
          {wch:22},{wch:14},{wch:20},{wch:25}
        ]
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook,sheet,'inventory_patch')
        return new Blob([XLSX.write(workbook,{bookType:'xlsx',type:'array'})],{
          type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
      })()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = priceOnly ? `inventory_currency_price_${selectedRows.length}.xlsx` : 'inventory_patch_template.xlsx'
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
    if (!file) { alert('Please choose a XLSX file first'); return }
    setUploading(true)
    setResult(null)
    try {
      const res = await patchInventoryXlsx(file)
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
        {priceOnly ? `Cập nhật giá tồn kho bằng Excel (${selectedRows.length} dòng đã chọn)` : 'Patch Deduction & Quota (XLSX)'}
      </h3>

      {/* description */}
      <div style={{ fontSize: 12, color: '#555', marginBottom: 10, lineHeight: 1.6 }}>
        {priceOnly ? <>
          Lọc kho / lô → chọn dòng → chọn USD/VND → tải Excel cập nhật đơn giá.
          Các cột <strong>currency</strong> và <strong>unit_price</strong> là tiền tệ
          và đơn giá thực tế theo đơn vị kho; không tự coi USD là VND.
          Giữ nguyên <strong>id, original_currency, original_unit_price</strong>.
          Nếu sửa tiền tệ trong Excel, nhập đơn giá mới và đặt
          <strong> confirm_currency_change=YES</strong>.
          Hệ thống kiểm tra tất cả dòng trước khi ghi database.
        </> : <>
          Update <strong>order_to_deduction</strong> and/or{' '}
          <strong>material_quota_percentage</strong> for existing inventory rows.
          <br />
          Only the columns present in the XLSX header are changed — absent columns are left untouched.
          <br />
          Required column: <code>id</code> (inventory UUID).
          Optional: <code>order_to_deduction</code>, <code>material_quota_percentage</code>, <code>unit_price</code>.
        </>}
      </div>

      {priceOnly && <div style={{...sectionStyle,background:'#eff6ff'}}>
        <strong>Cập nhật USD / VND cho các dòng đã chọn</strong>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end',marginTop:10}}>
          <label style={{fontSize:12}}>Tiền tệ đích
            <select value={targetCurrency} onChange={e=>{
              setTargetCurrency(e.target.value);setRelabelConfirmed(false)
            }} style={{display:'block',padding:7}}>
              <option value="">Giữ nguyên từng dòng</option>
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label style={{fontSize:12}}>Chế độ
            <select value={currencyMode} disabled={!targetCurrency}
              onChange={e=>{setCurrencyMode(e.target.value);setRelabelConfirmed(false)}}
              style={{display:'block',padding:7}}>
              <option value="KEEP">Giữ nguyên</option>
              <option value="CONVERT">Quy đổi đơn giá qua tỷ giá đã nhập</option>
              <option value="RELABEL">Chỉ sửa nhãn tiền tệ (không quy đổi)</option>
            </select>
          </label>
          {targetCurrency && currencyMode==='CONVERT' && <label style={{fontSize:12}}>
            Tỷ giá VND / 1 USD
            <input type="number" min="0.000001" step="any"
              value={usdToVnd} onChange={e=>setUsdToVnd(e.target.value)}
              placeholder="Tỷ giá được kiểm tra"
              style={{display:'block',padding:7,width:200}}/>
          </label>}
        </div>
        {currencyMode==='RELABEL' && targetCurrency && <label
          style={{display:'flex',alignItems:'flex-start',gap:8,marginTop:10,fontSize:12,color:'#9a3412'}}>
          <input type="checkbox" checked={relabelConfirmed}
            onChange={e=>setRelabelConfirmed(e.target.checked)}/>
          Tôi xác nhận đơn giá đã đúng theo tiền tệ mới; chỉ sửa nhãn, không quy đổi số tiền.
        </label>}
        {currencyMode==='CONVERT' && targetCurrency && <p style={{fontSize:12,marginBottom:0}}>
          USD → VND: nhân tỷ giá; VND → USD: chia tỷ giá. Mã khác USD/VND cần xử lý
          riêng, không tự chuyển đổi. Chỉ sử dụng tỷ giá phù hợp chứng từ.
        </p>}
      </div>}

      {/* step 1 — download template */}
      <div style={sectionStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Step 1 — Download template</span>
        <div style={{ fontSize: 12, color: '#666', marginTop: 3, marginBottom: 8 }}>
          {priceOnly
            ? `Mẫu Excel gồm đúng ${selectedRows.length} dòng đang được chọn trong bộ lọc; lưu lại sau khi thay đổi giá.`
            : 'Tải mẫu Excel hiện có. Nhập những cột cần thay đổi rồi lưu.'}
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          disabled={downloading || (priceOnly && selectedRows.length === 0)}
          style={btnStyle('#1565c0')}
        >
          {downloading ? '⏳ Đang tạo mẫu…' : priceOnly ? '⬇ Tải Excel giá & tiền tệ' : '⬇ Download Template XLSX'}
        </button>
      </div>

      {/* step 2 — upload filled csv */}
      <div style={sectionStyle}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Bước 2 — Tải lại Excel đã chỉnh sửa</span>
        <form onSubmit={handleUpload} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={e => { setFile(e.target.files[0] || null); setResult(null) }}
            style={{ fontSize: 13 }}
          />
          <button
            type="submit"
            disabled={uploading || !file}
            style={btnStyle(uploading || !file ? '#9e9e9e' : '#2e7d32')}
          >
            {uploading ? '⏳ Đang cập nhật…' : priceOnly ? '⬆ Cập nhật giá & tiền tệ' : '⬆ Upload & Patch'}
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
