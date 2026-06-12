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

  const pw = Math.max(Math.round(screen.width * 0.5), 600)
  const ph = Math.min(Math.round(screen.height * 0.9), 900)
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=${Math.round((screen.width-pw)/2)},top=40`)
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

  const pw = Math.max(Math.round(screen.width * 0.5), 600)
  const ph = Math.min(Math.round(screen.height * 0.9), 900)
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=${Math.round((screen.width-pw)/2)},top=40`)
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

// Build a map: parentId (string) -> [child items]
function buildChildMap(items) {
  const map = {}
  for (const item of items) {
    if (item.parentItemId) {
      const key = String(item.parentItemId)
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
  }
  return map
}

export function printCupLabels(order) {
  if (!order?.items?.length) return
  const num = order.orderNumber ? `#${order.orderNumber}` : order.orderCode

  const allItems = order.items
  const childMap = buildChildMap(allItems)
  // Root items = items with no parent
  const rootItems = allItems.filter(item => !item.parentItemId)

  const labelHtml = rootItems.flatMap(item => {
    const qty = Number(item.quantity) || 1
    const opts = parseOptsObj(item.selectedOptions)
    const fmtOptV = v => Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? Object.entries(v).map(([lbl, qty]) => qty > 1 ? `${lbl}×${qty}` : lbl).join(', ') : v)
    const optParts = Object.entries(opts)
      .map(([k, v]) => `<span class="opt-key">${k}:</span> <span class="opt-val">${fmtOptV(v)}</span>`)
    const optLine = optParts.length > 0
      ? `<div class="opt-line">${optParts.join('<span class="opt-sep"> · </span>')}</div>`
      : ''
    const noteHtml = item.itemNotes
      ? `<div class="note">&#9888; ${item.itemNotes}</div>`
      : ''

    // Side / topping items — numbered list
    const children = childMap[String(item.id)] || []
    const sidesHtml = children.length > 0
      ? `<div class="sides-divider"></div>
         <div class="sides-header">+ Toppings / Sides</div>
         ${children.map((child, ci) => {
           const childQty = Number(child.quantity) || 1
           const childNote = child.itemNotes
             ? `<div class="child-note">&#9888; ${child.itemNotes}</div>`
             : ''
           return `<div class="side-row">
             <span class="side-num">${ci + 1}.</span>
             <span class="side-qty">${childQty}×</span>
             <span class="side-name">${child.modelName}</span>
           </div>${childNote}`
         }).join('')}`
      : ''

    return Array.from({ length: qty }, (_, i) => `
      <div class="label">
        <div class="label-header">
          <span class="order-num">${num}</span>
          ${qty > 1 ? `<span class="counter">${i + 1} / ${qty}</span>` : ''}
        </div>
        <div class="item-name">${item.modelName}</div>
        ${optLine}
        ${noteHtml}
        ${sidesHtml}
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
    width: 230px;
    border: 2px solid #111;
    border-radius: 8px;
    overflow: hidden;
    margin: 6px;
    display: inline-block;
    vertical-align: top;
    page-break-inside: avoid;
  }
  /* ── Header bar ── */
  .label-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1976d2;
    padding: 4px 8px;
  }
  .order-num {
    font-size: 20px;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .counter {
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    background: rgba(0,0,0,0.2);
    border-radius: 10px;
    padding: 1px 6px;
  }
  /* ── Main item body ── */
  .item-name {
    font-size: 16px;
    font-weight: 900;
    line-height: 1.2;
    color: #111;
    padding: 6px 10px 2px;
    letter-spacing: -0.2px;
  }
  .opt-line {
    font-size: 11px;
    color: #333;
    line-height: 1.5;
    padding: 2px 10px;
    word-break: break-word;
  }
  .opt-key { color: #777; }
  .opt-val { font-weight: 700; color: #111; }
  .opt-sep { color: #9ca3af; font-weight: 400; }
  .note {
    font-size: 11px;
    font-weight: 700;
    color: #b45309;
    margin: 4px 8px 0;
    padding: 3px 6px;
    background: #fff7ed;
    border-radius: 3px;
    border-left: 3px solid #f59e0b;
  }
  /* ── Side items section ── */
  .sides-divider {
    border-top: 1.5px dashed #9ca3af;
    margin: 6px 8px 0;
  }
  .sides-header {
    font-size: 10px;
    font-weight: 700;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 3px 10px 1px;
  }
  .side-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 1px 10px 1px 10px;
    margin-left: 14px;
    border-left: 2px solid #c7d2fe;
  }
  .side-num {
    font-size: 10px;
    font-weight: 700;
    color: #9ca3af;
    flex-shrink: 0;
    min-width: 14px;
  }
  .side-qty {
    font-size: 11px;
    font-weight: 900;
    color: #6366f1;
    flex-shrink: 0;
  }
  .side-name {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    flex: 1;
    word-break: break-word;
  }
  .child-note {
    font-size: 10px;
    color: #b45309;
    padding: 0 10px 0 20px;
    font-style: italic;
  }
  /* bottom padding */
  .label::after {
    content: '';
    display: block;
    height: 6px;
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

  const pw = Math.max(Math.round(screen.width * 0.5), 700)
  const ph = Math.min(Math.round(screen.height * 0.9), 900)
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=${Math.round((screen.width-pw)/2)},top=40`)
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 1000) }
}

// opts: { payQrUrl, unpaidTotal, tokenRef }
export function printCombinedReceipt(orders, opts = {}) {
  if (!orders?.length) return
  const { payQrUrl = null, unpaidTotal = null, tokenRef = '' } = opts
  const time = new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

  const activeOrders = orders.filter(o => o.status !== 'CANCELLED')
  let grandTotal  = 0
  let totalQr     = 0
  let totalCash   = 0

  const ordersHtml = activeOrders.map((order) => {
    const num      = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
    const allItems = order.items || []
    const childMap = buildChildMap(allItems)
    const roots    = allItems.filter(i => !i.parentItemId)

    const orderTotal = roots.reduce((s, item) => {
      const children  = childMap[String(item.id)] || []
      const parentQty = Number(item.quantity || 1)
      return s + Number(item.lineTotal || 0) + children.reduce((cs, c) => cs + Number(c.lineTotal || 0) * parentQty, 0)
    }, 0) + Number(order.deliveryFee || 0)
    grandTotal += orderTotal

    const isQr   = order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT'
    const isSplit = order.paymentMethod === 'SPLIT'
    const cashPortion = isSplit ? Number(order.splitCashAmount || 0) : isQr ? 0 : orderTotal
    const qrPortion   = isSplit ? orderTotal - cashPortion : isQr ? orderTotal : 0
    totalQr   += qrPortion
    totalCash += cashPortion

    const payBadge = isQr
      ? `<span class="pay-badge qr-badge">&#x1F4B3; ${isSplit ? 'Split' : 'QR'}</span>`
      : `<span class="pay-badge cash-badge">&#x1F4B5; Cash</span>`

    const itemsHtml = roots.map((item, idx) => {
      const children     = childMap[String(item.id)] || []
      const parentQty    = Number(item.quantity || 1)
      const fmtOptV3 = v => Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? Object.entries(v).map(([lbl, qty]) => qty > 1 ? `${lbl}×${qty}` : lbl).join(', ') : v)
      const opts_        = Object.entries(parseOpts(item.selectedOptions)).map(([k, v]) => `${k}: ${fmtOptV3(v)}`).join(' · ')
      const childrenHtml = children.map(child => {
        const effectiveQty = Number(child.quantity || 1) * parentQty
        return `<div class="row side-row">
          <span class="side-qty">${effectiveQty}&#215;</span>
          <span class="side-name">${child.modelName}</span>
          <span class="item-price">${fmt(Number(child.lineTotal || 0) * parentQty)}</span>
        </div>`
      }).join('')
      return `
        <div class="row item-row">
          <span class="row-num">${idx + 1}.</span>
          <span class="item-qty">${item.quantity}&#215;</span>
          <span class="item-name">${item.modelName}</span>
          <span class="item-price">${fmt(item.lineTotal)}</span>
        </div>
        ${opts_ ? `<div class="opts-inline grey">${opts_}</div>` : ''}
        ${childrenHtml}
      `
    }).join('')

    const tableInfo  = order.tableName ? `Table ${order.tableName}` : order.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Pickup'
    const noteHtml   = order.notes ? `<div class="order-note">&#9888; ${order.notes}</div>` : ''

    return `
      <div class="order-block">
        <div class="order-header">
          <span class="order-num">${num}</span>
          <span class="order-meta">${tableInfo}</span>
          ${payBadge}
          <span class="order-subtotal">${fmt(orderTotal)}</span>
        </div>
        ${itemsHtml}
        ${noteHtml}
      </div>
    `
  }).join('<div class="divider"></div>')

  // Payment summary section
  const hasQr   = totalQr > 0
  const hasCash = totalCash > 0
  const showQrImg = payQrUrl && hasQr

  const paymentSummary = `
    <div class="pay-summary">
      ${hasCash ? `<div class="row"><span>&#x1F4B5; Cash</span><span>${fmt(totalCash)}</span></div>` : ''}
      ${hasQr   ? `<div class="row"><span>&#x1F4B3; Bank Transfer (QR)</span><span>${fmt(unpaidTotal != null ? unpaidTotal : totalQr)}</span></div>` : ''}
    </div>
    ${showQrImg ? `
      <div class="divider"></div>
      <div class="center bold" style="margin-bottom:6px;font-size:13px">Scan to Pay — Bank Transfer</div>
      <div class="center">
        <img src="${payQrUrl}" width="200" height="200" style="display:block;margin:0 auto;border:2px solid #16a34a;border-radius:8px;padding:4px;background:#fff" />
      </div>
      <div class="center grey" style="margin-top:6px;font-size:11px">Transfer exact amount &bull; Ref: ${tokenRef || 'combined'}</div>
    ` : ''}
  `

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Combined Receipt</title>
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
  .center      { text-align: center; }
  .bold        { font-weight: bold; }
  .grey        { color: #555; }
  .title       { font-size: 16px; font-weight: 900; letter-spacing: 2px; }
  .divider     { border-top: 1px dashed #666; margin: 7px 0; }
  .row         { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 2px; }
  .item-row    { margin-top: 5px; gap: 3px; }
  .row-num     { font-size: 11px; color: #999; flex-shrink: 0; min-width: 16px; }
  .item-qty    { font-weight: 900; flex-shrink: 0; margin-right: 3px; }
  .item-name   { flex: 1; padding-right: 6px; font-weight: 700; }
  .item-price  { text-align: right; white-space: nowrap; flex-shrink: 0; }
  .opts-inline { padding-left: 20px; font-size: 11px; color: #666; margin-bottom: 1px; }
  .side-row    { margin-top: 2px; margin-left: 14px; border-left: 2px solid #c7d2fe; padding-left: 6px; gap: 3px; }
  .side-qty    { font-weight: 900; font-size: 11px; color: #6366f1; flex-shrink: 0; margin-right: 3px; }
  .side-name   { flex: 1; padding-right: 6px; font-size: 12px; color: #444; }
  .order-block  { margin-bottom: 6px; }
  .order-header { display: flex; align-items: center; gap: 4px; background: #f3f4f6; padding: 4px 6px; border-radius: 3px; margin-bottom: 4px; }
  .order-num    { font-size: 16px; font-weight: 900; min-width: 28px; }
  .order-meta   { flex: 1; font-size: 11px; color: #555; }
  .order-subtotal { font-weight: 900; font-size: 13px; white-space: nowrap; }
  .order-note   { font-size: 11px; color: #b45309; padding: 2px 0 0 16px; font-style: italic; }
  .pay-badge    { font-size: 10px; font-weight: 700; border-radius: 3px; padding: 1px 4px; white-space: nowrap; }
  .qr-badge     { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .cash-badge   { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
  .pay-summary  { margin: 6px 0; }
  .total-row    { font-weight: 900; font-size: 16px; margin-top: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; }
  .footer       { text-align: center; font-style: italic; color: #555; margin-top: 6px; font-size: 12px; }
  @media print { @page { margin: 0; } body { padding: 8px 6px; } }
</style>
</head>
<body>
  <div class="center title">COMBINED RECEIPT</div>
  <div class="divider"></div>
  <div class="center grey" style="font-size:12px">${time}</div>
  <div class="center grey" style="font-size:11px;margin-top:2px">${activeOrders.length} order${activeOrders.length !== 1 ? 's' : ''} combined</div>
  <div class="divider"></div>

  ${ordersHtml}

  <div class="divider"></div>
  <div class="total-row"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
  <div class="divider"></div>

  ${paymentSummary}

  <div class="divider"></div>
  <div class="footer">&#9733; Thank you! &#9733;</div>
</body>
</html>`

  const pw = Math.max(Math.round(screen.width * 0.5), 600)
  const ph = Math.min(Math.round(screen.height * 0.9), 960)
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=${Math.round((screen.width-pw)/2)},top=40`)
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

  // Build hierarchy for receipt: group children under parents
  const allItems = order.items || []
  const childMap = buildChildMap(allItems)
  const rootItems = allItems.filter(item => !item.parentItemId)

  const itemsHtml = rootItems.map((item, idx) => {
    const rowNum = idx + 1
    const opts = parseOptsObj(item.selectedOptions)
    const fmtOptV2 = v => Array.isArray(v) ? v.join(', ') : (typeof v === 'object' && v !== null ? Object.entries(v).map(([lbl, qty]) => qty > 1 ? `${lbl}×${qty}` : lbl).join(', ') : v)
    const optsInline = Object.entries(opts)
      .map(([k, v]) => `${k}: ${fmtOptV2(v)}`)
      .join(' · ')
    const children = childMap[String(item.id)] || []
    const parentQty = Number(item.quantity || 1)
    const childrenHtml = children.map((child, ci) => {
      const childOpts = parseOptsObj(child.selectedOptions)
      const childOptsInline = Object.entries(childOpts)
        .map(([k, v]) => `${k}: ${fmtOptV2(v)}`)
        .join(' · ')
      const effectiveQty   = Number(child.quantity || 1) * parentQty
      const effectiveTotal = Number(child.lineTotal || 0) * parentQty
      return `
        <div class="row side-row">
          <span class="side-num">${rowNum}.${ci + 1}</span>
          <span class="side-qty">${effectiveQty}&#215;</span>
          <span class="side-name">${child.modelName}</span>
          <span class="item-price">${fmt(effectiveTotal)}</span>
        </div>
        ${childOptsInline ? `<div class="child-opts grey">${childOptsInline}</div>` : ''}
        ${child.itemNotes ? `<div class="child-opts grey italic">&#9888; ${child.itemNotes}</div>` : ''}
      `
    }).join('')

    const subtotal = Number(item.lineTotal || 0)
      + children.reduce((s, c) => s + Number(c.lineTotal || 0) * parentQty, 0)
    const subtotalHtml = children.length > 0
      ? `<div class="row subtotal-row"><span class="subtotal-label">= subtotal</span><span class="subtotal-val">${fmt(subtotal)}</span></div>`
      : ''

    return `
      <div class="row item-row">
        <span class="row-num">${rowNum}.</span>
        <span class="item-qty">${item.quantity}&#215;</span>
        <span class="item-name">${item.modelName}</span>
        <span class="item-price">${fmt(item.lineTotal)}</span>
      </div>
      ${optsInline ? `<div class="opts-inline grey">${optsInline}</div>` : ''}
      ${item.itemNotes ? `<div class="opts-inline grey italic">&#9888; ${item.itemNotes}</div>` : ''}
      ${childrenHtml}
      ${subtotalHtml}
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

  const cashAmt = order.splitCashAmount != null ? Number(order.splitCashAmount) : null
  const qrAmt   = cashAmt != null ? Number(order.totalAmount) - cashAmt : null

  const paymentSection = order.paymentMethod === 'BANK_QR' ? `
    ${bankLogoTag}
    <div class="center bold" style="margin-bottom:6px">Scan to Pay</div>
    ${qrSrc ? `<div class="center"><img src="${qrSrc}" width="190" height="190" style="display:block;margin:0 auto" /></div>` : ''}
    <div class="center grey" style="margin-top:6px">Transfer exact amount</div>
    <div class="center bold">Ref: ${order.orderCode}</div>
  ` : order.paymentMethod === 'SPLIT' ? `
    <div class="center bold" style="margin-bottom:6px">Split Payment</div>
    <div class="row"><span>&#128179; Bank Transfer</span><span>${fmt(qrAmt)}</span></div>
    <div class="row"><span>&#128181; Cash</span><span>${fmt(cashAmt)}</span></div>
    ${bankLogoTag}
    ${qrSrc ? `
      <div class="center" style="margin-top:6px"><div class="center bold" style="margin-bottom:4px">Scan to Pay (Bank Portion)</div>
      <img src="${qrSrc}" width="180" height="180" style="display:block;margin:0 auto" /></div>
      <div class="center grey" style="margin-top:4px">Ref: ${order.orderCode}</div>
    ` : ''}
  ` : `<div class="center bold">Payment: Cash</div>`

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
  .center     { text-align: center; }
  .bold       { font-weight: bold; }
  .grey       { color: #555; }
  .italic     { font-style: italic; }
  .title      { font-size: 16px; font-weight: 900; letter-spacing: 2px; }
  .big-num    { font-size: 48px; font-weight: 900; text-align: center; line-height: 1.1; }
  .divider    { border-top: 1px dashed #666; margin: 7px 0; }
  .row        { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 2px; }
  .item-row   { margin-top: 5px; gap: 3px; }
  .row-num    { font-size: 11px; color: #999; flex-shrink: 0; min-width: 16px; }
  .item-qty   { font-weight: 900; flex-shrink: 0; margin-right: 3px; }
  .item-name  { flex: 1; padding-right: 6px; font-weight: 700; }
  .item-price { text-align: right; white-space: nowrap; flex-shrink: 0; }
  .opts-inline { padding-left: 20px; font-size: 11px; color: #666; margin-bottom: 1px; }
  .side-row   { margin-top: 2px; gap: 3px; margin-left: 14px; border-left: 2px solid #c7d2fe; padding-left: 6px; }
  .side-num   { font-size: 10px; color: #aaa; flex-shrink: 0; min-width: 22px; }
  .side-qty   { font-weight: 900; font-size: 11px; color: #6366f1; flex-shrink: 0; margin-right: 3px; }
  .side-name  { flex: 1; padding-right: 6px; font-size: 12px; color: #444; }
  .child-opts    { margin-left: 14px; padding-left: 28px; font-size: 10px; color: #777; margin-bottom: 1px; }
  .subtotal-row  { margin-top: 2px; padding-top: 2px; border-top: 1px dotted #ccc; padding-left: 20px; }
  .subtotal-label { flex: 1; font-size: 11px; color: #555; font-style: italic; }
  .subtotal-val   { font-size: 12px; font-weight: 900; color: #111; white-space: nowrap; }
  .summary-row { margin-top: 6px; margin-bottom: 6px; }
  .total-row  { font-weight: 900; font-size: 15px; margin-top: 8px; margin-bottom: 8px; }
  .footer     { text-align: center; font-style: italic; color: #555; margin-top: 6px; font-size: 12px; }
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
  <div class="row summary-row" style="font-size:11px;color:#555;">
    <span>${rootItems.length} line${rootItems.length !== 1 ? 's' : ''}</span>
    <span style="font-weight:700;color:#111;">${rootItems.reduce((s, it) => s + Number(it.quantity || 1), 0)} items total</span>
  </div>
  <div class="row total-row">
    <span>TOTAL</span>
    <span>${fmt(rootItems.reduce((s, item) => {
      const children = childMap[String(item.id)] || []
      const parentQty = Number(item.quantity || 1)
      return s + Number(item.lineTotal || 0) + children.reduce((cs, c) => cs + Number(c.lineTotal || 0) * parentQty, 0)
    }, 0) + Number(order.deliveryFee || 0))}</span>
  </div>

  ${notesSection}

  <div class="divider"></div>

  ${paymentSection}

  <div class="divider"></div>
  <div class="footer">&#9733; Thank you! See you again &#9733;</div>
</body>
</html>`

  const pw = Math.max(Math.round(screen.width * 0.5), 600)
  const ph = Math.min(Math.round(screen.height * 0.9), 960)
  const win = window.open('', '_blank', `width=${pw},height=${ph},left=${Math.round((screen.width-pw)/2)},top=40`)
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.focus(); win.print(); setTimeout(() => win.close(), 1000) }
}
