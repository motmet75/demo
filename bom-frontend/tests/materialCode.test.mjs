import test from 'node:test'
import assert from 'node:assert/strict'
import {generateMaterialCode} from '../src/utils/materialCode.js'

test('material code suggests MAT- plus 20 uppercase hex characters',()=>{
  const code=generateMaterialCode([],
    ()=>'12345678-1234-4567-89ab-cdef12345678')
  assert.equal(code,'MAT-123456781234456789AB')
  assert.match(code,/^MAT-[A-F0-9]{20}$/)
})

test('generator skips an existing code ignoring case and duplicate draft row',()=>{
  const ids=[
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ]
  let attempts=0
  const code=generateMaterialCode(['mat-aaaaaaaaaaaaaaaaaaaa'],
    ()=>ids[attempts++])
  assert.equal(attempts,2)
  assert.equal(code,'MAT-BBBBBBBBBBBBBBBBBBBB')
})

test('fails instead of suggesting a known duplicate after repeated collisions',()=>{
  assert.throws(()=>generateMaterialCode(
    ['MAT-AAAAAAAAAAAAAAAAAAAA'],
    ()=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),/Không thể tạo mã vật tư không trùng/)
})
