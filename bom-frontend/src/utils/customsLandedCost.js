import {parseMachineNumber} from './vietnameseNumbers.js'
import {localMoney} from './customsTariffCalc.js'

const round = (value, digits) => {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Pre-posting customs landed cost preview. The goods base can be the invoice
 * converted at the historical exchange rate or, as a *clearly disclosed proxy*,
 * the original customs taxable value. Neither is silently equated with a
 * posted inventory purchase cost.
 *
 * VAT treatment is explicit: if import VAT is creditable, its amount is
 * excluded from the indicative inventory cost but remains in cash-out.
 */
export function estimateCustomsLandedCost({
  declaredQuantity, stockConversionRatio = 1,
  goodsValueVnd, importDutyVnd, importVatVnd,
  otherImportTaxesVnd = 0, extraLocalCostsVnd = 0,
  importVatCreditable = false
}) {
  const qty = parseMachineNumber(declaredQuantity)
  const ratio = parseMachineNumber(stockConversionRatio)
  const goods = localMoney(goodsValueVnd)
  const duty = localMoney(importDutyVnd)
  const vat = localMoney(importVatVnd)
  const otherTaxes = localMoney(otherImportTaxesVnd)
  const localCosts = localMoney(extraLocalCostsVnd)
  if (!(qty > 0) || !(ratio > 0) ||
      !Number.isFinite(qty * ratio) ||
      [goods,duty,vat,otherTaxes,localCosts].some(x => x == null)) return null
  const stockQty = qty * ratio
  const beforeVat = goods + duty + otherTaxes + localCosts
  const cashOut = beforeVat + vat
  const inventoryCost = importVatCreditable ? beforeVat : cashOut
  if (![beforeVat,cashOut,inventoryCost].every(Number.isFinite)) return null
  return {
    declaredQuantity: qty,
    stockQuantity: stockQty,
    goodsValueVnd: round(goods,2),
    dutyVnd: round(duty,2),
    importVatVnd: round(vat,2),
    otherImportTaxesVnd: round(otherTaxes,2),
    extraLocalCostsVnd: round(localCosts,2),
    totalBeforeVatVnd: round(beforeVat,2),
    totalIncludingVatVnd: round(cashOut,2),
    indicativeInventoryCostVnd: round(inventoryCost,2),
    declaredUnitBeforeVatVnd: round(beforeVat/qty,4),
    declaredUnitIncludingVatVnd: round(cashOut/qty,4),
    declaredUnitInventoryCostVnd: round(inventoryCost/qty,4),
    stockUnitBeforeVatVnd: round(beforeVat/stockQty,4),
    stockUnitIncludingVatVnd: round(cashOut/stockQty,4),
    stockUnitInventoryCostVnd: round(inventoryCost/stockQty,4)
  }
}
