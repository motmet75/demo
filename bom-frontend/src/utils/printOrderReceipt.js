const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'

export function printWalkUpQr(seq, qrBase64) {
  if (!qrBase64) return
  const numLine = seq != null
    ? `<div class="num">#${seq}</div><div class="sub">Your order number</div>`
    : `<div class="sub-big">Scan to Order</div>`

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Order QR${seq != null ? ' #' + seq : ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    width: 260px; margin: 0 auto; padding: 20px 14px;
    text-align: center; color: #111;
  }
  .num     { font-size: 88px; font-weight: 900; line-height: 1; letter-spacing: -4px; color: #1976d2; }
  .sub     { font-size: 13px; color: #666; margin-bottom: 14px; font-weight: 500; }
  .sub-big { font-size: 22px; font-weight: 800; margin-bottom: 14px; }
  .qr-box  { display: inline-block; padding: 10px; border: 2px solid #111; border-radius: 10px; }
  img      { width: 210px; height: 210px; display: block; }
  .hint    { font-size: 12px; color: #888; margin-top: 12px; }
  .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
  @media print { @page { margin: 0; } }
</style>
</head>
<body>
  ${numLine}
  <div class="qr-box"><img src="data:image/png;base64,${qrBase64}" alt="QR" /></div>
  <div class="hint">Scan QR code to view menu &amp; order</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=300,height=550')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 800) }
}

export function printOrderTag(order, qrBase64) {
  if (!order) return
  const num   = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const label = order.tableName
    ? `Table ${order.tableName}`
    : order.fulfillmentType === 'DELIVERY' ? 'Delivery'
    : order.customerName || 'Pickup'

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Tag ${num}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    width: 240px; margin: 0 auto; padding: 20px 12px;
    text-align: center; color: #111;
  }
  .num   { font-size: 80px; font-weight: 900; line-height: 1; letter-spacing: -3px; }
  .label { font-size: 16px; font-weight: 600; color: #444; margin: 6px 0 14px; }
  img    { width: 200px; height: 200px; display: block; margin: 0 auto; border-radius: 6px; }
  .hint  { font-size: 11px; color: #888; margin-top: 10px; }
  .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
  @media print { @page { margin: 0; } }
</style>
</head>
<body>
  <div class="num">${num}</div>
  <div class="label">${label}</div>
  <div class="divider"></div>
  ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" alt="QR" />` : ''}
  <div class="hint">Scan to track your order</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=280,height=500')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 800) }
}

function parseOpts(str) {
  if (!str) return null
  try {
    const obj = JSON.parse(str)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
  } catch { return null }
}

function parseOptsObj(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

export function printCupLabels(order) {
  if (!order?.items?.length) return
  const num = order.orderNumber ? `#${order.orderNumber}` : order.orderCode

  const labelHtml = order.items.flatMap(item => {
    const qty = Number(item.quantity) || 1
    const opts = parseOptsObj(item.selectedOptions)
    const optLines = Object.entries(opts)
      .map(([k, v]) => `<div class="opt"><span class="opt-key">${k}:</span> <span class="opt-val">${Array.isArray(v) ? v.join(', ') : v}</span></div>`)
      .join('')
    const noteHtml = item.itemNotes
      ? `<div class="note">⚠ ${item.itemNotes}</div>`
      : ''
    return Array.from({ length: qty }, (_, i) => `
      <div class="label">
        <div class="order-num">${num}</div>
        <div class="item-name">${item.modelName}</div>
        ${optLines}
        ${noteHtml}
        ${qty > 1 ? `<div class="counter">${i + 1} / ${qty}</div>` : ''}
      </div>
    `)
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Cup Labels ${num}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    background: #fff;
  }
  .label {
    width: 220px;
    min-height: 90px;
    border: 1.5px solid #111;
    border-radius: 6px;
    padding: 8px 10px 6px;
    margin: 6px;
    display: inline-block;
    vertical-align: top;
    page-break-inside: avoid;
  }
  .order-num {
    font-size: 22px;
    font-weight: 900;
    color: #1976d2;
    line-height: 1;
    letter-spacing: -1px;
    border-bottom: 1px dashed #ccc;
    padding-bottom: 4px;
    margin-bottom: 4px;
  }
  .item-name {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.2;
    margin-bottom: 4px;
    color: #111;
  }
  .opt {
    font-size: 12px;
    color: #333;
    line-height: 1.4;
  }
  .opt-key { color: #666; }
  .opt-val { font-weight: 700; color: #111; }
  .note {
    font-size: 12px;
    font-weight: 700;
    color: #c62828;
    margin-top: 4px;
    padding: 2px 4px;
    background: #fff3e0;
    border-radius: 3px;
    border-left: 3px solid #ff6f00;
  }
  .counter {
    font-size: 10px;
    color: #aaa;
    text-align: right;
    margin-top: 4px;
  }
  @media print {
    @page { margin: 6mm; }
    body { width: 100%; }
  }
</style>
</head>
<body>
  ${labelHtml}
</body>
</html>`

  const win = window.open('', '_blank', 'width=520,height=600')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 1000) }
}

export function printOrderReceipt(order, trackingQrBase64 = null) {
  if (!order) return

  const num     = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const time    = order.createdAt
    ? new Date(order.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  const tableLine = order.tableName
    ? `<div class="row"><span>Table</span><span>${order.tableName}</span></div>`
    : order.fulfillmentType === 'DELIVERY'
      ? `<div class="row"><span>Delivery</span><span>${order.deliveryAddress || ''}</span></div>`
      : `<div class="row"><span>Type</span><span>Pickup</span></div>`
  const customerLine = order.customerName
    ? `<div class="row"><span>Customer</span><span>${order.customerName}${order.customerPhone ? ' · ' + order.customerPhone : ''}</span></div>`
    : ''

  const itemsHtml = (order.items || []).map(item => {
    const optsStr = parseOpts(item.selectedOptions)
    const noteStr = item.itemNotes
    return `
      <div class="row item-row">
        <span class="item-name">${item.quantity}× ${item.modelName}</span>
        <span class="item-price">${fmt(item.lineTotal)}</span>
      </div>
      ${optsStr ? `<div class="indent grey">${optsStr}</div>` : ''}
      ${noteStr ? `<div class="indent grey italic">Note: ${noteStr}</div>` : ''}
    `
  }).join('')

  const deliveryRow = order.deliveryFee && Number(order.deliveryFee) > 0
    ? `<div class="row"><span>Delivery fee</span><span>${fmt(order.deliveryFee)}</span></div>`
    : ''

  const isQrUrl    = order.paymentQr?.startsWith('https://')
  const qrSrc      = order.paymentQr
    ? (isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`)
    : null
  const bankCode   = isQrUrl ? order.paymentQr.split('/image/')[1]?.split('-')[0] : null
  const bankLogoTag = bankCode
    ? `<div class="center" style="margin-bottom:6px"><img src="https://img.vietqr.io/img/${bankCode}.png" height="36" style="max-width:120px;object-fit:contain" /></div>`
    : ''

  const paymentSection = order.paymentMethod === 'BANK_QR' ? `
    ${bankLogoTag}
    <div class="center bold" style="margin-bottom:6px">Scan to Pay</div>
    ${qrSrc ? `<div class="center"><img src="${qrSrc}" width="190" height="190" style="display:block;margin:0 auto" /></div>` : ''}
    <div class="center grey" style="margin-top:6px">Transfer exact amount</div>
    <div class="center bold">Ref: ${order.orderCode}</div>
  ` : `<div class="center bold">Payment: Cash on delivery</div>`

  const notesSection = order.notes
    ? `<div class="divider"></div><div class="grey italic" style="font-size:11px">Note: ${order.notes}</div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Receipt ${num}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    width: 300px;
    margin: 0 auto;
    padding: 14px 10px;
    color: #111;
  }
  .center   { text-align: center; }
  .bold     { font-weight: bold; }
  .grey     { color: #555; }
  .italic   { font-style: italic; }
  .indent   { padding-left: 12px; font-size: 11px; color: #666; }
  .title    { font-size: 16px; font-weight: 900; letter-spacing: 2px; }
  .big-num  { font-size: 48px; font-weight: 900; text-align: center; line-height: 1.1; }
  .divider  { border-top: 1px dashed #666; margin: 7px 0; }
  .row      { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .item-row { margin-top: 4px; }
  .item-name { flex: 1; padding-right: 8px; }
  .item-price { text-align: right; white-space: nowrap; }
  .total-row { font-weight: 900; font-size: 15px; margin-top: 4px; }
  .footer   { text-align: center; font-style: italic; color: #555; margin-top: 6px; font-size: 12px; }
  @media print { @page { margin: 0; } body { padding: 8px 6px; } }
</style>
</head>
<body>
  <div class="center title">ORDER RECEIPT</div>
  <div class="divider"></div>

  <div class="big-num">${num}</div>
  <div class="center grey" style="font-size:12px">${order.orderCode}</div>
  <div class="center grey" style="font-size:12px;margin-top:2px">${time}</div>

  <div class="divider"></div>

  ${tableLine}
  ${customerLine}

  <div class="divider"></div>

  ${itemsHtml}

  <div class="divider"></div>

  ${deliveryRow}
  <div class="row total-row">
    <span>TOTAL</span>
    <span>${fmt(order.totalAmount)}</span>
  </div>

  ${notesSection}

  <div class="divider"></div>

  ${paymentSection}

  <div class="divider"></div>
  <div class="footer">★ Thank you! See you again ★</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=340,height=720')
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 1000) }
}
