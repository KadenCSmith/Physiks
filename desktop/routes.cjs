const { relative, resolve, isAbsolute, sep } = require('node:path')
const contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'"

/** Resolve only bundled assets, even for malformed or encoded traversal URLs. */
function assetPathForUrl(input, distDir) {
  try {
    const url = new URL(input)
    if (url.protocol !== 'app:' || url.hostname !== 'local' || url.port || url.username || url.password) return null
    const pathname = decodeURIComponent(url.pathname || '/index.html')
    if (pathname.includes('\\') || pathname.includes('\0')) return null
    const base = resolve(distDir)
    const path = resolve(base, pathname === '/' ? 'index.html' : pathname.slice(1))
    const child = relative(base, path)
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) return null
    return path
  } catch { return null }
}

function externalUrl(input) {
  try {
    const url = new URL(input)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

module.exports = { assetPathForUrl, externalUrl, contentSecurityPolicy }
