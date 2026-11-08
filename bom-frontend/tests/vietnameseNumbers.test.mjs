import test from 'node:test'
import assert from 'node:assert/strict'
import {formatVnNumber, parseMachineNumber, parseVnNumber} from '../src/utils/vietnameseNumbers.js'

test('Vietnamese selling price uses dots for thousands and comma for decimals',()=>{
  assert.equal(parseVnNumber('17.361.111,11'),17361111.11)
  assert.equal(parseVnNumber('1.000.000'),1000000)
  assert.equal(parseVnNumber('2.184.970,281'),2184970.281)
  assert.equal(parseVnNumber('8,5'),8.5)
  assert.equal(parseVnNumber('0'),0)
  assert.equal(formatVnNumber(17361111.11,2),'17.361.111,11')
  assert.equal(formatVnNumber(2184970.281,3),'2.184.970,281')
})

test('reject US-style pasted prices instead of silently misreading them',()=>{
  assert.equal(Number.isNaN(parseVnNumber('17,361,111.11')),true)
  assert.equal(Number.isNaN(parseVnNumber('17.361.111.11')),true)
  assert.equal(Number.isNaN(parseVnNumber('12.34')),true)
  assert.equal(Number.isNaN(parseVnNumber('')),true)
  assert.equal(Number.isNaN(parseVnNumber('abc')),true)
})

test('Invoice Desk normalized decimal input converts to Vietnamese display',()=>{
  const fromOcr='17361111.11'
  const display=formatVnNumber(parseMachineNumber(fromOcr),2)
  assert.equal(display,'17.361.111,11')
  assert.equal(parseVnNumber(display),17361111.11)
  assert.equal(parseMachineNumber('1.000,50'),NaN)
  assert.equal(parseMachineNumber('17.361.111,11'),NaN)
})
