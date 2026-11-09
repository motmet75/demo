import React,{useEffect,useMemo,useState} from 'react'
import {
  Accordion,AccordionDetails,AccordionSummary,Alert,Box,Checkbox,Chip,
  FormControlLabel,MenuItem,Stack,Table,TableBody,TableCell,TableContainer,
  TableHead,TableRow,TextField,Typography
} from '@mui/material'
import {apiFetchJson} from '../../api/client'
import {formatVnNumber} from '../../utils/vietnameseNumbers'
import {localMoney} from '../../utils/customsTariffCalc'
import {estimateCustomsLandedCost} from '../../utils/customsLandedCost'
import {estimateCustomsTax,ratePercent} from '../../utils/customsTariffCalc'

const normalizeHs=hs=>String(hs??'').replace(/\D/g,'')
const fmt=value=>value==null?'—':formatVnNumber(value,2)
const fmtUnit=value=>value==null?'—':formatVnNumber(value,4)
const statusLabel={
  NOT_CONFIGURED:'Chưa cấu hình kết nối biểu thuế',NOT_FOUND:'Mã HS không có trong biểu thuế đã kiểm tra',
  PORTAL_API_NOT_FOUND:'Không tìm thấy API biểu thuế Portal (lỗi đường dẫn hoặc chưa deploy)',
  FORBIDDEN:'Token hoặc quyền không hợp lệ',UNAVAILABLE:'Không kết nối Portal',
  UPSTREAM_ERROR:'Portal trả lỗi',INVALID_HS:'HS không đủ 8 số',
  BAD_URL:'URL Portal không hợp lệ',MISMATCH:'Mã HS không khớp'
}

/** Read-only scenario estimator; it NEVER modifies stock or posted VAT. */
export default function CustomsTariffComparison({doc,direction,currency,date,rows=[]}) {
  const [lookup,setLookup]=useState({})
  const [loading,setLoading]=useState(false)
  const [fx,setFx]=useState(currency==='VND'?'1':'')
  const [withoutCo,setWithoutCo]=useState('DECLARED')
  const [goodsValueBasis,setGoodsValueBasis]=useState('CUSTOMS')
  const [vatCreditable,setVatCreditable]=useState(false)
  const [lines,setLines]=useState({})
  const change=(index,patch)=>setLines(prev=>({...prev,[index]:{...prev[index],...patch}}))

  // A document can have another currency; never carry "1" from a VND
  // document into an imported USD/EUR invoice as its historical FX rate.
  useEffect(()=>{
    setFx(currency==='VND'?'1':'')
  },[currency,doc?.id])

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
    const baseline=withoutCo==='DECLARED'?item.importTaxRate:
      withoutCo==='NORMAL'?tariff.normalImport:tariff.mfn
    const selectedFta=edit.fta||''
    const selectedFtaRate=selectedFta?tariff.fta?.[selectedFta]:null
    // The original registered VAT rate takes priority over a tariff table
    // that may have changed since the customs declaration date.
    const vatRate=edit.vatOverride!==undefined&&edit.vatOverride!==''?
      edit.vatOverride:item.vatRate??tariff.vat
    const data=estimateCustomsTax({
      quantity:item.quantity,unitPrice:item.unitPrice,currency:sourceCurrency,
      exchangeRate:fx,
      // Keep JSON numeric amount numeric: converting it to a US-decimal
      // string can be misread as a Vietnamese thousands-grouped input.
      taxableValueVnd:edit.customsValue??item.importTaxableValueVnd??'',
      noCoRate:baseline,ftaRate:selectedFtaRate,vatRate,
      extraTaxesVnd:edit.extraTaxes??'0'
    })
    // For unmodified historical declarations prefer tax AMOUNTS on the
    // original Excel (not a recalculation that may differ due to rounding).
    const originalDuty=localMoney(item.importTaxAmountVnd)
    const originalVat=localMoney(item.vatAmountVnd)
    const originalAmounts=withoutCo==='DECLARED' &&
      edit.customsValue===undefined &&
      (edit.vatOverride===undefined||edit.vatOverride==='') &&
      (edit.extraTaxes===undefined||localMoney(edit.extraTaxes)===0) &&
      originalDuty!==null && originalVat!==null
    const originalTax=originalAmounts?{
      duty:originalDuty,vatAmount:originalVat,
      totalTax:Math.round((originalDuty+originalVat)*100)/100
    }:null
    const baselineTax=originalTax||data.noCo
    const actual=edit.verifiedCo&&selectedFta&&data.withCo?data.withCo:baselineTax
    const invoiceValueOriginal=item.invoiceValue==null?data.invoiceValue:
      Number(item.invoiceValue)
    const goodsVnd=goodsValueBasis==='CUSTOMS'?data.customsValue:
      sourceCurrency.toUpperCase()==='VND'?invoiceValueOriginal:
      localMoney(fx)>0&&invoiceValueOriginal!=null?
        invoiceValueOriginal*localMoney(fx):null
    const landedParams={
      declaredQuantity:item.quantity,
      stockConversionRatio:rows[index]?.conversionRatio??'1',
      goodsValueVnd:goodsVnd,
      otherImportTaxesVnd:edit.extraTaxes??'0',
      extraLocalCostsVnd:edit.localCosts??'0',
      importVatCreditable:vatCreditable
    }
    const withoutCoLanded=estimateCustomsLandedCost({
      ...landedParams,
      importDutyVnd:originalAmounts?originalDuty:data.noCo?.duty,
      importVatVnd:originalAmounts?originalVat:data.noCo?.vatAmount
    })
    const withCoLanded=estimateCustomsLandedCost({
      ...landedParams,importDutyVnd:data.withCo?.duty,
      importVatVnd:data.withCo?.vatAmount
    })
    const appliedLanded=edit.verifiedCo&&selectedFta&&withCoLanded?
      withCoLanded:withoutCoLanded
    return {item,index,edit,tariff,sourceCurrency,baseline,selectedFta,
      vatRate,...data,actual,baselineTax,withoutCoLanded,withCoLanded,appliedLanded,
      originalAmounts,goodsVnd}
  }),[doc,lookup,lines,fx,withoutCo,currency,goodsValueBasis,vatCreditable,rows])

  const totals=useMemo(()=>results.reduce((a,row)=>{
    if(row.baselineTax){a.noCo+=row.baselineTax.totalTax;a.validNoCo++}
    if(row.withCo){a.withCo+=row.withCo.totalTax;a.validFta++}
    if(row.actual){a.actual+=row.actual.totalTax;a.validActual++}
    if(row.valuationSource!=='CUSTOMS_ENTERED')a.estimatedValuations++
    if(row.appliedLanded){
      a.landedCash+=row.appliedLanded.totalIncludingVatVnd
      a.landedCost+=row.appliedLanded.indicativeInventoryCostVnd
      a.validLanded++
    }
    return a
  },{noCo:0,withCo:0,actual:0,validNoCo:0,validFta:0,validActual:0,
    landedCash:0,landedCost:0,validLanded:0,estimatedValuations:0}),[results])

  if(!doc||direction!=='IN')return null
  return <Accordion defaultExpanded disableGutters sx={{border:'1px solid',borderColor:'divider'}} key={doc.id}>
    <AccordionSummary sx={{bgcolor:'action.hover'}}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Typography fontWeight={800}>Giá nhập kho VND sau thuế · FTA / HS · Tính theo ngày tờ khai</Typography>
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
          <TextField size="small" label="Tỷ giá ngày tờ khai (VND / 1 ngoại tệ)" value={fx}
            onChange={e=>setFx(e.target.value)} placeholder="Ví dụ: 25.800"
            helperText="Nhập tỷ giá lịch sử phù hợp; không dùng tỷ giá hôm nay cho tờ khai cũ" sx={{width:335}}/>
          <TextField select size="small" label="Mức thuế cơ sở để đối chiếu" value={withoutCo}
            onChange={e=>setWithoutCo(e.target.value)} sx={{minWidth:250}}>
            <MenuItem value="DECLARED">Thuế suất gốc trên tờ khai (không suy luận C/O)</MenuItem>
            <MenuItem value="MFN">MFN từ biểu thuế Portal (nếu đủ điều kiện)</MenuItem>
            <MenuItem value="NORMAL">Thuế thông thường từ biểu thuế Portal</MenuItem>
          </TextField>
          <Chip color="default" label={`Tổng thuế dự kiến: ${fmt(totals.actual)} VND (${totals.validActual}/${results.length} dòng)`}/>
        </Stack>
        <Stack direction={{xs:'column',sm:'row'}} gap={1} alignItems="center" flexWrap="wrap">
          <TextField select size="small" label="Giá trị hàng hóa để tính giá vốn VND"
            value={goodsValueBasis} onChange={e=>setGoodsValueBasis(e.target.value)}
            sx={{minWidth:365}}>
            <MenuItem value="CUSTOMS">Tạm lấy trị giá tính thuế trên tờ khai làm giá hàng</MenuItem>
            <MenuItem value="INVOICE">Trị giá hóa đơn × tỷ giá của ngày tờ khai</MenuItem>
          </TextField>
          <FormControlLabel control={<Checkbox size="small" checked={vatCreditable}
            onChange={e=>setVatCreditable(e.target.checked)}/>}
            label="VAT nhập khẩu được khấu trừ (không tính vào giá vốn)"/>
          <Chip color="primary" label={`Giá hàng đã gồm thuế: ${fmt(totals.landedCash)} VND (${totals.validLanded}/${results.length} dòng)`}/>
          <Chip label={`Giá vốn dự kiến: ${fmt(totals.landedCost)} VND (${totals.validLanded}/${results.length})`}/>
        </Stack>
        <Alert severity="info">
          Đơn giá VND tính từ số lượng gốc và hệ số quy đổi sang đơn vị kho, dùng thuế đã khai
          hoặc kịch bản FTA bạn chủ động xác nhận. Khi chọn hóa đơn ngoại tệ, phải nhập
          tỷ giá áp dụng ở thời điểm đăng ký tờ khai {date||''}.
          Trị giá tính thuế HQ có thể khác giá mua/giá vốn thực tế do điều chỉnh CIF;
          nếu dùng làm cơ sở giá hàng, kết quả chỉ là tạm tính. Phí vận chuyển/thông quan
          chưa có trong tờ khai phải nhập riêng cho từng dòng.
        </Alert>
        <TableContainer sx={{maxHeight:430,border:'1px solid',borderColor:'divider'}}>
          <Table stickyHeader size="small" sx={{minWidth:2250}}>
            <TableHead><TableRow>
              <TableCell sx={{minWidth:245}}>Dòng / HS / Tên hàng</TableCell>
              <TableCell sx={{minWidth:160}}>SL × đơn giá hóa đơn · Trị giá gốc</TableCell>
              <TableCell sx={{minWidth:175}}>Trị giá tính thuế NK gốc / điều chỉnh (VND)</TableCell>
              <TableCell sx={{minWidth:170}}>Thuế NK/VAT đã khai gốc</TableCell>
              <TableCell sx={{minWidth:115}}>Thuế suất cơ sở</TableCell>
              <TableCell sx={{minWidth:180}}>FTA có C/O (giả định)</TableCell>
              <TableCell sx={{minWidth:120}}>VAT (%)</TableCell>
              <TableCell sx={{minWidth:155}}>TTĐB + BVMT (VND)</TableCell>
              <TableCell sx={{minWidth:155}}>Vận chuyển, thông quan, phí khác (VND)</TableCell>
              <TableCell sx={{minWidth:165}}>Đơn giá VND gồm thuế / đv khai</TableCell>
              <TableCell sx={{minWidth:185}}>Giá vốn VND / đơn vị kho</TableCell>
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
                      r.tariff.message||statusLabel[r.tariff.status]||'Đang tra HS…'}
                    {r.tariff.status==='OK'&&r.tariff.matchMethod==='NORMALIZED_EIGHT_DIGITS'&&
                      <Typography variant="caption" display="block" color="info.main">
                        HS trong Portal: {r.tariff.storedHsCode} (đã chuẩn hóa thành {r.tariff.hsCode})
                      </Typography>}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" display="block">
                    {fmt(r.item.quantity)} × {fmt(r.item.unitPrice)} {r.sourceCurrency}
                  </Typography>
                  <Typography fontWeight={700}>
                    {fmt(r.item.invoiceValue??r.invoiceValue)} {r.sourceCurrency}
                  </Typography>
                  {r.item.invoiceValue!=null&&r.invoiceValue!=null&&
                    Math.abs(Number(r.item.invoiceValue)-r.invoiceValue)>0.02&&
                    <Typography variant="caption" color="warning.main">
                      Lệch SL × đơn giá: {fmt(r.invoiceValue)} {r.sourceCurrency}
                    </Typography>}
                </TableCell>
                <TableCell>
                  <TextField size="small" fullWidth
                    value={r.edit.customsValue??(r.item.importTaxableValueVnd==null?'':
                      formatVnNumber(Number(r.item.importTaxableValueVnd),2))}
                    placeholder={r.customsValue!=null?fmt(r.customsValue):'Nhập trị giá'}
                    helperText={r.edit.customsValue!==undefined?'Giá trị tạm điều chỉnh':
                      r.item.importTaxableValueVnd!=null?'Tờ khai gốc · VND':
                        'Ước từ hóa đơn × tỷ giá (chưa xác minh)'}
                    onChange={e=>change(r.index,{customsValue:e.target.value})}/>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" display="block">
                    NK: {fmt(r.item.importTaxAmountVnd)} VND ({r.item.importTaxRate??'—'}%)
                    {r.item.importTariffCode?' · mã '+r.item.importTariffCode:''}
                  </Typography>
                  <Typography variant="caption" display="block">
                    VAT: {fmt(r.item.vatAmountVnd)} VND ({r.item.vatRate??'—'}%)
                  </Typography>
                  <Typography variant="caption" display="block">
                    Giá VAT gốc: {fmt(r.item.vatTaxableValueVnd)} VND
                  </Typography>
                </TableCell>
                <TableCell>
                  {r.baseline==null||r.baseline===''?'—':String(r.baseline)+'%'}
                  <Typography variant="caption" display="block">{withoutCo==='DECLARED'?'Gốc tờ khai':withoutCo}</Typography>
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
                    label={r.item.vatRate!=null?'Gốc tờ khai: '+r.item.vatRate+'%':
                      r.tariff.vat?'Biểu: '+r.tariff.vat+'%':'Chưa có mức VAT'}
                    placeholder={String(r.item.vatRate??r.tariff.vat??'Nhập %')}
                    onChange={e=>change(r.index,{vatOverride:e.target.value})}
                    error={r.edit.vatOverride!==undefined&&r.edit.vatOverride!==''&&ratePercent(r.edit.vatOverride)===null}
                    helperText="Tự đối chiếu 5/8/10%"/>
                </TableCell>
                <TableCell><TextField size="small" value={r.edit.extraTaxes??'0'} fullWidth
                  onChange={e=>change(r.index,{extraTaxes:e.target.value})}
                  helperText="Chỉ nhập khi có phát sinh"/></TableCell>
                <TableCell><TextField size="small" value={r.edit.localCosts??'0'} fullWidth
                  onChange={e=>change(r.index,{localCosts:e.target.value})}
                  helperText="Phân bổ riêng từng dòng"/></TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    {fmtUnit(r.appliedLanded?.declaredUnitIncludingVatVnd)} VND/{r.item.unit||'đv'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Cả dòng: {fmt(r.appliedLanded?.totalIncludingVatVnd)} VND
                  </Typography>
                  <Typography variant="caption" display="block">
                    Trước VAT: {fmtUnit(r.appliedLanded?.declaredUnitBeforeVatVnd)} VND/đv
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    {fmtUnit(r.appliedLanded?.stockUnitInventoryCostVnd)} VND/đv kho
                  </Typography>
                  <Typography variant="caption" display="block">
                    {vatCreditable?'Đã loại VAT đủ điều kiện khấu trừ':'Đang gồm cả VAT nhập khẩu'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    SL kho: {fmt(r.appliedLanded?.stockQuantity)}
                  </Typography>
                  {r.originalAmounts&&<Typography variant="caption" color="info.main" display="block">
                    Thuế tính từ số tiền gốc trên tờ khai
                  </Typography>}
                </TableCell>
                <TableCell>
                  {r.baselineTax?<>
                    <Typography variant="body2">NK: {fmt(r.baselineTax.duty)}</Typography>
                    <Typography variant="body2">VAT: {fmt(r.baselineTax.vatAmount)}</Typography>
                    <Typography fontWeight={700}>{fmt(r.baselineTax.totalTax)}</Typography>
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
          <Chip color="primary" label={`Giá gồm tất cả thuế: ${fmt(totals.landedCash)} VND (${totals.validLanded}/${results.length})`}/>
          <Chip label={`Giá vốn dự kiến: ${fmt(totals.landedCost)} VND (${totals.validLanded}/${results.length})`}/>
          <Chip label={`Theo mức cơ sở: ${fmt(totals.noCo)} VND (${totals.validNoCo}/${results.length})`}/>
          <Chip label={`Có C/O giả định: ${fmt(totals.withCo)} VND (${totals.validFta}/${results.length})`}/>
          <Chip color="success" label={`Đã chọn áp dụng: ${fmt(totals.actual)} VND (${totals.validActual}/${results.length})`}/>
        </Stack>
        {totals.validLanded<results.length&&<Alert severity="warning">
          Chỉ tính được giá nhập kho VND cho {totals.validLanded}/{results.length} dòng.
          Kiểm tra giá gốc, số lượng, hệ số quy đổi, thuế suất/tiền thuế và tỷ giá
          lịch sử nếu dùng giá hóa đơn; không được coi số tổng chưa đủ dòng là tổng thực tế.
        </Alert>}
        {totals.estimatedValuations>0&&<Alert severity="info">
          Có {totals.estimatedValuations} dòng chưa có trị giá tính thuế gốc từ file hoặc do người dùng nhập.
          Giá trị được ước tính từ đơn giá hóa đơn và tỷ giá (nếu có), có thể thiếu CIF,
          điều chỉnh trị giá, thuế TTĐB/BVMT và các khoản cộng/trừ. Tổng thuế chỉ cộng
          các dòng tính được; không phải số thuế nộp chính thức.
        </Alert>}
        <Typography variant="caption" color="text.secondary">
          Giá tính VAT nhập khẩu trên tờ khai khác với trị giá hóa đơn. Số liệu gốc được
          giữ nguyên để đối chiếu; tính lại FTA/VAT chỉ là kịch bản, không thay đổi
          chứng từ đã khai. Tỷ giá phải lấy theo quy định hải quan tại thời điểm đăng ký; FTA tính theo năm,
          C/O và điều kiện cụ thể; biểu thuế không chứng minh xuất xứ. Bảng này chỉ
          dùng đối chiếu và không thay đổi dữ liệu VAT đang lưu trong phiếu nhập kho.
          Giá nhập kho VND là phép tính trước khi xác nhận, chưa được ghi tự động
          thành đơn giá tồn kho hoặc giá trị kế toán. Chỉ loại VAT khỏi giá vốn khi
          doanh nghiệp đủ điều kiện khấu trừ thuế đầu vào.
        </Typography>
      </Stack>
    </AccordionDetails>
  </Accordion>
}
