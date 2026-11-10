import {previewCustomsReceiptCost} from './customsReceiptCost.js'
import {parseVnNumber,parseMachineNumber} from './vietnameseNumbers.js'

/**
 * Build a read-only Excel-ready list from the uploaded customs declaration and
 * the current pre-posting review form. No stock transaction is performed.
 * Missing amounts remain blank; never interpret a missing duty/VAT as 0%.
 */
export function prepareCustomsPriceExport({
  declaration, rows = [], materials = [], warehouses = [],
  declarationNumber = '', declarationDate = '', defaultCurrency = 'VND'
}) {
  const items = Array.isArray(declaration?.items) ? declaration.items : []
  const byLine = new Map(rows.map(row => [String(row.lineIndex), row]))
  const byMaterial = new Map(materials.map(m => [String(m.id), m]))
  const byWarehouse = new Map(warehouses.map(w => [String(w.id), w]))

  const records = items.map((item, i) => {
    const row = byLine.get(String(item.lineIndex)) || rows[i] || null
    const sourceCurrency = String(item.currency || defaultCurrency || '').toUpperCase()
    let cost = null
    let warning = ''
    if (!row) {
      warning = 'Thiếu dòng đối chiếu'
    } else {
      cost = previewCustomsReceiptCost(item, row)
      if (!cost) warning = 'Thiếu trị giá VND, thuế NK, VAT NK, tỷ giá hoặc hệ số quy đổi'
    }
    const material = row ? byMaterial.get(String(row.materialId)) : null
    const warehouse = row ? byWarehouse.get(String(row.warehouseId)) : null
    const quantity = item.quantity == null ? '' :
      (typeof item.quantity === 'number' ? item.quantity : parseMachineNumber(item.quantity))
    const stockQuantity = cost?.stockQuantity ?? (
      quantity !== '' && row && Number.isFinite(parseVnNumber(row.conversionRatio)) ?
        quantity * parseVnNumber(row.conversionRatio) : ''
    )
    const sourceName = cost?.goodsSource === 'INVOICE_HISTORICAL_FX' ?
      'Hóa đơn x tỷ giá lịch sử' :
      cost?.goodsSource === 'REVIEWED_VND' ? 'Giá trị VND đã nhập tay' :
      cost?.goodsSource === 'CUSTOMS_TAXABLE_PROXY' ?
        'TẠM TÍNH theo trị giá tính thuế HQ' : ''
    return {
      'STT': i + 1,
      'Số tờ khai': String(declarationNumber || declaration?.declarationNumber || ''),
      'Ngày tờ khai': String(declarationDate || declaration?.declarationDate || ''),
      'Mã HS': String(item.hsCode || ''),
      'Tên hàng theo tờ khai': String(item.description || ''),
      'Xuất xứ': String(item.originCountry || ''),
      'Mã vật tư kho': String(row?.newMaterial ?
        (row.newMaterialCode || '') : (material?.materialCode || '')),
      'Tên vật tư kho': String(row?.newMaterial ?
        (row.newMaterialName || '') : (material?.materialName || '')),
      'Kho': String(warehouse?.name || warehouse?.code || ''),
      'Lô / Batch': String(row?.batchNo || ''),
      'Số lượng khai báo': quantity,
      'ĐVT khai báo': String(item.unit || ''),
      'Hệ số đổi sang ĐVT kho': row && Number.isFinite(parseVnNumber(row.conversionRatio)) ?
        parseVnNumber(row.conversionRatio) : '',
      'Số lượng kho': stockQuantity,
      'ĐVT kho': String(row?.newMaterial ? row.newMaterialUnit || '' : material?.unit || item.unit || ''),
      'Đơn giá hóa đơn gốc': item.unitPrice == null ? '' : Number(item.unitPrice),
      'Trị giá hóa đơn gốc': item.invoiceValue != null ?
        Number(item.invoiceValue) : (item.unitPrice != null && quantity !== '' ?
          Number(item.unitPrice) * quantity : ''),
      'Tiền tệ gốc': sourceCurrency,
      'Tỷ giá lịch sử VND/ngoại tệ': row?.historicalFxRate &&
        Number.isFinite(parseVnNumber(row.historicalFxRate)) ?
          parseVnNumber(row.historicalFxRate) : '',
      'Cơ sở giá VND': sourceName,
      'Trị giá tính thuế HQ VND': item.importTaxableValueVnd == null ?
        '' : Number(item.importTaxableValueVnd),
      'Giá trị hàng quy đổi VND': cost?.goodsVnd ?? '',
      'Thuế suất NK gốc (%)': item.importTaxRate == null ? '' : Number(item.importTaxRate),
      'Thuế nhập khẩu VND': cost?.importDutyVnd ?? '',
      'VAT nhập khẩu (%)': cost?.importVatRate ?? '',
      'VAT nhập khẩu VND': cost?.importVatVnd ?? '',
      'VAT NK được khấu trừ': row?.importVatCreditable ? 'Có' : 'Không',
      'Chi phí phân bổ VND': cost?.additionalCostsVnd ?? '',
      'Tổng chi phí đã gồm VAT VND': cost?.totalIncludingVatVnd ?? '',
      'Đơn giá VND/đơn vị kho (gồm VAT)': cost?.unitIncludingVatVnd ?? '',
      'Tổng giá vốn nhập VND': cost?.totalVnd ?? '',
      'Đơn giá VND/đơn vị khai báo': cost?.declaredUnitVnd ?? '',
      'Đơn giá VND/đơn vị kho': cost?.stockUnitVnd ?? '',
      'Tình trạng': cost ? (
        cost.goodsSource === 'CUSTOMS_TAXABLE_PROXY' ?
          'TẠM TÍNH - cần kiểm tra cơ sở trị giá hàng' : 'ĐÃ TÍNH - cần đối chiếu chứng từ'
      ) : warning
    }
  })
  const priced = records.filter(row => row['Đơn giá VND/đơn vị kho'] !== '')
  const total = priced.reduce((sum, row) =>
    sum + row['Tổng giá vốn nhập VND'], 0)
  return {
    records,
    complete: records.length > 0 && priced.length === records.length,
    calculatedCount: priced.length,
    missingCount: records.length - priced.length,
    calculatedTotalVnd: total
  }
}
