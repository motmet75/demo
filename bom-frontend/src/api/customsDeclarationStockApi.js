import {apiFetch,apiFetchJson} from './client'

const root='/bom/inventory/customs-declaration'

// Prefer backend's specific Vietnamese explanation over Spring's generic
// HTTP title ("Conflict"/"Bad Request"). Works with old and new error bodies.
export function customsErrorMessage(status,data) {
  const values=typeof data==='string'?[data]:[
    data?.detail,data?.message,data?.reason,data?.error,data?.title
  ]
  const meaningful=values.find(value=>typeof value==='string' && value.trim() &&
    !/^(conflict|bad request|internal server error|error|not found)$/i.test(value.trim()))
  if(status===409)return 'Xung đột (409): '+(meaningful||
    'Tờ khai hoặc dữ liệu kho đã thay đổi. Tải lại lịch sử tờ khai, kiểm tra mã vật tư/số lô rồi thử lại.')
  if(meaningful)return meaningful
  return 'Không thể xử lý tờ khai hải quan (HTTP '+status+').'
}
async function jsonRequest(path,opts={}) {
  const {res,data}=await apiFetchJson(root+path,opts)
  if(!res.ok){
    const error=new Error(customsErrorMessage(res.status,data))
    error.status=res.status
    error.code=data?.code
    throw error
  }
  return data
}
export const customsHistory=()=>jsonRequest('/history')
export const customsDocument=id=>jsonRequest('/'+encodeURIComponent(id))
export const customsConfirm=payload=>jsonRequest('/confirm',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
})
export async function customsUpload(file){
  const form=new FormData()
  form.append('file',file)
  const res=await apiFetch(root+'/upload',{method:'POST',body:form})
  const raw=await res.text()
  let data;try{data=JSON.parse(raw)}catch{data={message:raw}}
  if(!res.ok)throw new Error(customsErrorMessage(res.status,data))
  return data
}
