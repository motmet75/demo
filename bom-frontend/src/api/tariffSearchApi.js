import { apiFetchJson } from './client'

const base = '/bom/inventory/customs-declaration/tariff'

export async function searchTariff(query, limit = 20) {
  const { res, data } = await apiFetchJson(
    base + '/search?q=' + encodeURIComponent(query) + '&limit=' + encodeURIComponent(limit))
  if (!res.ok) {
    throw new Error((typeof data === 'string' ? data : data?.message || data?.detail || data?.error) ||
      'Không tìm kiếm được biểu thuế (HTTP ' + res.status + ')')
  }
  return data
}
