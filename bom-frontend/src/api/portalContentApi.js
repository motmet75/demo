import { apiFetchJsonNoContext } from './client'

const request = async (path, options = {}) => {
  const { res, data } = await apiFetchJsonNoContext('/admin/portal-content' + path, options)
  if (!res.ok) throw new Error(data?.message || data?.error || `Portal content request failed (${res.status})`)
  return data
}

export const fetchPortalTenants = () => request('/tenants')
export const fetchPortalArticles = (tenant, search = '') =>
  request(`/${encodeURIComponent(tenant)}/articles?search=${encodeURIComponent(search)}`)
export const savePortalArticle = (tenant, article) => request(
  `/${encodeURIComponent(tenant)}/articles${article.id ? `/${article.id}` : ''}`,
  { method: article.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(article) }
)
export const fetchPortalProducts = (tenant, search = '') =>
  request(`/${encodeURIComponent(tenant)}/products?search=${encodeURIComponent(search)}`)
export const savePortalProduct = (tenant, product) => request(
  `/${encodeURIComponent(tenant)}/products${product.id ? `/${product.id}` : ''}`,
  { method: product.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) }
)

// ── Social schedule (Facebook posts for many products, optional repeat rounds) ──
export const fetchPortalFacebookPages = tenant =>
  request(`/${encodeURIComponent(tenant)}/social/facebook-pages`)
export const composePortalPosts = (tenant, payload) => request(
  `/${encodeURIComponent(tenant)}/social/compose`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
)
export const fetchPortalScheduleBatches = tenant =>
  request(`/${encodeURIComponent(tenant)}/social/schedules`)
export const schedulePortalPosts = (tenant, payload) => request(
  `/${encodeURIComponent(tenant)}/social/schedules`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
)
export const firePortalScheduleBatch = (tenant, batchId) => request(
  `/${encodeURIComponent(tenant)}/social/schedules/${encodeURIComponent(batchId)}/fire`,
  { method: 'POST' }
)
export const cancelPortalScheduleBatch = (tenant, batchId) => request(
  `/${encodeURIComponent(tenant)}/social/schedules/${encodeURIComponent(batchId)}/cancel`,
  { method: 'POST' }
)
