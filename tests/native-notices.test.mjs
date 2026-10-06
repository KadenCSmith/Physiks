import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildNativeNotices, includeNativeNotices, nativePackages } from '../scripts/native-notices.mjs'
import { desktopPlan } from '../desktop/build-config.mjs'

const folders = []
afterEach(() => folders.splice(0).forEach(folder => rmSync(folder, { recursive: true, force: true })))
function fixture(license = 'MIT') {
  const root = mkdtempSync(join(tmpdir(), 'native-notices-test-')); folders.push(root)
  const source = join(root, 'registry/src/test-registry/example-1.0.0')
  const overridesDirectory = join(root, 'overrides')
  mkdirSync(source, { recursive: true }); mkdirSync(overridesDirectory)
  writeFileSync(join(overridesDirectory, 'index.json'), '{}')
  const metadata = {
    packages: [{ id: 'app', source: null }, { id: 'example', name: 'example', version: '1.0.0', license, source: 'registry+https://example.invalid/index', manifest_path: join(source, 'Cargo.toml') }],
    resolve: { root: 'app', nodes: [{ id: 'app', deps: [{ pkg: 'example', dep_kinds: [{ kind: null }] }] }, { id: 'example', deps: [] }] },
  }
  return { root, source, metadata, overridesDirectory, lockText: '', outputDirectory: join(root, 'output') }
}

describe('native distribution notices', () => {
  it.each(['aarch64-apple-darwin', 'x86_64-apple-darwin', 'x86_64-pc-windows-msvc', 'x86_64-unknown-linux-gnu'])('adds notice resources to the real %s plan', target => {
    const identity = { productName: 'Test App', appId: 'app.test', version: '1.0.0', executableName: 'test-app', storageName: 'app.test' }
    const plan = desktopPlan(identity, 'build', target)
    const config = includeNativeNotices(plan.config, '/temporary/native-notices')
    expect(config.bundle.resources).toEqual({ '/temporary/native-notices/': 'notices/' })
    if (plan.config.bundle?.macOS) expect(config.bundle.macOS).toEqual(plan.config.bundle.macOS)
  })

  it('preserves exact license text without leaking local Cargo paths', () => {
    const data = fixture()
    const license = 'MIT License\nCopyright Example Contributors\nPermission notice and warranty text.\n'
    writeFileSync(join(data.source, 'LICENSE'), license)
    expect(buildNativeNotices(data).packages).toBe(1)
    const notice = readFileSync(join(data.outputDirectory, 'NATIVE_NOTICES.txt'), 'utf8')
    expect(notice).toContain(license)
    expect(notice).toContain('https://crates.io/crates/example/1.0.0')
    expect(notice).not.toContain(data.root)
  })

  it('fails on missing license text instead of shipping an incomplete notice set', () => {
    const data = fixture()
    expect(() => buildNativeNotices(data)).toThrow('Missing native license text: example@1.0.0')
  })

  it('requires review when a new license introduces unhandled obligations', () => {
    const data = fixture('GPL-3.0-only')
    writeFileSync(join(data.source, 'LICENSE'), 'A license file alone is insufficient for this unreviewed case.')
    expect(() => buildNativeNotices(data)).toThrow('Native license obligations need review')
  })

  it('includes exact MPL sources and rejects a cache archive changed from Cargo.lock', () => {
    const data = fixture('MPL-2.0')
    writeFileSync(join(data.source, 'LICENSE.txt'), 'Mozilla Public License Version 2.0')
    const archive = Buffer.from('exact published compressed source fixture')
    const cache = join(data.root, 'registry/cache/test-registry'); mkdirSync(cache, { recursive: true })
    writeFileSync(join(cache, 'example-1.0.0.crate'), archive)
    const checksum = createHash('sha256').update(archive).digest('hex')
    data.lockText = `[[package]]\nname = "example"\nversion = "1.0.0"\nchecksum = "${checksum}"\n`
    expect(buildNativeNotices(data).sourceArchives).toBe(1)
    expect(readFileSync(join(data.outputDirectory, 'sources/example-1.0.0.crate'))).toEqual(archive)
    data.lockText = data.lockText.replaceAll('\n', '\r\n')
    expect(buildNativeNotices(data).sourceArchives).toBe(1)
    writeFileSync(join(cache, 'example-1.0.0.crate'), 'modified')
    expect(() => buildNativeNotices(data)).toThrow('does not match Cargo.lock')
  })

  it('only accepts an exact-version override with its reviewed license and checksum', () => {
    const data = fixture()
    writeFileSync(join(data.overridesDirectory, 'index.json'), JSON.stringify({ 'example@1.0.0': { license: 'MIT', file: 'license.txt', sha256: 'wrong', provenance: 'Verified upstream commit' } }))
    writeFileSync(join(data.overridesDirectory, 'license.txt'), 'MIT License')
    expect(() => buildNativeNotices(data)).toThrow('override checksum mismatch')
  })

  it('excludes build-only roots while retaining normal transitive dependencies', () => {
    const data = fixture()
    data.metadata.packages.push({ id: 'builder', source: 'registry+test', name: 'builder', version: '1' })
    data.metadata.resolve.nodes[0].deps.push({ pkg: 'builder', dep_kinds: [{ kind: 'build' }] })
    expect(nativePackages(data.metadata).map(pkg => pkg.name)).toEqual(['example'])
  })
})
