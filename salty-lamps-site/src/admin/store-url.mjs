export function storeHref(path, hostname, staging) {
  if (hostname !== 'admin.saltylamps.co.uk' || path === '/admin' || path.startsWith('/admin/')) return path
  return `https://${staging ? 'test' : 'www'}.saltylamps.co.uk${path}`
}

// During owner acceptance, www is restricted by network address. The existing
// test hostname serves the same live deployment and database behind the same
// owner/operator Access policy as admin. Retire this helper at public opening.
export function ownerReviewHref(path, hostname) {
  return storeHref(path, hostname, true)
}
