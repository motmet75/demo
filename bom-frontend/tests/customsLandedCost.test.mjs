import test from 'node:test'
import assert from 'node:assert/strict'
import {estimateCustomsLandedCost} from '../src/utils/customsLandedCost.js'

const historical = {
  declaredQuantity: 400,
  stockConversionRatio: '1',
  goodsValueVnd: 6941730,
  importDutyVnd: 1527180.6,
  importVatVnd: 846891,
  otherImportTaxesVnd: 0,
  extraLocalCostsVnd: 0
}

test('2021 customs line 39249090: real declared tax amounts produce all-in VND unit price', () => {
  const r = estimateCustomsLandedCost(historical)
  assert.equal(r.goodsValueVnd, 6941730)
  assert.equal(r.totalBeforeVatVnd, 8468910.6)
  assert.equal(r.totalIncludingVatVnd, 9315801.6)
  assert.equal(r.declaredUnitIncludingVatVnd, 23289.504)
  assert.equal(r.stockUnitIncludingVatVnd, 23289.504)
  assert.equal(r.indicativeInventoryCostVnd, 9315801.6)
})

test('input VAT creditable: show cash paid including VAT but exclude it from indicative inventory cost', () => {
  const r = estimateCustomsLandedCost({
    ...historical, importVatCreditable: true
  })
  assert.equal(r.totalIncludingVatVnd, 9315801.6)
  assert.equal(r.indicativeInventoryCostVnd, 8468910.6)
  assert.equal(r.stockUnitInventoryCostVnd, 21172.2765)
})

test('recalculates per stock unit with Vietnamese stock conversion ratio', () => {
  const r = estimateCustomsLandedCost({
    ...historical, stockConversionRatio: '2', importVatCreditable: true
  })
  assert.equal(r.declaredQuantity, 400)
  assert.equal(r.stockQuantity, 800)
  assert.equal(r.stockUnitIncludingVatVnd, 11644.752)
  assert.equal(r.stockUnitInventoryCostVnd, 10586.1383)
})

test('includes separately allocated excise, environmental and logistics costs without double-counting VAT', () => {
  const r = estimateCustomsLandedCost({
    ...historical,otherImportTaxesVnd:'500.000',extraLocalCostsVnd:'200.000'
  })
  assert.equal(r.totalBeforeVatVnd, 9168910.6)
  assert.equal(r.totalIncludingVatVnd, 10015801.6)
  assert.equal(r.stockUnitIncludingVatVnd, 25039.504)
})

test('FTA scenario uses changed duty and VAT, not the original declared amounts', () => {
  const r = estimateCustomsLandedCost({
    ...historical,importDutyVnd:0,importVatVnd:694173
  })
  assert.equal(r.totalIncludingVatVnd, 7635903)
  assert.equal(r.stockUnitIncludingVatVnd, 19089.7575)
})

test('missing customs VAT amount, goods value or invalid stock conversion must not appear as zero', () => {
  assert.equal(estimateCustomsLandedCost({...historical, importVatVnd:null}),null)
  assert.equal(estimateCustomsLandedCost({...historical, goodsValueVnd:null}),null)
  assert.equal(estimateCustomsLandedCost({...historical, stockConversionRatio:'0'}),null)
  assert.equal(estimateCustomsLandedCost({...historical, extraLocalCostsVnd:'10,000.00'}),null)
})
