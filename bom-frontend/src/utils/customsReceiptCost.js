import {parseVnNumber} from './vietnameseNumbers.js'

const num = raw => {
  if (raw == null || raw === '') return null
  // Server-provided values are JSON numbers (US decimal), input fields are
  // localized Vietnamese text (comma decimal or dot thousands).
  return typeof raw === 'number' ? raw : parseVnNumber(raw)
}

export function previewCustomsReceiptCost(item, row) {
  if (!item || !row) return null
  const qty = num(item.quantity)
  const ratio = num(row.conversionRatio)
  const stockQty = qty * ratio
  const customVnd = row.goodsValueVnd === '' ? null : num(row.goodsValueVnd)
  const taxableVnd = num(item.importTaxableValueVnd)
  const fx = row.historicalFxRate === '' ? null : num(row.historicalFxRate)
  const invoice = num(item.invoiceValue) ??
    (num(item.unitPrice) == null ? null : qty * num(item.unitPrice))
  const source = customVnd != null ? 'REVIEWED_VND' :
    fx > 0 && invoice != null ? 'INVOICE_HISTORICAL_FX' : 'CUSTOMS_TAXABLE_PROXY'
  const goodsVnd = customVnd ??
    (fx > 0 && invoice != null ? invoice * fx : taxableVnd)
  const dutyAmount = num(item.importTaxAmountVnd)
  const dutyRate = num(item.importTaxRate)
  const duty = dutyAmount ?? (taxableVnd != null && dutyRate != null ?
    taxableVnd*dutyRate/100 : dutyRate===0 ? 0 : null)
  const rate = num(row.vatRate)
  const originalRate = num(item.vatRate)
  const vatAmount = num(item.vatAmountVnd)
  const vatTaxableBase = num(item.vatTaxableValueVnd)
  const vat = vatAmount != null && originalRate != null && rate===originalRate ?
    vatAmount : vatTaxableBase != null && rate != null ?
      Math.round(vatTaxableBase*rate)/100 : rate===0 ? 0 : null
  const extras = num(row.additionalCostsVnd)
  if (!(qty>0) || !(stockQty>0) || !(goodsVnd>0) || duty==null ||
      vat==null || extras==null || extras<0 || rate==null || rate<0 || rate>100) return null
  const totalIncludingVatVnd = goodsVnd + duty + extras + vat
  const total = totalIncludingVatVnd - (row.importVatCreditable ? vat : 0)
  if (![totalIncludingVatVnd,total].every(Number.isFinite)) return null
  return {
    goodsVnd, goodsSource:source, foreignInvoiceValue:invoice,
    importDutyVnd:duty, importVatVnd:vat, importVatRate:rate, additionalCostsVnd:extras,
    totalIncludingVatVnd,
    unitIncludingVatVnd:totalIncludingVatVnd/stockQty,
    totalVnd:total,stockQuantity:stockQty,stockUnitVnd:total/stockQty,
    declaredUnitVnd:total/qty
  }
}
