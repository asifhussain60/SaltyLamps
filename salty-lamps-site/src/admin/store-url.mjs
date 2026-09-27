export function storeHref(path, hostname, staging) {
  if (hostname !== 'admin.saltylamps.co.uk' || path === '/admin' || path.startsWith('/admin/')) return path
  return `https://${staging ? 'test' : 'www'}.saltylamps.co.uk${path}`
}
