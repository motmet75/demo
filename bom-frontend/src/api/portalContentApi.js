import { apiFetchJsonNoContext } from './client'

const request = async (path, options = {}) => {
  const { res, data } = await apiFetchJsonNoContext('/admin/portal-content' + path, options)
  if (!res.ok) throw new Error(data?.message || data?.error || `Portal content request failed (${res.status})`)
  return data
}

export const fetchPortalTenants = () => request('/tenants')
export const fetchPortalBrands = (tenant) => request(`/${encodeURIComponent(tenant)}/brands`)
export const fetchPortalCatalogs = (tenant) => request(`/${encodeURIComponent(tenant)}/catalogs`)
export const fetchPortalGroups = (tenant) => request(`/${encodeURIComponent(tenant)}/groups`)
export const fetchPortalSchedules = (tenant) => request(`/${encodeURIComponent(tenant)}/schedules`)
export const fetchPortalFacebookPages = (tenant) => request(`/${encodeURIComponent(tenant)}/facebook-pages`)
export const createPortalSchedule = (tenant, schedule) => request(
  `/${encodeURIComponent(tenant)}/schedules`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(schedule) }
)
export const cancelPortalSchedule = (tenant, id) => request(
  `/${encodeURIComponent(tenant)}/schedules/${encodeURIComponent(id)}/cancel`, { method: 'POST' }
)
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

// Facebook group post campaigns (legacy ProductGroupPostForm); queued for the Chrome add-on.
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const fetchPortalGroupPostOptions = (tenant) => request(`/${encodeURIComponent(tenant)}/group-post/options`)
export const fetchPortalGroupPostMembers = (tenant, groupIds = []) => request(
  `/${encodeURIComponent(tenant)}/group-post/members${groupIds.length ? `?${groupIds.map(g => `groups=${encodeURIComponent(g)}`).join('&')}` : ''}`
)
export const previewPortalGroupPosts = (tenant, campaign) => request(`/${encodeURIComponent(tenant)}/group-post/preview`, json(campaign))
export const addPortalFacebookGroups = (tenant, body) => request(`/${encodeURIComponent(tenant)}/group-post/facebook-groups`, json(body))
export const fetchPortalGroupPosts = (tenant) => request(`/${encodeURIComponent(tenant)}/group-posts`)
export const savePortalGroupPosts = (tenant, campaign) => request(`/${encodeURIComponent(tenant)}/group-posts`, json(campaign))
export const cancelPortalGroupPost = (tenant, id) => request(
  `/${encodeURIComponent(tenant)}/group-posts/${encodeURIComponent(id)}/cancel`, { method: 'POST' }
)

// Lazy create: product + its social posts in one multipart submission (files uploaded by Portal).
export const createPortalLazyProduct = (tenant, formData) =>
  request(`/${encodeURIComponent(tenant)}/lazy-create`, { method: 'POST', body: formData })
// First free product code for a name or typed code (checked against existing product codes and links).
export const suggestPortalProductCode = (tenant, text) =>
  request(`/${encodeURIComponent(tenant)}/lazy-create/code?text=${encodeURIComponent(text)}`)
// TikTok / YouTube / LinkedIn accounts connected in Portal (names only).
export const fetchPortalLazyCreateChannels = (tenant) =>
  request(`/${encodeURIComponent(tenant)}/lazy-create/channels`)
