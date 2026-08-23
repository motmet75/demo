import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { fetchActivePickup } from '../../api/shopApi'
import LanguageSelector from '../../components/LanguageSelector'
import { ORDERING_LANGUAGE_CODES } from '../../i18n/translations'
import { useI18n } from '../../i18n/I18nContext'
import { localizedModelName, localizedSelectedOptions } from '../../i18n/menuLocalization'

export const COUNTER_CHANNEL = 'shop_counter_display'
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const PICKUP_POLL_MS  = 3000

export function broadcastToCounter(order, tagQrBase64 = null) {
  const payload = order
    ? { ...order, tagQrBase64, _ts: Date.now() }
    : null
  const msg = { type: 'COUNTER_DISPLAY_ORDER', payload }
  try {
    if (window.BroadcastChannel) new BroadcastChannel(COUNTER_CHANNEL).postMessage(msg)
    if (payload) localStorage.setItem('shop_counter_order', JSON.stringify(payload))
    else localStorage.removeItem('shop_counter_order')
  } catch { /* non-fatal */ }
}

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))
const splitCashPortion = (order) => Math.max(0, Math.min(Number(order?.splitCashAmount || 0), payableAmount(order)))
const splitQrPortion = (order) => Math.max(0, payableAmount(order) - splitCashPortion(order))

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return t.toLocaleTimeString('vi-VN')
}

function IdleScreen() {
  return (
    <Box sx={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 3,
    }}>
      <Typography sx={{ fontSize: { xs: 60, md: 100 }, lineHeight: 1 }}>🍵</Typography>
      <Typography sx={{
        fontSize: { xs: 28, md: 48 }, fontWeight: 900,
        color: '#f1f5f9', letterSpacing: 2, textTransform: 'uppercase',
      }}>
        Welcome!
      </Typography>
      <Typography sx={{ fontSize: { xs: 14, md: 20 }, color: '#64748b', fontWeight: 500 }}>
        Chào mừng quý khách
      </Typography>
    </Box>
  )
}

function ItemRow({ item, number, isChild }) {
  const { language } = useI18n()
  const optsText = localizedSelectedOptions(item.modelId, item.selectedOptions, {}, language)
  return (
    <Box sx={{
      bgcolor: isChild ? '#162032' : '#1e293b',
      borderRadius: isChild ? 1.5 : 2,
      p: isChild ? { xs: 1, md: 1.5 } : { xs: 1.5, md: 2 },
      mb: isChild ? 1 : 1.5,
      ml: isChild ? { xs: 3, md: 5 } : 0,
      borderLeft: isChild ? '3px solid #6366f1' : '4px solid #3b82f6',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography sx={{
          fontSize: isChild ? { xs: 14, md: 18 } : { xs: 16, md: 22 },
          fontWeight: isChild ? 600 : 800, color: '#f1f5f9', lineHeight: 1.2, flex: 1,
        }}>
          {number && (
            <Box component="span" sx={{
              color: isChild ? '#818cf8' : '#94a3b8',
              fontWeight: 700, mr: 0.75, fontSize: '0.8em',
            }}>
              {number}
            </Box>
          )}
          {!isChild && (
            <Box component="span" sx={{ color: '#60a5fa', fontWeight: 900, mr: 1 }}>
              {Number(item.quantity)}×
            </Box>
          )}
          {localizedModelName(item, language)}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 0.25 }}>
          <Typography sx={{
            fontSize: isChild ? { xs: 12, md: 15 } : { xs: 14, md: 18 },
            fontWeight: 700,
            color: isChild ? '#a5b4fc' : '#38bdf8',
          }}>
            {fmt(item.lineTotal)}
          </Typography>
          {!isChild && Number(item.quantity) > 1 && (
            <Typography sx={{ fontSize: { xs: 10, md: 12 }, color: '#64748b', fontWeight: 500 }}>
              {fmt(item.unitPrice)} /ea
            </Typography>
          )}
        </Box>
      </Box>

      {optsText && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
          <Box sx={{
              bgcolor: '#334155', color: '#94a3b8', borderRadius: 99,
              px: 1.25, py: 0.25, fontSize: { xs: 11, md: 13 }, fontWeight: 600,
            }}>
            {optsText}
          </Box>
        </Box>
      )}

      {item.itemNotes && (
        <Typography sx={{
          mt: 0.75, fontSize: { xs: 12, md: 14 },
          color: '#fbbf24', fontStyle: 'italic', fontWeight: 600,
        }}>
          ⚠ {item.itemNotes}
        </Typography>
      )}
    </Box>
  )
}

// Flash keyframe shared across both QR and cash panels
const QR_FLASH_KF = {
  '@keyframes qrFlash': {
    '0%,100%': { boxShadow: '0 0 0 0 rgba(74,222,128,0)' },
    '50%':     { boxShadow: '0 0 0 16px rgba(74,222,128,0.45)' },
  },
}
const CASH_FLASH_KF = {
  '@keyframes cashFlash': {
    '0%,100%': { boxShadow: '0 0 0 0 rgba(251,191,36,0)' },
    '50%':     { boxShadow: '0 0 0 16px rgba(251,191,36,0.45)' },
  },
}

function PaymentPanel({ order, flash }) {
  const isSplit  = order.paymentMethod === 'SPLIT'
  const isQr     = order.paymentMethod === 'BANK_QR'
  const isCash   = order.paymentMethod === 'CASH' || (!isSplit && !isQr)

  const splitCash = isSplit ? splitCashPortion(order) : 0
  const splitQrAmt = isSplit ? splitQrPortion(order) : 0

  const payQrSrc = order.paymentQr?.startsWith('https://')
    ? order.paymentQr
    : order.paymentQr ? `data:image/png;base64,${order.paymentQr}` : null

  const hasTrackQr = !!order.tagQrBase64

  return (
    <Box sx={{
      width: { xs: '100%', md: isSplit ? 320 : 280 },
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#0c1525',
      borderLeft: { md: '2px solid #1e293b' },
      borderTop: { xs: '2px solid #1e293b', md: 'none' },
      p: { xs: 2, md: 3 },
      gap: 2,
      justifyContent: 'center',
      alignItems: 'center',
    }}>

      {/* ── SPLIT: QR portion + Cash portion ── */}
      {isSplit && (
        <>
          {/* QR portion block */}
          {payQrSrc && (
            <Box sx={{
              textAlign: 'center', width: '100%',
              ...(flash ? QR_FLASH_KF : {}),
            }}>
              <Typography sx={{
                fontSize: { xs: 11, md: 14 }, fontWeight: 800,
                color: '#4ade80', letterSpacing: 2, textTransform: 'uppercase', mb: 1,
              }}>
                💳 Quét mã chuyển khoản
              </Typography>
              <Box sx={{
                bgcolor: '#fff', borderRadius: 2, p: 1,
                display: 'inline-block',
                border: '3px solid #4ade80',
                animation: flash ? 'qrFlash 0.65s ease-in-out 5' : 'none',
                ...QR_FLASH_KF,
              }}>
                <img src={payQrSrc} alt="VietQR" style={{ width: 180, height: 180, display: 'block' }} />
              </Box>
              <Typography sx={{
                mt: 1, fontSize: { xs: 20, md: 28 }, fontWeight: 900,
                color: '#4ade80', fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(splitQrAmt)}
              </Typography>
            </Box>
          )}

          {/* Cash portion block */}
          <Box sx={{
            width: '100%', borderRadius: 2, py: { xs: 1.5, md: 2.5 }, px: 2,
            bgcolor: '#1c1200',
            border: '3px solid #f59e0b',
            textAlign: 'center',
            animation: flash ? 'cashFlash 0.65s ease-in-out 5 0.32s' : 'none',
            ...CASH_FLASH_KF,
          }}>
            <Typography sx={{
              fontSize: { xs: 12, md: 14 }, fontWeight: 800,
              color: '#fbbf24', letterSpacing: 2, textTransform: 'uppercase', mb: 1,
            }}>
              💵 Tiền mặt
            </Typography>
            <Typography sx={{
              fontSize: { xs: 32, md: 44 }, fontWeight: 900,
              color: '#fde68a', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {fmt(splitCash)}
            </Typography>
          </Box>
        </>
      )}

      {/* ── BANK_QR: full QR ── */}
      {isQr && payQrSrc && (
        <Box sx={{
          textAlign: 'center',
          animation: flash ? 'qrFlash 0.65s ease-in-out 5' : 'none',
          ...QR_FLASH_KF,
        }}>
          <Typography sx={{
            fontSize: { xs: 11, md: 13 }, fontWeight: 800,
            color: '#4ade80', letterSpacing: 2, textTransform: 'uppercase', mb: 1,
          }}>
            Scan to Pay
          </Typography>
          <Box sx={{
            bgcolor: '#fff', borderRadius: 2, p: 1,
            display: 'inline-block', border: '3px solid #4ade80',
          }}>
            <img src={payQrSrc} alt="VietQR" style={{ width: 180, height: 180, display: 'block' }} />
          </Box>
          <Typography sx={{
            mt: 1, fontSize: { xs: 18, md: 24 }, fontWeight: 900,
            color: '#4ade80', fontVariantNumeric: 'tabular-nums',
          }}>
            {fmt(payableAmount(order))}
          </Typography>
        </Box>
      )}

      {/* ── CASH: big cash display ── */}
      {isCash && (
        <Box sx={{
          width: '100%', borderRadius: 2, py: { xs: 2, md: 3 }, px: 2,
          bgcolor: '#1c1200', border: '3px solid #f59e0b', textAlign: 'center',
          animation: flash ? 'cashFlash 0.65s ease-in-out 5' : 'none',
          ...CASH_FLASH_KF,
        }}>
          <Typography sx={{
            fontSize: { xs: 12, md: 14 }, fontWeight: 800,
            color: '#fbbf24', letterSpacing: 2, textTransform: 'uppercase', mb: 1,
          }}>
            💵 Thanh toán tiền mặt
          </Typography>
          <Typography sx={{
            fontSize: { xs: 32, md: 48 }, fontWeight: 900,
            color: '#fde68a', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
          }}>
            {fmt(payableAmount(order))}
          </Typography>
        </Box>
      )}

      {/* ── Tracking QR (always at bottom if present) ── */}
      {hasTrackQr && (
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{
            fontSize: { xs: 10, md: 12 }, fontWeight: 700,
            color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', mb: 0.75,
          }}>
            Track Order
          </Typography>
          <Box sx={{ bgcolor: '#fff', borderRadius: 1.5, p: 0.75, display: 'inline-block', border: '2px solid #334155' }}>
            <img
              src={`data:image/png;base64,${order.tagQrBase64}`}
              alt="Track"
              style={{ width: 110, height: 110, display: 'block' }}
            />
          </Box>
          <Typography sx={{ mt: 0.5, fontSize: 11, color: '#475569', fontWeight: 600 }}>
            {order.orderCode}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function ActiveOrder({ order, flash }) {
  const num = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const hasPayQr   = !!order.paymentQr
  const hasTrackQr = !!order.tagQrBase64
  const showPanel  = hasPayQr || hasTrackQr || order.paymentMethod === 'CASH'

  return (
    <Box sx={{
      flex: 1, display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      minHeight: 0, overflow: 'hidden',
      gap: '2px', bgcolor: '#0f172a',
    }}>
      {/* Left — order items */}
      <Box sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: 0, overflow: 'hidden', bgcolor: '#0f172a',
      }}>
        {/* Order number banner */}
        <Box sx={{
          bgcolor: '#1e3a5f', borderBottom: '3px solid #3b82f6',
          px: { xs: 2, md: 4 }, py: { xs: 1.5, md: 2 },
          display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
        }}>
          <Typography sx={{
            fontSize: { xs: 48, md: 72 }, fontWeight: 900, color: '#60a5fa',
            lineHeight: 1, letterSpacing: -3, fontVariantNumeric: 'tabular-nums',
          }}>
            {num}
          </Typography>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: { xs: 11, md: 14 }, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
              Order
            </Typography>
            {order.customerName && (
              <Typography sx={{ color: '#f1f5f9', fontSize: { xs: 14, md: 18 }, fontWeight: 700 }}>
                {order.customerName}
              </Typography>
            )}
            {order.tableName && (
              <Typography sx={{ color: '#93c5fd', fontSize: { xs: 12, md: 15 }, fontWeight: 600 }}>
                Table {order.tableName}
              </Typography>
            )}
          </Box>

          {/* Payment method badge in header */}
          {order.paymentMethod && (
            <Box sx={{ ml: 'auto' }}>
              {order.paymentMethod === 'SPLIT' ? (
                <Box sx={{
                  display: 'flex', gap: 1, flexDirection: { xs: 'column', md: 'row' },
                  animation: flash ? 'badgePulse 0.7s ease-in-out 5' : 'none',
                  '@keyframes badgePulse': {
                    '0%,100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}>
                  <Box sx={{ bgcolor: '#166534', border: '2px solid #4ade80', borderRadius: 1.5, px: 1.25, py: 0.5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: { xs: 10, md: 12 }, color: '#4ade80', fontWeight: 800 }}>💳 QR</Typography>
                    <Typography sx={{ fontSize: { xs: 12, md: 14 }, color: '#86efac', fontWeight: 900 }}>
                      {fmt(splitQrPortion(order))}
                    </Typography>
                  </Box>
                  <Box sx={{ bgcolor: '#1c1200', border: '2px solid #f59e0b', borderRadius: 1.5, px: 1.25, py: 0.5, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: { xs: 10, md: 12 }, color: '#fbbf24', fontWeight: 800 }}>💵 Cash</Typography>
                    <Typography sx={{ fontSize: { xs: 12, md: 14 }, color: '#fde68a', fontWeight: 900 }}>
                      {fmt(splitCashPortion(order))}
                    </Typography>
                  </Box>
                </Box>
              ) : order.paymentMethod === 'BANK_QR' ? (
                <Box sx={{ bgcolor: '#166534', border: '2px solid #4ade80', borderRadius: 1.5, px: 1.5, py: 0.75, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, color: '#4ade80', fontWeight: 800 }}>💳 QR Pay</Typography>
                </Box>
              ) : (
                <Box sx={{ bgcolor: '#1c1200', border: '2px solid #f59e0b', borderRadius: 1.5, px: 1.5, py: 0.75, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: { xs: 11, md: 13 }, color: '#fbbf24', fontWeight: 800 }}>💵 Cash</Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Items list */}
        <Box sx={{
          flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 3 },
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: 4 },
        }}>
          {(() => {
            const allItems = order.items || []
            const roots = allItems.filter(it => !it.parentItemId)
            return roots.map((root, idx) => {
              const children = allItems.filter(it => it.parentItemId === root.id)
              return (
                <Box key={root.id || idx}>
                  <ItemRow item={root} number={`${idx + 1}.`} />
                  {children.map((child, cIdx) => (
                    <ItemRow key={child.id || cIdx} item={child} number={`${idx + 1}.${cIdx + 1}`} isChild />
                  ))}
                </Box>
              )
            })
          })()}

          {/* Total */}
          <Box sx={{
            bgcolor: '#1e293b', borderRadius: 2,
            px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2 },
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '2px solid #3b82f6',
          }}>
            <Typography sx={{ fontSize: { xs: 16, md: 22 }, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Total
            </Typography>
            <Typography sx={{ fontSize: { xs: 24, md: 36 }, fontWeight: 900, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(payableAmount(order))}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right — payment panel */}
      {showPanel && <PaymentPanel order={order} flash={flash} />}
    </Box>
  )
}

export default function CounterDisplayPage() {
  const [searchParams] = useSearchParams()
  const tenantId  = searchParams.get('tenantId')
  const companyId = searchParams.get('companyId')

  const [order, setOrder] = useState(null)
  const [flash, setFlash] = useState(false)
  const idleTimerRef     = useRef(null)
  const flashTimerRef    = useRef(null)
  const lastPickupCode   = useRef(null)

  const triggerFlash = () => {
    setFlash(true)
    clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlash(false), 4000)
  }

  const resetIdleTimer = (ord) => {
    clearTimeout(idleTimerRef.current)
    if (ord) {
      idleTimerRef.current = setTimeout(() => setOrder(null), IDLE_TIMEOUT_MS)
    }
  }

  // Trigger flash whenever order changes (new order or payment update)
  useEffect(() => {
    if (order) triggerFlash()
  }, [order?._ts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-device polling: when tenantId+companyId are in URL, poll for pickup scans
  const pollPickup = useCallback(async () => {
    if (!tenantId || !companyId) return
    try {
      const { res, data: ord } = await fetchActivePickup(tenantId, companyId)
      if (res.status === 204 || !ord) return
      if (ord.orderCode !== lastPickupCode.current) {
        lastPickupCode.current = ord.orderCode
        const payload = { ...ord, _ts: Date.now() }
        setOrder(payload)
        resetIdleTimer(payload)
        localStorage.setItem('shop_counter_order', JSON.stringify(payload))
      }
    } catch (_) {}
  }, [tenantId, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tenantId || !companyId) return
    pollPickup()
    const t = setInterval(pollPickup, PICKUP_POLL_MS)
    return () => clearInterval(t)
  }, [pollPickup])

  useEffect(() => {
    if (!window.BroadcastChannel) return
    const ch = new BroadcastChannel(COUNTER_CHANNEL)
    ch.onmessage = (e) => {
      if (e.data?.type === 'COUNTER_DISPLAY_ORDER') {
        const ord = e.data.payload || null
        setOrder(ord)
        resetIdleTimer(ord)
        if (ord) localStorage.setItem('shop_counter_order', JSON.stringify(ord))
        else localStorage.removeItem('shop_counter_order')
      }
    }
    return () => ch.close()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const saved = localStorage.getItem('shop_counter_order')
      if (saved) {
        const ord = JSON.parse(saved)
        if (ord._ts && Date.now() - ord._ts < 10 * 60 * 1000) {
          setOrder(ord)
          resetIdleTimer(ord)
        } else {
          localStorage.removeItem('shop_counter_order')
        }
      }
    } catch { localStorage.removeItem('shop_counter_order') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0f172a', overflow: 'hidden' }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 2, md: 4 }, py: { xs: 1, md: 1.5 },
        bgcolor: '#1e293b', borderBottom: '2px solid #334155', flexShrink: 0,
      }}>
        <Typography sx={{
          fontWeight: 900, fontSize: { xs: 14, md: 20 },
          letterSpacing: 3, textTransform: 'uppercase', color: '#f1f5f9',
        }}>
          {order ? '🧋 Your Order' : '🍵 Order Counter'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LanguageSelector compact languageCodes={ORDERING_LANGUAGE_CODES} />
          <Typography sx={{
            fontWeight: 900, fontSize: { xs: 16, md: 22 },
            color: '#94a3b8', fontVariantNumeric: 'tabular-nums', letterSpacing: 1,
          }}>
            <Clock />
          </Typography>
        </Box>
      </Box>

      {order ? <ActiveOrder order={order} flash={flash} /> : <IdleScreen />}
    </Box>
  )
}
