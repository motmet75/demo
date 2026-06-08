import { useState, useEffect, useMemo } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import './App.css'

function buildUrl(base, num) {
  const trimmed = base.trim()
  if (trimmed.includes('{table}')) return trimmed.replaceAll('{table}', num)
  return trimmed.replace(/\/+$/, '') + '/' + num
}

const currency = (n) => `$${n.toFixed(2)}`

function Logo({ text }) {
  return <div className="logo-badge">{text.trim().slice(0, 3).toUpperCase() || '🍽'}</div>
}

function ReceiptHeader({ logoText, name, dateLabel, timeLabel }) {
  return (
    <div className="receipt-header">
      <Logo text={logoText} />
      <div className="receipt-name">{name}</div>
      <div className="receipt-meta">{dateLabel} · {timeLabel}</div>
    </div>
  )
}

function App() {
  // --- Restaurant branding (shared across both receipt types) ---
  const [restaurantName, setRestaurantName] = useState('Modern Bistro')
  const [logoText, setLogoText] = useState('MB')
  const [wifiSsid, setWifiSsid] = useState('Bistro-Guest')
  const [wifiPassword, setWifiPassword] = useState('welcome123')
  const [showWifi, setShowWifi] = useState(true)

  // Captured once: a receipt shows the moment it was generated, not a ticking clock.
  const [now] = useState(() => new Date())
  const dateLabel = now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  const timeLabel = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  // --- Receipt type + shared print/slip settings ---
  const [receiptType, setReceiptType] = useState('table') // 'table' | 'order'
  const [printMode, setPrintMode] = useState('pos') // 'sheet' | 'pos'
  const [posWidthMm, setPosWidthMm] = useState(72)
  const [posHeightMm, setPosHeightMm] = useState(100)

  // --- Table QR state ---
  const [baseUrl, setBaseUrl] = useState('https://example.com/table/{table}')
  const [qrSize, setQrSize] = useState(170)
  const [totalTables, setTotalTables] = useState(20)
  const [selected, setSelected] = useState(() => new Set([1, 2, 3]))
  const [randomCount, setRandomCount] = useState(3)

  const allTables = useMemo(
    () => Array.from({ length: totalTables }, (_, i) => i + 1),
    [totalTables]
  )

  function toggleTable(n) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set(allTables))
  }
  function clearSelection() {
    setSelected(new Set())
  }
  function pickRandom() {
    const count = Math.min(Math.max(randomCount, 0), allTables.length)
    const pool = [...allTables]
    const picked = new Set()
    while (picked.size < count && pool.length) {
      const idx = Math.floor(Math.random() * pool.length)
      picked.add(pool.splice(idx, 1)[0])
    }
    setSelected(picked)
  }
  const selectedTables = allTables.filter((n) => selected.has(n))

  // --- Order confirmation state ---
  const [orderTable, setOrderTable] = useState(5)
  const [items, setItems] = useState([
    { id: 1, name: 'Margherita Pizza', qty: 1, price: 9.5 },
    { id: 2, name: 'Caesar Salad', qty: 2, price: 6.0 },
    { id: 3, name: 'Iced Tea', qty: 2, price: 2.5 },
  ])
  const [discountPercent, setDiscountPercent] = useState(10)

  function addItem() {
    setItems((prev) => [...prev, { id: Date.now(), name: '', qty: 1, price: 0 }])
  }
  function updateItem(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }
  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.price) || 0)
  const subtotal = items.reduce((sum, it) => sum + lineTotal(it), 0)
  const safeDiscount = Math.min(Math.max(Number(discountPercent) || 0, 0), 100)
  const discountAmount = subtotal * (safeDiscount / 100)
  const total = subtotal - discountAmount

  // Receipt/label stock has a fixed slip size (e.g. 72x100mm) — inject a matching
  // @page rule only while POS mode is active. `size` needs two explicit lengths
  // (width then height); a bare width with `auto` height is invalid CSS and makes
  // browsers fall back to the default page size/orientation — sideways, one-up,
  // pinned to a corner.
  useEffect(() => {
    if (printMode !== 'pos') return undefined
    const style = document.createElement('style')
    style.textContent = `@page { size: ${posWidthMm}mm ${posHeightMm}mm; margin: 2mm; }`
    document.head.appendChild(style)
    return () => style.remove()
  }, [printMode, posWidthMm, posHeightMm])

  return (
    <div className={`page ${printMode === 'pos' ? 'pos-mode' : ''}`}>
      <h1 className="no-print">Restaurant Receipt Designer</h1>

      <div className="panel no-print">
        <h2>Restaurant info</h2>
        <div className="panel-row">
          <label>
            Name
            <input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} style={{ width: 200 }} />
          </label>
          <label>
            Logo initials
            <input value={logoText} onChange={(e) => setLogoText(e.target.value)} maxLength={3} style={{ width: 70 }} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={showWifi} onChange={(e) => setShowWifi(e.target.checked)} />
            Show Wi-Fi on table receipts
          </label>
          {showWifi && (
            <>
              <label>
                Wi-Fi name
                <input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} style={{ width: 150 }} />
              </label>
              <label>
                Wi-Fi password
                <input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} style={{ width: 150 }} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="tabs no-print">
        <button
          type="button"
          className={receiptType === 'table' ? 'active' : ''}
          onClick={() => setReceiptType('table')}
        >
          Table QR codes
        </button>
        <button
          type="button"
          className={receiptType === 'order' ? 'active' : ''}
          onClick={() => setReceiptType('order')}
        >
          Order confirmation
        </button>
      </div>

      <div className="controls no-print">
        <label>
          Print as
          <select value={printMode} onChange={(e) => setPrintMode(e.target.value)}>
            <option value="sheet">Sheet (grid, A4 / Letter)</option>
            <option value="pos">POS receipt (one per slip)</option>
          </select>
        </label>
        {printMode === 'pos' && (
          <>
            <label>
              Slip width (mm)
              <input
                type="number" min="20" max="300" value={posWidthMm}
                onChange={(e) => setPosWidthMm(parseInt(e.target.value, 10) || 1)}
                style={{ width: 70 }}
              />
            </label>
            <label>
              Slip height (mm)
              <input
                type="number" min="20" max="400" value={posHeightMm}
                onChange={(e) => setPosHeightMm(parseInt(e.target.value, 10) || 1)}
                style={{ width: 70 }}
              />
            </label>
          </>
        )}
        <button type="button" id="printBtn" onClick={() => window.print()}>
          {receiptType === 'table' ? `Print ${selectedTables.length} selected` : 'Print receipt'}
        </button>
        <p className="hint">
          <strong>Sheet</strong> mode prints a grid on regular paper; <strong>POS receipt</strong>{' '}
          mode prints one receipt per slip, sized to the width/height above (e.g. 72 x 100mm).
          Either way, pick your USB002 printer in the browser&apos;s print dialog &mdash; Windows
          routes the job to whichever port the driver is bound to.
        </p>
      </div>

      {receiptType === 'table' ? (
        <>
          <div className="panel no-print">
            <h2>QR link</h2>
            <div className="panel-row">
              <label>
                Base URL
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ width: 320 }} />
              </label>
              <label>
                QR size (px)
                <input
                  type="number" min="80" max="600" step="10" value={qrSize}
                  onChange={(e) => setQrSize(parseInt(e.target.value, 10) || 170)}
                  style={{ width: 80 }}
                />
              </label>
            </div>
            <p className="hint">
              Use <code>{'{table}'}</code> as a placeholder for the table number, e.g.{' '}
              <code>https://example.com/menu?table={'{table}'}</code>. If omitted, the number is
              appended to the URL.
            </p>
          </div>

          <div className="panel no-print">
            <h2>Tables to print</h2>
            <div className="panel-row">
              <label>
                Total tables
                <input
                  type="number" min="1" max="500" value={totalTables}
                  onChange={(e) => setTotalTables(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ width: 80 }}
                />
              </label>
              <button type="button" onClick={selectAll}>Select all</button>
              <button type="button" onClick={clearSelection}>Clear</button>
              <span className="random-pick">
                Randomly pick
                <input
                  type="number" min="1" value={randomCount}
                  onChange={(e) => setRandomCount(parseInt(e.target.value, 10) || 1)}
                  style={{ width: 56 }}
                />
                <button type="button" onClick={pickRandom}>Go</button>
              </span>
              <span className="picker-count">{selectedTables.length} of {totalTables} selected</span>
            </div>
            <div className="table-checks">
              {allTables.map((n) => (
                <label key={n} className={`table-check ${selected.has(n) ? 'checked' : ''}`}>
                  <input type="checkbox" checked={selected.has(n)} onChange={() => toggleTable(n)} />
                  {n}
                </label>
              ))}
            </div>
          </div>

          {selectedTables.length === 0 ? (
            <p className="empty-hint no-print">
              No tables selected yet — check some boxes above, or use &quot;Randomly pick&quot;.
            </p>
          ) : (
            <div className="receipt-grid">
              {selectedTables.map((n) => {
                const url = buildUrl(baseUrl, n)
                return (
                  <div className="receipt" key={n}>
                    <ReceiptHeader logoText={logoText} name={restaurantName} dateLabel={dateLabel} timeLabel={timeLabel} />
                    <div className="receipt-divider" />
                    <QRCodeCanvas value={url} size={qrSize} marginSize={1} />
                    <div className="receipt-table-label">Table {n}</div>
                    <div className="receipt-sub">Scan to view the menu &amp; order</div>
                    {showWifi && (
                      <>
                        <div className="receipt-divider" />
                        <div className="receipt-wifi">
                          <span>Wi-Fi: <strong>{wifiSsid}</strong></span>
                          <span>Password: <strong>{wifiPassword}</strong></span>
                        </div>
                      </>
                    )}
                    <div className="receipt-url no-print">{url}</div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="panel no-print">
            <h2>Order</h2>
            <div className="panel-row">
              <label>
                Table #
                <input
                  type="number" min="1" value={orderTable}
                  onChange={(e) => setOrderTable(parseInt(e.target.value, 10) || 1)}
                  style={{ width: 70 }}
                />
              </label>
              <label>
                Discount %
                <input
                  type="number" min="0" max="100" value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseInt(e.target.value, 10) || 0)}
                  style={{ width: 70 }}
                />
              </label>
            </div>

            <table className="item-editor">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <input value={it.name} onChange={(e) => updateItem(it.id, 'name', e.target.value)} placeholder="Item name" />
                    </td>
                    <td>
                      <input
                        type="number" min="0" value={it.qty} style={{ width: 56 }}
                        onChange={(e) => updateItem(it.id, 'qty', parseInt(e.target.value, 10) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01" value={it.price} style={{ width: 80 }}
                        onChange={(e) => updateItem(it.id, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="item-total-cell">{currency(lineTotal(it))}</td>
                    <td>
                      <button type="button" className="remove-btn" onClick={() => removeItem(it.id)} aria-label="Remove item">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={addItem}>+ Add item</button>
          </div>

          <div className="receipt-grid">
            <div className="receipt">
              <ReceiptHeader logoText={logoText} name={restaurantName} dateLabel={dateLabel} timeLabel={timeLabel} />
              <div className="receipt-table-label">Table {orderTable}</div>
              <div className="receipt-sub">Order confirmation</div>
              <div className="receipt-divider" />
              <div className="receipt-items">
                {items.map((it) => (
                  <div className="receipt-item-row" key={it.id}>
                    <span className="item-name">{it.name || 'Item'} × {Number(it.qty) || 0}</span>
                    <span className="item-amount">{currency(lineTotal(it))}</span>
                  </div>
                ))}
              </div>
              <div className="receipt-divider" />
              <div className="receipt-totals">
                <div className="totals-row">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                {safeDiscount > 0 && (
                  <div className="totals-row">
                    <span>Discount ({safeDiscount}%)</span>
                    <span>-{currency(discountAmount)}</span>
                  </div>
                )}
                <div className="totals-row total">
                  <span>Total</span>
                  <span>{currency(total)}</span>
                </div>
              </div>
              <div className="receipt-divider" />
              <div className="receipt-footer">Thank you for dining with us!</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
