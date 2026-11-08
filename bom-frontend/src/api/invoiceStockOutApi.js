import { apiFetch, apiFetchJson } from './client'

const base = '/bom/inventory/invoice-stock-out'
async function jsonRequest(path, options={}) {
  const {res,data} = await apiFetchJson(base + path, options)
  if(!res.ok) throw new Error((typeof data === 'string' ? data : data?.message || data?.detail || data?.error) ||
    'Không xử lý được hóa đơn xuất kho (HTTP ' + res.status + ')')
  return data
}
export function fetchInvoiceStockOutDocuments() { return jsonRequest('/documents') }
export function fetchInvoiceStockOutPosted() { return jsonRequest('/posted') }
export function fetchInvoiceStockOutDocument(id) { return jsonRequest('/documents/' + encodeURIComponent(id)) }
export function confirmInvoiceStockOut(payload) {
  return jsonRequest('/confirm', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),
  })
}
export async function uploadInvoiceStockOutDocument(file) {
  const body=new FormData()
  body.append('file',file)
  const res=await apiFetch(base+'/upload',{method:'POST',body})
  const text=await res.text()
  let data
  try { data=text?JSON.parse(text):null } catch { data=text }
  if(!res.ok) throw new Error((typeof data==='string' ? data : data?.message || data?.detail || data?.error) ||
    'Không đọc được PDF (HTTP '+res.status+')')
  return data
}
export async function openInvoiceStockOutPdf(documentId) {
  const res=await apiFetch('/api/invoice-desk/documents/'+encodeURIComponent(documentId)+'/source')
  if(!res.ok) throw new Error('Không thể mở bản gốc hóa đơn')
  const blob=await res.blob()
  const url=URL.createObjectURL(blob)
  window.open(url,'_blank','noopener,noreferrer')
}
