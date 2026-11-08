import React,{useEffect,useMemo,useState} from 'react'
import {
  Accordion,AccordionDetails,AccordionSummary,Alert,Box,Checkbox,Chip,
  FormControlLabel,MenuItem,Stack,Table,TableBody,TableCell,TableContainer,
  TableHead,TableRow,TextField,Typography
} from '@mui/material'
import {apiFetchJson} from '../../api/client'
import {formatVnNumber} from '../../utils/vietnameseNumbers'
import {estimateCustomsTax,ratePercent} from '../../utils/customsTariffCalc'

const normalizeHs=hs=>String(hs??'').replace(/\D/g,'')
const fmt=value=>value==null?'—':formatVnNumber(value,2)
const statusLabel={
  NOT_CONFIGURED:'Chưa cấu hình kết nối biểu thuế',NOT_FOUND:'Không có HS trong Portal',
  FORBIDDEN:'Token hoặc quyền không hợp lệ',UNAVAILABLE:'Không kết nối Portal',
  UPSTREAM_ERROR:'Portal trả lỗi',INVALID_HS:'HS không đủ 8 số',
  BAD_URL:'URL Portal không hợp lệ',MISMATCH:'Mã HS không khớp'
}

/** Read-only scenario estimator; it NEVER modifies stock or posted VAT. */
export default function CustomsTariffComparison({doc,direction,currency,date}) {
  const [lookup,setLookup]=useState({})
  const [loading,setLoading]=useState(false)
  const [fx,setFx]=useState(currency==='VND'?'1':'')
  const [withoutCo,setWithoutCo]=useState('MFN')
  const [lines,setLines]=useState({})
  const change=(index,patch)=>setLines(prev=>({...prev,[index]:{...prev[index],...patch}}))

  useEffect(()=>{
    let active=true
    const ids=[...new Set((doc?.items||[]).map(i=>normalizeHs(i.hsCode)))]
      .filter(Boolean)
    if(!ids.length)return
    setLoading(true)
    setLookup({})
    let next=0
    const worker=async()=>{
      while(active&&next<ids.length){
        const hs=ids[next++]
        let result
        if(hs.length!==8){
          result={hsCode:hs,status:'INVALID_HS',message:'Mã HS không có 8 chữ số'}
        }else{
          try{
            const {res,data}=await apiFetchJson(
              '/bom/inventory/customs-declaration/tariff/'+encodeURIComponent(hs))
            result=res.ok&&data&&typeof data==='object'?data:{
              hsCode:hs,status:'UNAVAILABLE',message:data?.detail||data?.message||
                'Không đọc được biểu thuế từ Demo.'
            }
          }catch{result={hsCode:hs,status:'UNAVAILABLE',message:'Không kết nối được API thuế.'}}
        }
        if(active)setLookup(prev=>({...prev,[hs]:result}))
      }
    }
    Promise.all(Array.from({length:Math.min(5,ids.length)},()=>worker()))
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[doc?.id,doc?.items])

  const results=useMemo(()=>(doc?.items||[]).map((item,index)=>{
    const edit=lines[index]||{}
    const tariff=lookup[normalizeHs(item.hsCode)]||{}
    const sourceCurrency=item.currency||currency
    const baseline=withoutCo==='NORMAL'?tariff.normalImport:tariff.mfn
    const selectedFta=edit.fta||''
    const selectedFtaRate=selectedFta?tariff.fta?.[selectedFta]:null
    const vatRate=edit.vatOverride!==undefined&&edit.vatOverride!==''?
      edit.vatOverride:tariff.vat
    const data=estimateCustomsTax({
      quantity:item.quantity,unitPrice:item.unitPrice,currency:sourceCurrency,
      exchangeRate:fx,taxableValueVnd:edit.customsValue??'',
      noCoRate:baseline,ftaRate:selectedFtaRate,vatRate,
      extraTaxesVnd:edit.extraTaxes??'0'
    })
    const actual=edit.verifiedCo&&selectedFta&&data.withCo?data.withCo:data.noCo
    return {item,index,edit,tariff,sourceCurrency,baseline,selectedFta,vatRate,...data,actual}
  }),[doc,lookup,lines,fx,withoutCo,currency])

  const totals=useMemo(()=>results.reduce((a,row)=>{
    if(row.noCo){a.noCo+=row.noCo.totalTax;a.validNoCo++}
    if(row.withCo){a.withCo+=row.withCo.totalTax;a.validFta++}
    if(row.actual){a.actual+=row.actual.totalTax;a.validActual++}
    if(row.valuationSource!=='CUSTOMS_ENTERED')a.estimatedValuations++
    return a
  },{noCo:0,withCo:0,actual:0,validNoCo:0,validFta:0,validActual:0,estimatedValuations:0}),[results])

  if(!doc||direction!=='IN')return null
  return <Accordion disableGutters sx={{border:'1px solid',borderColor:'divider'}} key={doc.id}>
    <AccordionSummary sx={{bgcolor:'action.hover'}}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Typography fontWeight={800}>Tra cứu FTA/HS · Tính lại thuế nhập khẩu và VAT từng dòng</Typography>
        <Chip size="small" color="info" label="Chỉ tạm tính · Không ghi kho / không khai thuế"/>
        {loading&&<Chip size="small" label="Đang tra biểu thuế Portal"/>}
      </Stack>
    </AccordionSummary>
    <AccordionDetails>
      <Stack gap={1.5}>
        <Alert severity="warning">
          Thuế suất từ Portal /tariff là dữ liệu tham khảo: chưa xác minh biểu thuế có hiệu lực
          vào ngày {date||'tờ khai'}. C/O chỉ áp dụng khi đáp ứng quy tắc xuất xứ, chứng từ,
          nước thành viên, mã HS, thời điểm và điều kiện của từng FTA.
          VAT 8% (nếu đủ điều kiện theo quy định hiện hành) phải được kiểm tra riêng;
          không tự động giảm từ 10%.
        </Alert>
        <Stack direction={{xs:'column',sm:'row'}} gap={1} alignItems="center" flexWrap="wrap">
          <TextField size="small" label="Tỷ giá tính thuế HQ (VND / 1 đơn vị tiền)" value={fx}
            onChange={e=>setFx(e.target.value)} placeholder="Ví dụ: 25.800"
            helperText="Nhập tỷ giá HQ áp dụng vào ngày đăng ký tờ khai" sx={{width:310}}/>
          <TextField select size="small" label="Không có C/O · Biểu thuế" value={withoutCo}
            onChange={e=>setWithoutCo(e.target.value)} sx={{minWidth:235}}>
            <MenuItem value="MFN">Nhập khẩu ưu đãi (MFN, nếu đủ điều kiện)</MenuItem>
            <MenuItem value="NORMAL">Nhập khẩu thông thường</MenuItem>
          </TextField>
          <Chip color="default" label={`Tổng thuế dự kiến: ${fmt(totals.actual)} VND (${totals.validActual}/${results.length} dòng)`}/>
        </Stack>
        <TableContainer sx={{maxHeight:430,border:'1px solid',borderColor:'divider'}}>
          <Table stickyHeader size="small" sx={{minWidth:1620}}>
            <TableHead><TableRow>
              <TableCell sx={{minWidth:245}}>Dòng / HS / Tên hàng</TableCell>
              <TableCell sx={{minWidth:135}}>Trị giá hóa đơn</TableCell>
              <TableCell sx={{minWidth:175}}>Trị giá tính thuế (VND)</TableCell>
              <TableCell sx={{minWidth:115}}>Thuế suất không C/O</TableCell>
              <TableCell sx={{minWidth:180}}>FTA có C/O (giả định)</TableCell>
              <TableCell sx={{minWidth:120}}>VAT (%)</TableCell>
              <TableCell sx={{minWidth:155}}>TTĐB + BVMT (VND)</TableCell>
              <TableCell sx={{minWidth:130}}>Không C/O · NK + VAT</TableCell>
              <TableCell sx={{minWidth:130}}>Có C/O · NK + VAT</TableCell>
              <TableCell sx={{minWidth:160}}>Phương án áp dụng</TableCell>
            </TableRow></TableHead>
            <TableBody>{results.map(r=>{
              const validFTAs=Object.entries(r.tariff.fta||{})
              const options=validFTAs.filter(([,rate])=>ratePercent(rate)!==null)
              const selectedRate=r.tariff.fta?.[r.selectedFta]
              return <TableRow key={r.index}>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{r.index+1}. {r.item.description}</Typography>
                  <Typography variant="caption" display="block">HS: {r.item.hsCode||'—'} · Xuất xứ: {r.item.originCountry||'—'}</Typography>
                  <Typography variant="caption" display="block" color={r.tariff.status==='OK'?'success.main':'error.main'}>
                    {r.tariff.status==='OK'? `Portal /tariff · bản ${r.tariff.tariffVersion||'chưa rõ'}` :
                      statusLabel[r.tariff.status]||r.tariff.message||'Đang tra HS…'}
                  </Typography>
                </TableCell>
                <TableCell>{fmt(r.invoiceValue)} {r.sourceCurrency}</TableCell>
                <TableCell>
                  <TextField size="small" fullWidth value={r.edit.customsValue??''}
                    placeholder={r.customsValue!=null?fmt(r.customsValue):'Nhập trị giá'}
                    helperText={r.valuationSource==='CUSTOMS_ENTERED'?'Giá trị đã nhập':'Ước từ hóa đơn × tỷ giá'}
                    onChange={e=>change(r.index,{customsValue:e.target.value})}/>
                </TableCell>
                <TableCell>
                  {r.baseline==null||r.baseline===''?'—':String(r.baseline)+'%'}
                  <Typography variant="caption" display="block">{withoutCo}</Typography>
                </TableCell>
                <TableCell>
                  <TextField size="small" select fullWidth label="FTA" value={r.selectedFta}
                    onChange={e=>change(r.index,{fta:e.target.value,verifiedCo:false})}>
                    <MenuItem value="">Không chọn</MenuItem>
                    {options.map(([code,rate])=><MenuItem key={code} value={code}>{code} · {rate}%</MenuItem>)}
                  </TextField>
                  <Typography variant="caption" display="block">
                    {r.selectedFta?`FTA ${r.selectedFta}: ${selectedRate}%`:'Chọn FTA phù hợp xuất xứ'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <TextField size="small" value={r.edit.vatOverride??''}
                    label={r.tariff.vat?'Biểu: '+r.tariff.vat+'%':'Chưa có mức VAT'}
                    placeholder={r.tariff.vat||'Nhập %'}
                    onChange={e=>change(r.index,{vatOverride:e.target.value})}
                    error={r.edit.vatOverride!==undefined&&r.edit.vatOverride!==''&&ratePercent(r.edit.vatOverride)===null}
                    helperText="Tự đối chiếu 5/8/10%"/>
                </TableCell>
                <TableCell><TextField size="small" value={r.edit.extraTaxes??'0'} fullWidth
                  onChange={e=>change(r.index,{extraTaxes:e.target.value})}
                  helperText="Chỉ nhập khi có phát sinh"/></TableCell>
                <TableCell>
                  {r.noCo?<>
                    <Typography variant="body2">NK: {fmt(r.noCo.duty)}</Typography>
                    <Typography variant="body2">VAT: {fmt(r.noCo.vatAmount)}</Typography>
                    <Typography fontWeight={700}>{fmt(r.noCo.totalTax)}</Typography>
                  </>:'—'}
                </TableCell>
                <TableCell>
                  {r.withCo?<>
                    <Typography variant="body2">NK: {fmt(r.withCo.duty)}</Typography>
                    <Typography variant="body2">VAT: {fmt(r.withCo.vatAmount)}</Typography>
                    <Typography fontWeight={700}>{fmt(r.withCo.totalTax)}</Typography>
                  </>:'—'}
                </TableCell>
                <TableCell>
                  <FormControlLabel sx={{m:0}}
                    control={<Checkbox size="small" checked={Boolean(r.edit.verifiedCo)}
                      disabled={!r.selectedFta||!r.withCo}
                      onChange={e=>change(r.index,{verifiedCo:e.target.checked})}/>}
                    label={<Typography variant="caption">Đã kiểm tra C/O và điều kiện FTA</Typography>}/>
                  <Typography variant="body2" fontWeight={700}>
                    {r.actual?fmt(r.actual.totalTax)+' VND':'Chưa đủ dữ liệu'}
                  </Typography>
                </TableCell>
              </TableRow>
            })}</TableBody>
          </Table>
        </TableContainer>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label={`Không C/O: ${fmt(totals.noCo)} VND (${totals.validNoCo}/${results.length})`}/>
          <Chip label={`Có C/O giả định: ${fmt(totals.withCo)} VND (${totals.validFta}/${results.length})`}/>
          <Chip color="success" label={`Đã chọn áp dụng: ${fmt(totals.actual)} VND (${totals.validActual}/${results.length})`}/>
        </Stack>
        {totals.estimatedValuations>0&&<Alert severity="info">
          Có {totals.estimatedValuations} dòng chưa nhập trị giá tính thuế HQ chính thức.
          Giá trị được ước tính từ đơn giá hóa đơn và tỷ giá (nếu có), có thể thiếu CIF,
          điều chỉnh trị giá, thuế TTĐB/BVMT và các khoản cộng/trừ. Tổng thuế chỉ cộng
          các dòng tính được; không phải số thuế nộp chính thức.
        </Alert>}
        <Typography variant="caption" color="text.secondary">
          Tỷ giá phải lấy theo quy định hải quan tại thời điểm đăng ký; FTA tính theo năm,
          C/O và điều kiện cụ thể; biểu thuế không chứng minh xuất xứ. Bảng này chỉ
          dùng đối chiếu và không thay đổi dữ liệu VAT đang lưu trong phiếu nhập kho.
        </Typography>
      </Stack>
    </AccordionDetails>
  </Accordion>
}
