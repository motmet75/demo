// VietQR's public tax-code lookup is available until 2027-03-01.
// Keep invoice fields editable: registry data can be stale or incomplete.
export async function lookupBusinessTaxCode(value) {
  const taxCode = String(value || '').trim()
  if (!/^\d{10}(?:-\d{3})?$/.test(taxCode)) {
    throw new Error('Mã số thuế phải có 10 số, có thể thêm mã chi nhánh -001.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(taxCode)}`, {
      headers: { Accept: 'application/json' }, signal: controller.signal,
    })
    if (!response.ok) throw new Error(response.status === 429 ? 'Tra cứu MST đang quá tải. Vui lòng thử lại.' : 'Không thể tra cứu mã số thuế.')
    const body = await response.json()
    if (body?.code !== '00' || !body?.data?.name) throw new Error(body?.desc || 'Không tìm thấy thông tin mã số thuế.')
    return {
      taxCode,
      name: String(body.data.name),
      address: String(body.data.address || ''),
      status: String(body.data.status || ''),
    }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Tra cứu MST quá thời gian. Vui lòng thử lại.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}
