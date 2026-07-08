import { createPrintHistory } from '../api/shopApi'
import {
  printWalkUpQr,
  printQueueQr,
  printOrderReceipt,
  printOrderTag,
  printCupLabels,
  printCombinedReceipt,
} from './printOrderReceipt'

const printError = (error) => error?.message || 'Print history was not saved'

async function recordPrint(payload, onError) {
  try {
    const { res, data } = await createPrintHistory(payload)
    if (!res.ok || !data?.id) throw new Error(data?.error || data?.message || 'Print history failed')
    return data
  } catch (error) {
    if (typeof onError === 'function') onError(printError(error))
    return null
  }
}

function orderNum(order) {
  return order?.orderNumber != null ? `#${order.orderNumber}` : order?.orderCode || ''
}

function payableAmount(order) {
  return Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))
}

function orderSource(order) {
  return {
    sourceType: 'ORDER',
    sourceId: order?.id || null,
    sourceKey: order?.id || order?.orderCode || null,
    sourceCode: order?.orderCode || null,
    sourceNumber: order?.orderNumber != null ? String(order.orderNumber) : null,
    amount: order ? payableAmount(order) : null,
  }
}

export async function printWalkUpQrTracked(result, onError) {
  if (!result?.qrBase64) return
  const seqText = result.seq != null ? String(result.seq) : 'auto'
  const meta = await recordPrint({
    printType: 'QR_ORDER_SLIP',
    sourceType: 'QR_SLIP',
    sourceKey: result.qrUrl || `qr-slip:${seqText}:${String(result.qrBase64).slice(0, 24)}`,
    sourceCode: result.qrUrl || null,
    sourceNumber: result.seq != null ? seqText : null,
    title: result.seq != null ? `QR Order Slip #${result.seq}` : 'QR Order Slip',
    notes: 'Walk-up customer ordering QR slip',
  }, onError)
  printWalkUpQr(result.seq, result.qrBase64, result.qrUrl, meta)
}

export async function printQueueQrTracked(result, onError) {
  if (!result?.qrBase64) return
  const validText = result.expiresAt
    ? `Valid until ${new Date(result.expiresAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`
    : result.validDays ? `Valid ${result.validDays} day${Number(result.validDays) === 1 ? '' : 's'}` : 'Long-validity queue QR'
  const meta = await recordPrint({
    printType: 'QUEUE_QR',
    sourceType: 'QR_SLIP',
    sourceKey: result.token || result.qrUrl || `queue-qr:${String(result.qrBase64).slice(0, 24)}`,
    sourceCode: result.qrUrl || null,
    sourceNumber: result.validDays != null ? `${result.validDays} days` : null,
    title: 'Queue QR',
    notes: validText,
  }, onError)
  printQueueQr(result.qrBase64, result.qrUrl, { validDays: result.validDays, expiresAt: result.expiresAt }, meta)
}

export async function printOrderReceiptTracked(order, trackingQrBase64 = null, onError) {
  if (!order) return
  const meta = await recordPrint({
    printType: 'ORDER_RECEIPT',
    ...orderSource(order),
    title: `Order Receipt ${orderNum(order)}`,
  }, onError)
  printOrderReceipt(order, trackingQrBase64, meta)
}

export async function printOrderTagTracked(order, qrBase64 = null, onError) {
  if (!order) return
  const meta = await recordPrint({
    printType: 'ORDER_QR_TAG',
    ...orderSource(order),
    title: `Tracking QR ${orderNum(order)}`,
  }, onError)
  printOrderTag(order, qrBase64, meta)
}

export async function printCupLabelsTracked(order, onError) {
  if (!order) return
  const roots = (order.items || []).filter(item => !item.parentItemId)
  const labelCount = roots.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
  const meta = await recordPrint({
    printType: 'CUP_LABELS',
    ...orderSource(order),
    title: `Cup Labels ${orderNum(order)}`,
    notes: `${labelCount} label${labelCount === 1 ? '' : 's'}`,
  }, onError)
  printCupLabels(order, meta)
}

export async function printCombinedReceiptTracked(orders, opts = {}, onError) {
  const activeOrders = (orders || []).filter(order => order.status !== 'CANCELLED')
  if (!activeOrders.length) return
  const total = activeOrders.reduce((sum, order) => sum + payableAmount(order), 0)
  const token = opts.tokenRef || activeOrders.find(order => order.sourceToken)?.sourceToken || ''
  const sourceKey = token || activeOrders.map(order => order.id || order.orderCode).filter(Boolean).join('|')
  const meta = await recordPrint({
    printType: 'BILL_RECEIPT',
    sourceType: 'BILL',
    sourceKey,
    sourceCode: token || null,
    sourceNumber: activeOrders.map(order => order.orderNumber != null ? `#${order.orderNumber}` : order.orderCode).join(', '),
    amount: total,
    title: activeOrders.length === 1 ? `Bill Receipt ${orderNum(activeOrders[0])}` : `Combined Bill (${activeOrders.length} orders)`,
  }, onError)
  printCombinedReceipt(orders, { ...opts, printMeta: meta })
}