import test from 'node:test'
import assert from 'node:assert/strict'
import {qrCropRegions,enhanceQrPixels,medianGreen3x3} from '../src/utils/qrImageRecovery.js'

test('QR recovery never crops outside uploaded mobile photo',()=>{
  for (const [width,height] of [[1152,1536],[3024,4032],[4032,3024],[300,300],[80,240]]){
    const regions=qrCropRegions(width,height)
    assert.equal(regions.length,3)
    for(const r of regions){
      const w=r.width||r.size,h=r.height||r.size
      assert.ok(r.x>=0&&r.y>=0)
      assert.ok(w>0&&h>0)
      assert.ok(r.x+w<=width)
      assert.ok(r.y+h<=height)
    }
  }
})

test('red-channel contrast enhances dark QR modules on cyan ID background',()=>{
  const width=16,height=16,data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4
    const dark=x<8&&y<8
    data[p]=dark?27:175
    data[p+1]=dark?35:208
    data[p+2]=dark?40:218
    data[p+3]=255
  }
  const image={width,height,data}
  const processed=enhanceQrPixels(image,'red-contrast')
  assert.equal(processed,image)
  assert.ok(data[0]<data[(15*width+15)*4])
  assert.equal(data[0],data[1])
  assert.equal(data[1],data[2])
  assert.equal(data[3],255)
})

test('local red-channel threshold preserves dark modules and bright background',()=>{
  const width=40,height=40,data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4
    const module=x>=12&&x<28&&y>=12&&y<28
    data[p]=module?40:190
    data[p+1]=module?47:215
    data[p+2]=module?60:222
    data[p+3]=255
  }
  enhanceQrPixels({width,height,data},'red-adaptive')
  const pixel=(x,y)=>data[(y*width+x)*4]
  assert.equal(pixel(20,20),0)
  assert.equal(pixel(0,0),255)
  assert.equal(pixel(38,38),255)
})

test('invalid dimensions produce no recovery regions',()=>{
  assert.deepEqual(qrCropRegions(0,300),[])
  assert.deepEqual(qrCropRegions(100,0),[])
})

test('median green 3x3 removes isolated overprint noise without hard binarization',()=>{
  const width=5,height=5,data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4
    const green=x===2&&y===2?255:42
    data[p]=238                  // red is not the chosen channel
    data[p+1]=green              // green retains the printed QR contrast
    data[p+2]=175
    data[p+3]=255
  }
  const image={width,height,data}
  const result=medianGreen3x3(image)
  assert.equal(result,image)
  // Isolated bright pixel is removed by median, not kept as QR data.
  const center=(2*width+2)*4
  assert.equal(data[center],42)
  assert.equal(data[center+1],42)
  assert.equal(data[center+2],42)
  assert.equal(data[center+3],255)
  // Output has grayscale levels, NOT black/white-only thresholding.
  assert.notEqual(data[center],0)
  assert.notEqual(data[center],255)
})

test('green median filter preserves solid dark modules and light background',()=>{
  const width=9,height=9,data=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4
    data[p]=200
    data[p+1]=x>=3&&x<=5&&y>=3&&y<=5?18:182
    data[p+2]=250
    data[p+3]=255
  }
  medianGreen3x3({width,height,data})
  const value=(x,y)=>data[(y*width+x)*4]
  assert.equal(value(4,4),18)
  assert.equal(value(0,0),182)
  assert.equal(value(8,8),182)
})
