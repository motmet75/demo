import test from 'node:test'
import assert from 'node:assert/strict'
import {ratePercent,estimateCustomsTax} from '../src/utils/customsTariffCalc.js'

test('valid HS tariff rates do not interpret special symbols or blanks as zero',()=>{
  assert.equal(ratePercent('0%'),0)
  assert.equal(ratePercent('7,5'),7.5)
  assert.equal(ratePercent('10'),10)
  assert.equal(ratePercent('*'),null)
  assert.equal(ratePercent('Q'),null)
  assert.equal(ratePercent(''),null)
  assert.equal(ratePercent('101'),null)
})

test('customs taxable base includes import duty and additional excise/environmental tax',()=>{
  const r=estimateCustomsTax({
    quantity:10,unitPrice:100,currency:'USD',exchangeRate:'25.000',
    taxableValueVnd:'30.000.000',noCoRate:'10',ftaRate:'0',vatRate:'8',
    extraTaxesVnd:'500.000'
  })
  assert.equal(r.invoiceValue,1000)
  assert.equal(r.customsValue,30000000)
  assert.equal(r.valuationSource,'CUSTOMS_ENTERED')
  assert.equal(r.noCo.duty,3000000)
  assert.equal(r.noCo.vatBase,33500000)
  assert.equal(r.noCo.vatAmount,2680000)
  assert.equal(r.withCo.duty,0)
  assert.equal(r.withCo.vatBase,30500000)
  assert.equal(r.withCo.vatAmount,2440000)
  assert.equal(r.noCo.totalTax,6180000)
  assert.equal(r.withCo.totalTax,2940000)
})

test('estimates missing customs valuation from invoice and explicitly entered exchange rate',()=>{
  const r=estimateCustomsTax({
    quantity:2,unitPrice:100,currency:'USD',exchangeRate:'25.000',
    taxableValueVnd:'',noCoRate:'5',ftaRate:'0',vatRate:'10',extraTaxesVnd:'0'
  })
  assert.equal(r.customsValue,5000000)
  assert.equal(r.valuationSource,'ESTIMATED_INVOICE')
  assert.equal(r.noCo.duty,250000)
  assert.equal(r.noCo.vatAmount,525000)
})

test('does not fabricate VND, duty or VAT where FX or tariff missing',()=>{
  const missingFx=estimateCustomsTax({
    quantity:3,unitPrice:100,currency:'USD',exchangeRate:'',
    taxableValueVnd:'',noCoRate:'10',ftaRate:'5',vatRate:'8',extraTaxesVnd:'0'
  })
  assert.equal(missingFx.customsValue,null)
  assert.equal(missingFx.noCo,null)
  const unknownVat=estimateCustomsTax({
    quantity:1,unitPrice:100,currency:'VND',exchangeRate:'',
    taxableValueVnd:'',noCoRate:'10',ftaRate:'0',vatRate:'KCT',extraTaxesVnd:'0'
  })
  assert.equal(unknownVat.noCo,null)
  assert.equal(unknownVat.withCo,null)
})


test('2021 original XLS customs tax base reproduces 22% import duty and 10% VAT for comparison',()=>{
  // Source: declaration 103847745300, row <01>, 19/02/2021.
  // Original VAT amount is 846,891 VND as rounded by customs; calculations
  // can show 846,891.06, but never overwrite the original imported amount.
  const r=estimateCustomsTax({
    quantity:400,unitPrice:0.7575,currency:'USD',exchangeRate:'',
    taxableValueVnd:'6.941.730',noCoRate:22,ftaRate:0,vatRate:10,
    extraTaxesVnd:0
  })
  assert.equal(r.invoiceValue,303)
  assert.equal(r.customsValue,6941730)
  assert.equal(r.valuationSource,'CUSTOMS_ENTERED')
  assert.equal(r.noCo.duty,1527180.6)
  assert.equal(r.noCo.vatBase,8468910.6)
  assert.equal(r.noCo.vatAmount,846891.06)
  assert.equal(r.withCo.duty,0)
  assert.equal(r.withCo.vatBase,6941730)
  assert.equal(r.withCo.vatAmount,694173)
})

