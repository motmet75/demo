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
