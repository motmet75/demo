import {apiFetch,apiFetchJson} from './client'

const base='/bom/inventory/invoice-pdf-receive'
async function request(path, options={}) {
  const {res,data}=await apiFetchJson(base+path,options)
  if(!res.ok) throw new Error(
    (typeof data==='string'?data:data?.detail||data?.message||data?.error)||
    'Không thể xử lý nhập kho PDF (HTTP '+res.status+')')
  return data
}
export const listReceivingDocuments=()=>request('/documents')
export const getReceivingDocument=id=>request('/documents/'+encodeURIComponent(id))
export const listPdfReceivingHistory=()=>request('/history')
export const confirmPdfReceiving=body=>request('/confirm',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
})
export async function uploadReceivingPdf(file){
  const form=new FormData()
  form.append('file',file)
  const response=await apiFetch(base+'/upload',{method:'POST',body:form})
  const text=await response.text()
  let body
  try {body=JSON.parse(text)} catch {body={message:text}}
  if(!response.ok)throw new Error(body?.detail||body?.message||'Không đọc được PDF')
  return body
}
