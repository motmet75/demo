import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareCustomsPriceExport} from '../src/utils/customsPriceExport.js'

const original = {
  lineIndex:0,hsCode:'39249090',description:'Giá treo đồ bằng nhựa',
  quantity:400,unit:'PCE',originCountry:'CN',currency:'USD',
  unitPrice:0.7575,invoiceValue:303,importTaxableValueVnd:6941730,
  importTaxAmountVnd:1527180.6,importTaxRate:22,
  vatTaxableValueVnd:8468910.6,vatAmountVnd:846891,vatRate:10
}
const row={
  lineIndex:0,conversionRatio:'1',vatRate:'10',materialId:'mat-1',
  goodsValueVnd:'',historicalFxRate:'',additionalCostsVnd:'0',
  importVatCreditable:false
}
const assemble=(items,rows)=>prepareCustomsPriceExport({
  declaration:{declarationNumber:'103847745300',items},
  rows,
  materials:[{id:'mat-1',materialCode:'MAT-001',materialName:'Giá treo',unit:'PCE'}],
  defaultCurrency:'VND'
})

test('export keeps original USD and produces VND per stock item using exact customs taxes',()=>{
  const result=assemble([original],[row])
  assert.equal(result.complete,true)
  assert.equal(result.calculatedCount,1)
  assert.equal(result.calculatedTotalVnd,9315801.6)
  assert.equal(result.records[0]['Số tờ khai'],'103847745300')
  assert.equal(result.records[0]['Mã HS'],'39249090')
  assert.equal(result.records[0]['Tiền tệ gốc'],'USD')
  assert.equal(result.records[0]['Đơn giá hóa đơn gốc'],0.7575)
  assert.equal(result.records[0]['Thuế nhập khẩu VND'],1527180.6)
  assert.equal(result.records[0]['VAT nhập khẩu VND'],846891)
  assert.equal(result.records[0]['Đơn giá VND/đơn vị kho'],23289.504)
  assert.equal(result.records[0]['Đơn giá VND/đơn vị kho (gồm VAT)'],23289.504)
  assert.match(result.records[0]['Tình trạng'],/TẠM TÍNH/)
})

test('creditable import VAT affects warehouse cost but not cash tax column',()=>{
  const result=assemble([original],[{...row,importVatCreditable:true,conversionRatio:'2'}])
  assert.equal(result.records[0]['Số lượng kho'],800)
  assert.equal(result.records[0]['VAT nhập khẩu VND'],846891)
  assert.equal(result.records[0]['Tổng giá vốn nhập VND'],8468910.6)
  assert.equal(result.records[0]['Đơn giá VND/đơn vị kho (gồm VAT)'],9315801.6/800)
  assert.equal(result.records[0]['Đơn giá VND/đơn vị kho'],8468910.6/800)
})

test('missing VAT and import duty do not become zero or fabricated VND unit prices',()=>{
  const incomplete={...original,importTaxAmountVnd:null,importTaxableValueVnd:null,
    importTaxRate:null,vatAmountVnd:null,vatTaxableValueVnd:null}
  const result=assemble([original,incomplete],
    [row,{...row,lineIndex:1}])
  assert.equal(result.complete,false)
  assert.equal(result.calculatedCount,1)
  assert.equal(result.missingCount,1)
  assert.equal(result.records[1]['Đơn giá VND/đơn vị kho'],'')
  assert.match(result.records[1]['Tình trạng'],/Thiếu/)
})

test('CAD remains CAD and historical FX can be used instead of customs proxy',()=>{
  const item={...original,invoiceValue:200,unitPrice:100,quantity:2,currency:'CAD'}
  const result=assemble([item],[{...row,historicalFxRate:'19.000'}])
  assert.equal(result.records[0]['Tiền tệ gốc'],'CAD')
  assert.equal(result.records[0]['Tỷ giá lịch sử VND/ngoại tệ'],19000)
  assert.equal(result.records[0]['Giá trị hàng quy đổi VND'],3800000)
  assert.equal(result.records[0]['Cơ sở giá VND'],'Hóa đơn x tỷ giá lịch sử')
})
