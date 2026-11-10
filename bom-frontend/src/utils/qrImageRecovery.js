/**
 * Privacy-preserving QR photo recovery. All image operations happen locally
 * in the browser. Nothing is uploaded, logged, or persisted. Generated image
 * candidates are for html5-qrcode.scanFile() to retry a blurry/low-contrast
 * printed QR (e.g. over a cyan guilloche background).
 */
const bound = (n,min,max) => Math.max(min,Math.min(max,n))

export function qrCropRegions(width,height) {
  if (!(width>0&&height>0)) return []
  const min=Math.min(width,height)
  const square=(cx,cy,ratio)=>{
    const size=Math.min(min,Math.max(1,Math.round(min*ratio)))
    return {
      x:bound(Math.round(cx-size/2),0,Math.max(0,width-size)),
      y:bound(Math.round(cy-size/2),0,Math.max(0,height-size)),
      size
    }
  }
  return [
    {name:'upper',...square(width*.5,height*.36,.7)},
    {name:'center',...square(width*.5,height*.5,.84)},
    {name:'full',x:0,y:0,width,height}
  ]
}

/** Overwrite RGBA in-place; histogram-based levels preserve more information
 * than immediately turning a faint QR into hard black/white blocks. */
export function enhanceQrPixels(imageData, method='red-contrast') {
  const {data,width,height}=imageData
  if (!data||!width||!height) return imageData
  const count=width*height
  const shades=new Uint8Array(count)
  const hist=new Uint32Array(256)
  const red=method.startsWith('red')
  for(let i=0;i<count;i++){
    const p=i*4
    const v=red?data[p]:Math.round(data[p]*.299+data[p+1]*.587+data[p+2]*.114)
    shades[i]=v;hist[v]++
  }
  let lo=0,hi=255,seen=0
  for(let i=0;i<256;i++){seen+=hist[i];if(seen>=count*.03){lo=i;break}}
  seen=0
  for(let i=255;i>=0;i--){seen+=hist[i];if(seen>=count*.03){hi=i;break}}
  const scale=255/Math.max(20,hi-lo)
  const binary=method.endsWith('adaptive')
  let integral=null
  if(binary){
    integral=new Float64Array((width+1)*(height+1))
    for(let y=1;y<=height;y++){
      let sum=0
      for(let x=1;x<=width;x++){
        sum+=shades[(y-1)*width+x-1]
        integral[y*(width+1)+x]=integral[(y-1)*(width+1)+x]+sum
      }
    }
  }
  const radius=16
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const idx=y*width+x,p=idx*4
      let out
      if(binary){
        const x0=Math.max(0,x-radius),y0=Math.max(0,y-radius)
        const x1=Math.min(width,x+radius+1),y1=Math.min(height,y+radius+1)
        const stride=width+1
        const sum=integral[y1*stride+x1]-integral[y0*stride+x1]
          -integral[y1*stride+x0]+integral[y0*stride+x0]
        const mean=sum/((x1-x0)*(y1-y0))
        out=shades[idx]<mean-9?0:255
      }else{
        out=bound(Math.round((shades[idx]-lo)*scale),0,255)
      }
      data[p]=out;data[p+1]=out;data[p+2]=out;data[p+3]=255
    }
  }
  return imageData
}

async function loadLocalImage(file){
  const url=URL.createObjectURL(file)
  const img=new Image()
  try{
    await new Promise((resolve,reject)=>{
      img.onload=resolve
      img.onerror=()=>reject(new Error('Không mở được định dạng ảnh QR này. Hãy chọn JPG/PNG.'))
      img.src=url
    })
    return img
  }finally{
    URL.revokeObjectURL(url)
  }
}

function canvasFile(canvas,name){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob) resolve(new File([blob],name,{type:'image/png'}))
      else reject(new Error('Không thể xử lý ảnh QR trong trình duyệt.'))
    },'image/png')
  })
}

/**
 * Generate one temporary candidate at a time to avoid retaining multiple
 * large photos in mobile Safari memory. The original file is tried first
 * by the caller. Yields variants with their own white quiet-zone margins.
 */
export async function* qrRecoveryCandidates(file){
  if(!file||!file.type?.startsWith('image/'))return
  const img=await loadLocalImage(file)
  const width=img.naturalWidth,height=img.naturalHeight
  if(!width||!height) return
  const plans=qrCropRegions(width,height)
  const attempts=[
    [plans[0],'raw'],             // top-centre: usual ID photo layout
    [plans[0],'red-contrast'],    // cyan background: red channel often helps
    [plans[0],'red-adaptive'],    // local threshold for uneven lighting
    [plans[1],'red-contrast'],    // centred photo
    [plans[1],'luma-contrast'],
    [plans[2],'red-contrast'],    // image where QR is not centred
  ]
  for(let i=0;i<attempts.length;i++){
    const [region,mode]=attempts[i]
    const srcW=region.width||region.size
    const srcH=region.height||region.size
    const targetScale=Math.min(1.25,1300/Math.max(srcW,srcH))
    const targetW=Math.max(1,Math.round(srcW*targetScale))
    const targetH=Math.max(1,Math.round(srcH*targetScale))
    const padding=24
    const canvas=document.createElement('canvas')
    canvas.width=targetW+padding*2
    canvas.height=targetH+padding*2
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)break
    ctx.fillStyle='#fff'
    ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.drawImage(img,region.x,region.y,srcW,srcH,padding,padding,targetW,targetH)
    if(mode!=='raw'){
      const pixels=ctx.getImageData(padding,padding,targetW,targetH)
      enhanceQrPixels(pixels,mode)
      ctx.putImageData(pixels,padding,padding)
    }
    const candidate=await canvasFile(canvas,`cccd-qr-retry-${i+1}.png`)
    canvas.width=0;canvas.height=0
    yield {file:candidate,description:region.name+'/'+mode}
  }
}
