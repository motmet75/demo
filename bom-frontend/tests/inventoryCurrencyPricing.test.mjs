import test from 'node:test'
import assert from 'node:assert/strict'
import {draftInventoryCurrencyPatch} from '../src/utils/inventoryCurrencyPatch.js'
import {resolveMenuInventoryVndBase,calculateBulkMenuPrice} from '../src/utils/bulkMenuPricing.js'

const uuid='550e8400-e29b-41d4-a716-446655440000'
const stock=(currency,unitPrice)=>({
  id:uuid,inventoryId:uuid,materialCode:'MAT-A',
  materialName:'Household goods',warehouseCode:'WH1',batchNo:'B01',
  currency,unitPrice
})

test('bulk price template preserves USD currency and price when no change requested',()=>{
  const {updates,problems}=draftInventoryCurrencyPatch([stock('USD',12.5)])
  assert.deepEqual(problems,[])
  assert.equal(updates[0].currency,'USD')
  assert.equal(updates[0].unit_price,12.5)
  assert.equal(updates[0].confirm_currency_change,'')
})

test('USD to VND multiplies the explicitly reviewed VND/USD rate',()=>{
  const {updates,problems}=draftInventoryCurrencyPatch([stock('USD',12.5)],
    {targetCurrency:'VND',mode:'CONVERT',usdToVnd:'25400'})
  assert.deepEqual(problems,[])
  assert.equal(updates[0].currency,'VND')
  assert.equal(updates[0].unit_price,317500)
  assert.equal(updates[0].original_currency,'USD')
  assert.equal(updates[0].original_unit_price,12.5)
  assert.equal(updates[0].confirm_currency_change,'YES')
})

test('VND to USD divides and rounds without overwriting warehouse originals',()=>{
  const {updates,problems}=draftInventoryCurrencyPatch([stock('VND',317500)],
    {targetCurrency:'USD',mode:'CONVERT',usdToVnd:'25400'})
  assert.deepEqual(problems,[])
  assert.equal(updates[0].unit_price,12.5)
  assert.equal(updates[0].original_unit_price,317500)
  assert.equal(updates[0].currency,'USD')
})

test('relabel explicitly preserves numeric price without auto conversion',()=>{
  const {updates,problems}=draftInventoryCurrencyPatch([stock('USD',25000)],
    {targetCurrency:'VND',mode:'RELABEL'})
  assert.deepEqual(problems,[])
  assert.equal(updates[0].unit_price,25000)
  assert.equal(updates[0].currency,'VND')
  assert.equal(updates[0].confirm_currency_change,'YES')
})

test('cannot auto-convert CAD with an unrelated USD exchange rate',()=>{
  const {updates,problems}=draftInventoryCurrencyPatch([stock('CAD',10)],
    {targetCurrency:'VND',mode:'CONVERT',usdToVnd:'25000'})
  assert.ok(problems.length)
  assert.equal(updates[0].currency,'CAD')
})

test('cannot auto-convert without USD/VND exchange rate',()=>{
  const {problems}=draftInventoryCurrencyPatch([stock('USD',10)],
    {targetCurrency:'VND',mode:'CONVERT',usdToVnd:''})
  assert.ok(problems.length)
})

test('menu cost auto recognizes inventory USD and converts using reviewed FX',()=>{
  const usd=stock('USD',12.5)
  assert.equal(resolveMenuInventoryVndBase(usd,{}).status,'MISSING_FX')
  const base=resolveMenuInventoryVndBase(usd,{USD:25400})
  assert.equal(base.status,'CONVERTED')
  assert.equal(base.value,317500)
  assert.equal(calculateBulkMenuPrice(base.value,30,'1000','up'),413000)
})

test('menu auto accepts VND cost and does not convert original CDS foreign figures',()=>{
  const item={...stock('VND',350000),customsForeignCurrency:'USD',
    customsForeignUnitPrice:10}
  const result=resolveMenuInventoryVndBase(item,{USD:999999})
  assert.equal(result.status,'VND')
  assert.equal(result.value,350000)
})

test('menu auto recognizes CAD with a distinct manual rate',()=>{
  const base=resolveMenuInventoryVndBase(stock('CAD',20),{USD:25000,CAD:18000})
  assert.equal(base.status,'CONVERTED')
  assert.equal(base.value,360000)
})

test('missing currency does not secretly default to USD or VND',()=>{
  const base=resolveMenuInventoryVndBase(stock('',100),{USD:25000})
  assert.equal(base.status,'MISSING_PRICE_OR_CURRENCY')
  assert.equal(base.value,null)
})
