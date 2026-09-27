import test from 'node:test'
import assert from 'node:assert/strict'
import { receivingDefaults, lineCalc, hasLineInput } from '../src/features/inventory/invoiceEntry.js'
const material={id:'milk',unit:'ml'}
test('BOM pack conversion preserves invoice total and ignores recipe quantity',()=>{
 const defaults=receivingDefaults(material,null,[],[{material:{id:'milk'},warehouseUnit:'hộp',bomUnitPerWarehouseUnit:1000,qtyPerUnit:40}])
 assert.equal(defaults.warehouseImportUnit,'hộp')
 const calc=lineCalc({...defaults,warehouseImportQuantity:3,warehouseImportUnitPrice:32000})
 assert.equal(calc.bomQty,3000);assert.equal(calc.bomUnitPrice,32);assert.equal(calc.total,96000)
 assert.equal(receivingDefaults(material,null,[],[{materialId:'milk',qtyPerUnit:40}]).bomUnitPerWarehouseUnit,1)
})
test('warehouse and currency scope prevent copying the wrong price',()=>{
 const rows=[{materialId:'milk',warehouseId:'a',warehouseImportUnit:'hộp',bomUnitPerWarehouseUnit:1000,warehouseImportUnitPrice:30000,currency:'VND'},
 {materialId:'milk',warehouseId:'b',warehouseImportUnit:'thùng',bomUnitPerWarehouseUnit:12000,warehouseImportUnitPrice:12,currency:'USD'}]
 assert.equal(receivingDefaults(material,{id:'a'},rows).warehouseImportUnitPrice,30000)
 assert.equal(receivingDefaults(material,{id:'b'},rows).warehouseImportUnitPrice,'')
})
test('conflicting configured packs require a choice; base unit remains available',()=>{
 const defaults=receivingDefaults(material,null,[],[{materialId:'milk',warehouseUnit:'hộp',bomUnitPerWarehouseUnit:1000},{materialId:'milk',warehouseUnit:'hộp',bomUnitPerWarehouseUnit:180}])
 assert.equal(defaults.warehouseImportUnit,'');assert.equal(defaults.bomUnitPerWarehouseUnit,'')
 assert.equal(defaults.options.length,3)
 assert.equal(lineCalc({warehouseImportQuantity:1,warehouseImportUnitPrice:100,bomUnitPerWarehouseUnit:0}).bomQty,null)
})
test('remembered warehouse and batch do not turn a blank trailing row into a saved item',()=>{
 const blank={material:null,materialInput:'',warehouse:{id:'a'},batchNo:'B1',warehouseImportQuantity:'',notes:''}
 assert.equal(hasLineInput(blank),false)
 assert.equal(hasLineInput({...blank,materialInput:'milk'}),true)
})
