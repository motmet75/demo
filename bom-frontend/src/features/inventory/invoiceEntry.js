const number = value => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value)
const sameMaterial = (row, material) => String(row.materialId ?? row.material_id ?? row.material?.id ?? '') === String(material.id)

// A recipe quantity is not a unit conversion. Only explicit configuration is used.
export function receivingDefaults(material, warehouse, inventory = [], boms = [], currency = 'VND') {
  if (!material) return { options: [], warehouseImportUnit: '', bomUnitPerWarehouseUnit: '', warehouseImportUnitPrice: '' }
  const base = String(material.unit || '').trim()
  const stock = inventory.filter(row => sameMaterial(row, material) && (!warehouse || String(row.warehouseId ?? row.warehouse?.id) === String(warehouse.id)))
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0))
  const configured = new Map()
  const add = (unit, ratio, source) => {
    unit = String(unit || '').trim(); ratio = number(ratio)
    if (!unit || ratio == null || ratio <= 0 || (unit === base && ratio !== 1)) return
    const key = `${unit}:${ratio}`
    if (!configured.has(key)) configured.set(key, { key, unit, ratio, source })
  }
  stock.forEach(row => add(row.warehouseImportUnit, row.bomUnitPerWarehouseUnit, 'Kho'))
  add(material.warehouseImportUnit, material.bomUnitPerWarehouseUnit, 'Vật tư')
  boms.filter(row => sameMaterial(row, material)).forEach(row => add(row.warehouseUnit, row.bomUnitPerWarehouseUnit, 'BOM'))
  const choices = [...configured.values()]
  const selected = choices.length === 1 ? choices[0] : choices.length === 0 && base ? { unit: base, ratio: 1, source: 'Vật tư' } : null
  if (base) add(base, 1, 'Vật tư')
  const priceFor = (unit, ratio) => {
    const priced = stock.find(row => row.currency === currency && (row.warehouseImportUnit || row.unit) === unit && Number(row.bomUnitPerWarehouseUnit || 1) === Number(ratio))
    return number(priced?.warehouseImportUnitPrice) ?? (number(priced?.unitPrice) == null ? '' : Number(priced.unitPrice) * ratio)
  }
  return {
    options: [...configured.values()],
    warehouseImportUnit: selected?.unit || '',
    bomUnitPerWarehouseUnit: selected?.ratio ?? '',
    warehouseImportUnitPrice: selected ? priceFor(selected.unit, selected.ratio) : '',
    priceFor,
  }
}

export function lineCalc(line) {
  const warehouseQty = number(line.warehouseImportQuantity)
  const warehouseUnitPrice = number(line.warehouseImportUnitPrice)
  const ratio = number(line.bomUnitPerWarehouseUnit)
  const bomQty = warehouseQty !== null && ratio !== null && ratio > 0 ? warehouseQty * ratio : null
  const bomUnitPrice = warehouseUnitPrice !== null && ratio !== null && ratio > 0 ? warehouseUnitPrice / ratio : null
  const total = warehouseQty !== null && warehouseUnitPrice !== null ? warehouseQty * warehouseUnitPrice : 0
  return { warehouseQty, warehouseUnitPrice, ratio, bomQty, bomUnitPrice, total }
}

export const hasLineInput = line => Boolean(line.material || line.materialInput.trim() || line.warehouseImportQuantity !== '' || line.notes.trim())
