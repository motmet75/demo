import {parseMachineNumber, parseVnNumber} from './vietnameseNumbers.js'

// Do not coerce blank, asterisks, quotas or non-ad-valorem tariff symbols to 0%.
export function ratePercent(value) {
  if (typeof value==='number') return Number.isFinite(value)&&value>=0&&value<=100?value:null
  const text=String(value??'').trim().replace('%','')
  if(!/^\d+(?:[.,]\d{1,3})?$/.test(text))return null
  const valueNumber=Number(text.replace(',','.'))
  return Number.isFinite(valueNumber)&&valueNumber<=100?valueNumber:null
}
export function localMoney(value) {
  if(value===''||value==null)return null
  const n=parseVnNumber(value)
  return Number.isFinite(n)&&n>=0?n:null
}
const money2=v=>Math.round((v+Number.EPSILON)*100)/100
export function estimateCustomsTax({
  quantity,unitPrice,currency,exchangeRate,taxableValueVnd,
  noCoRate,ftaRate,vatRate,extraTaxesVnd=0
}) {
  const qty=parseMachineNumber(quantity)
  const price=parseMachineNumber(unitPrice)
  const invoiceValue=Number.isFinite(qty)&&Number.isFinite(price)?qty*price:null
  const explicit=localMoney(taxableValueVnd)
  const fx=localMoney(exchangeRate)
  const customsValue=explicit??(
    invoiceValue==null?null:String(currency||'').toUpperCase()==='VND'
      ?invoiceValue:(fx!=null&&fx>0?invoiceValue*fx:null))
  const vat=ratePercent(vatRate)
  const importRate=ratePercent(noCoRate)
  const fta=ratePercent(ftaRate)
  const extra=localMoney(extraTaxesVnd)
  const calc=rate=>{
    if(customsValue==null||rate==null||vat==null||extra==null)return null
    const duty=money2(customsValue*rate/100)
    // VAT base also includes special consumption and environmental tax if applicable.
    const vatBase=customsValue+duty+extra
    const vatAmount=money2(vatBase*vat/100)
    return {customsValue:money2(customsValue),duty,vatAmount,
      totalTax:money2(duty+vatAmount+extra),vatBase:money2(vatBase)}
  }
  return {invoiceValue,customsValue,valuationSource:explicit!=null?'CUSTOMS_ENTERED':'ESTIMATED_INVOICE',
    noCo:calc(importRate),withCo:calc(fta)}
}
