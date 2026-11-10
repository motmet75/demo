/**
 * Draft currency/price changes in the existing inventory XLSX patch format.
 * "RELABEL": correct an incorrectly labelled currency without changing the
 * numeric amount; "CONVERT": USD <-> VND using an operator-reviewed VND/USD
 * exchange rate. Other denominations require a row-by-row Excel correction.
 * No live FX is invented or applied to historical inventory automatically.
 */
const val = value => String(value ?? '').trim().toUpperCase()
const numeric = value => value != null && String(value).trim() !== '' &&
  Number.isFinite(Number(value)) && Number(value) >= 0
const round6 = n => Math.round((n + Number.EPSILON) * 1e6) / 1e6

export function draftInventoryCurrencyPatch(rows, {
  targetCurrency = '', mode = 'KEEP', usdToVnd = ''
} = {}) {
  const target = val(targetCurrency)
  const exchangeRate = Number(usdToVnd)
  const problems = []
  const updates = rows.map((row,index) => {
    const old = val(row.currency)
    const inventoryId = String(row.inventoryId || row.id || '')
    const originalPrice = row.unitPrice == null ? '' : Number(row.unitPrice)
    let price = originalPrice
    let currency = old
    let confirm = ''
    if (target && target !== old) {
      if (!numeric(originalPrice)) {
        problems.push(`Dòng ${index+1}: ${inventoryId} chưa có đơn giá gốc hợp lệ.`)
      } else if (mode === 'RELABEL') {
        currency = target
        confirm = 'YES'
      } else if (mode === 'CONVERT') {
        if (!(exchangeRate > 0) || !Number.isFinite(exchangeRate)) {
          problems.push('Tỷ giá USD→VND phải là số dương khi quy đổi.')
        } else if (old === 'USD' && target === 'VND') {
          price = round6(originalPrice * exchangeRate)
          currency = target
          confirm = 'YES'
        } else if (old === 'VND' && target === 'USD') {
          price = round6(originalPrice / exchangeRate)
          currency = target
          confirm = 'YES'
        } else {
          problems.push(`Dòng ${index+1}: Không có quy tắc quy đổi ${old||'chưa rõ'} → ${target}. Cần xử lý riêng.`)
        }
      } else if (mode !== 'KEEP') {
        problems.push('Phương thức cập nhật tiền tệ không hợp lệ.')
      }
    }
    if (price !== '' && !Number.isFinite(price)) problems.push(`Dòng ${index+1}: giá không hợp lệ.`)
    return {
      id: inventoryId,
      material_code: String(row.materialCode || ''),
      material_name: String(row.materialName || ''),
      warehouse_code: String(row.warehouseCode || ''),
      batch_no: String(row.batchNo || ''),
      original_currency: old,
      original_unit_price: originalPrice,
      currency,
      unit_price: price,
      confirm_currency_change: confirm
    }
  })
  return {updates, problems: [...new Set(problems)]}
}
