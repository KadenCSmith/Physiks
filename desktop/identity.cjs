const { readFileSync } = require('node:fs')
const { join } = require('node:path')

/** Built by Vite from app.config.ts, so a template copy has one branding source. */
function readDesktopIdentity(distDir = join(__dirname, '../dist')) {
  const metadata = JSON.parse(readFileSync(join(distDir, 'app-metadata.json'), 'utf8'))
  if (typeof metadata.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(metadata.id)
    || typeof metadata.title !== 'string' || !metadata.title.trim()
    || typeof metadata.packageName !== 'string' || !metadata.packageName.trim()
    || typeof metadata.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(metadata.version)) {
    throw new Error('Invalid desktop identity. Check app.config.ts and run npm run build.')
  }
  const productName = metadata.title.replace(/[/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!productName) throw new Error('App title must include a usable desktop name.')
  const executableName = metadata.packageName.replace(/^@/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return {
    productName,
    appId: `app.cinematic.${metadata.id}`,
    storageName: `app.cinematic.${metadata.id}`,
    executableName,
    version: metadata.version,
  }
}

module.exports = { readDesktopIdentity }
