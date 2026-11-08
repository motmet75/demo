import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeMaterialDescription, matchMaterialByDescription
} from '../src/utils/materialBulkMatching.js'

test('Vietnamese names match across accents, case, spacing, and punctuation',()=>{
  const catalog=[{id:'a',materialName:'Động cơ thủy Suzuki - 250 HP',unit:'cái'}]
  const result=matchMaterialByDescription('  DONG CO THUY suzuki 250 hp ',catalog,'cái')
  assert.equal(result.status,'matched')
  assert.equal(result.material.id,'a')
  assert.equal(normalizeMaterialDescription('  Động  cơ  '),'dong co')
})

test('partial descriptions never select unrelated material',()=>{
  const catalog=[{id:'a',materialName:'Suzuki DF250TXS',unit:'cái'}]
  assert.equal(matchMaterialByDescription('Suzuki DF250',catalog).status,'missing')
})

test('same exact name across multiple materials is ambiguous',()=>{
  const catalog=[
    {id:'a',materialName:'Nhựa ABS',unit:'kg'},
    {id:'b',materialName:'Nhựa ABS',unit:'kg'}
  ]
  assert.equal(matchMaterialByDescription('NHUA ABS',catalog,'kg').status,'ambiguous')
})

test('a different base unit disambiguates duplicate names',()=>{
  const catalog=[
    {id:'a',materialName:'Đường trắng',unit:'kg'},
    {id:'b',materialName:'Duong trang',unit:'thùng'}
  ]
  const result=matchMaterialByDescription('ĐƯỜNG TRẮNG',catalog,'thùng')
  assert.equal(result.status,'matched')
  assert.equal(result.material.id,'b')
})

test('unknown and empty descriptions remain unselected',()=>{
  assert.equal(matchMaterialByDescription('',[]).status,'empty')
  assert.equal(matchMaterialByDescription('Mặt hàng mới',[]).status,'missing')
})

test('multiple batches with the same material name are ambiguous for stock out',()=>{
  const available=[
    {id:'lot1',materialName:'Mô tơ',unit:'cái',batchNo:'A'},
    {id:'lot2',materialName:'Mô tơ',unit:'cái',batchNo:'B'}
  ]
  assert.equal(matchMaterialByDescription('Mo to',available,'cái').status,'ambiguous')
})
