import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDesktopIdentity } from '../desktop/identity.cjs'
import { assetPathForUrl, externalUrl, contentSecurityPolicy } from '../desktop/routes.cjs'

const temporary = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe('desktop identity and local asset boundary', () => {
  it('derives branding and isolated settings from the actual app metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cinematic-desktop-test-'))
    temporary.push(dir)
    await writeFile(join(dir, 'app-metadata.json'), JSON.stringify({ id: 'wave-lab', title: 'Wave: lab', packageName: '@owner/wave-lab', version: '1.2.3' }))
    expect(readDesktopIdentity(dir)).toEqual({ productName: 'Wave lab', appId: 'app.cinematic.wave-lab', storageName: 'app.cinematic.wave-lab', executableName: 'owner-wave-lab', version: '1.2.3' })
    await writeFile(join(dir, 'app-metadata.json'), JSON.stringify({ title: 'Missing ID', packageName: 'bad', version: '1.0.0' }))
    expect(() => readDesktopIdentity(dir)).toThrow('Invalid desktop identity')
  })
  it('serves local build assets and keeps model query strings independent of file paths', () => {
    const dist = join(tmpdir(), 'app-dist')
    expect(assetPathForUrl('app://local/', dist)).toBe(join(dist, 'index.html'))
    expect(assetPathForUrl('app://local/index.html?model=wave-lab', dist)).toBe(join(dist, 'index.html'))
    expect(assetPathForUrl('app://local/assets/math.woff2', dist)).toBe(join(dist, 'assets/math.woff2'))
  })
  it.each(['https://local/index.html', 'app://other/index.html', 'app://user@local/index.html', 'app://local/%2fetc/passwd', 'app://local/%2e%2e%2fsecret', 'app://local/assets/%5csecret', 'app://local/%00', 'app://local/%zz'])('rejects unsafe asset URL %s', input => {
    expect(assetPathForUrl(input, join(tmpdir(), 'app-dist'))).toBeNull()
  })
  it('permits browser links while rejecting protocols that invoke local programs', () => {
    expect(externalUrl('https://github.com/KadenCSmith/cinematic-app-framework')).toBe('https://github.com/KadenCSmith/cinematic-app-framework')
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'app://local/index.html', 'https://user:pass@example.com', 'not a URL']) expect(externalUrl(url)).toBeNull()
    expect(contentSecurityPolicy).toContain("script-src 'self'")
    expect(contentSecurityPolicy).not.toContain('unsafe-eval')
  })
})
