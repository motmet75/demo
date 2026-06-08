const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'

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

export function printOrderReceipt(order) {
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

  const isQrUrl   = order.paymentQr?.startsWith('https://')
  const qrSrc     = order.paymentQr
    ? (isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`)
    : null

  const paymentSection = order.paymentMethod === 'BANK_QR' ? `
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
