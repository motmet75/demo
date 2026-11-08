import {apiFetch,apiFetchJson} from './client'

const root='/bom/inventory/customs-declaration'
async function jsonRequest(path,opts={}) {
  const {res,data}=await apiFetchJson(root+path,opts)
  if(!res.ok)throw new Error(
    typeof data==='string'?data:
    data?.detail||data?.message||data?.error||'Không thể xử lý tờ khai hải quan')
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
  if(!res.ok)throw new Error(data?.detail||data?.message||'Không đọc được tờ khai Excel')
  return data
}
