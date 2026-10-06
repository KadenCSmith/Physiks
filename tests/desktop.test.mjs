import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readDesktopIdentity } from '../desktop/identity.cjs'
import { desktopPlan, desktopTargets, hostTarget } from '../desktop/build-config.mjs'
import { resolveInstaller } from '../desktop/installer.mjs'

const temporary = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe('desktop identity and platform packaging', () => {
  it('derives branding and isolated settings from the actual app metadata', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cinematic-desktop-test-'))
    temporary.push(dir)
    await writeFile(join(dir, 'app-metadata.json'), JSON.stringify({ id: 'wave-lab', title: 'Wave: lab', packageName: '@owner/wave-lab', version: '1.2.3' }))
    expect(readDesktopIdentity(dir)).toEqual({ productName: 'Wave lab', appId: 'app.cinematic.wave-lab', storageName: 'app.cinematic.wave-lab', executableName: 'owner-wave-lab', version: '1.2.3' })
    await writeFile(join(dir, 'app-metadata.json'), JSON.stringify({ title: 'Missing ID', packageName: 'bad', version: '1.0.0' }))
    expect(() => readDesktopIdentity(dir)).toThrow('Invalid desktop identity')
  })
  const identity = { productName: 'Wave lab', appId: 'app.cinematic.wave-lab', executableName: 'wave-lab', version: '1.2.3' }
  it.each(Object.keys(desktopTargets))('builds an explicitly supported target: %s', target => {
    const plan = desktopPlan(identity, 'build', target)
    expect(plan.config.identifier).toBe(identity.appId)
    expect(plan.config.productName).toBe(identity.productName)
    expect(plan.config.version).toBe(identity.version)
    expect(plan.filename).toBe(`wave-lab-1.2.3-${plan.platform.os}-${plan.platform.arch}${plan.platform.extension}`)
  })
  it('selects Apple Silicon and Intel separately and rejects an unconfigured processor', () => {
    expect(hostTarget('darwin', 'arm64')).toBe('aarch64-apple-darwin')
    expect(hostTarget('darwin', 'x64')).toBe('x86_64-apple-darwin')
    expect(() => hostTarget('linux', 'arm64')).toThrow('No desktop target configured')
    expect(() => desktopPlan(identity, 'build', 'unconfigured')).toThrow('Unsupported desktop target')
    expect(() => desktopPlan(identity, 'unknown', 'aarch64-apple-darwin')).toThrow('Use desktop:dev')
  })
  it('uses owner supplied signing identity without inventing a certificate', () => {
    expect(desktopPlan(identity, 'build', 'aarch64-apple-darwin').config.bundle.macOS.signingIdentity).toBe('-')
    expect(desktopPlan(identity, 'build', 'aarch64-apple-darwin', 'Developer ID Application: Owner (TEAM)').config.bundle.macOS.signingIdentity).toBe('Developer ID Application: Owner (TEAM)')
  })
  it.each([
    ['aarch64-apple-darwin', 'Wave lab_1.2.3_aarch64.dmg'],
    ['x86_64-apple-darwin', 'Wave lab_1.2.3_x64.dmg'],
    ['x86_64-pc-windows-msvc', 'Wave lab_1.2.3_x64-setup.exe'],
    ['x86_64-unknown-linux-gnu', 'Wave lab_1.2.3_amd64.AppImage'],
  ])('matches Tauri artifact naming for %s', (target, filename) => {
    expect(desktopPlan(identity, 'build', target).bundleFilename).toBe(filename)
  })
  it('selects the current installer while preserving previous versions and unrelated products', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cinematic-installers-test-'))
    temporary.push(dir)
    const plan = desktopPlan(identity, 'build', 'x86_64-pc-windows-msvc')
    const files = ['Wave lab_1.2.2_x64-setup.exe', 'Other app_1.2.3_x64-setup.exe', 'Wave lab_1.2.3_arm64-setup.exe', plan.bundleFilename]
    await Promise.all(files.map(name => writeFile(join(dir, name), name)))
    const selected = resolveInstaller(dir, plan.bundleFilename)
    expect(selected).toBe(join(dir, 'Wave lab_1.2.3_x64-setup.exe'))
    expect(await readFile(selected, 'utf8')).toBe(plan.bundleFilename)
    expect((await readdir(dir)).sort()).toEqual([...files].sort())
    await rm(selected)
    expect(() => resolveInstaller(dir, plan.bundleFilename)).toThrow('Older or unrelated installers will not be selected')
    expect((await readdir(dir)).sort()).toEqual(files.filter(name => name !== plan.bundleFilename).sort())
  })
  it('rejects a directory, symlink, or path outside the bundle folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cinematic-installer-path-test-'))
    temporary.push(dir)
    await mkdir(join(dir, 'directory.dmg'))
    await writeFile(join(dir, 'actual.dmg'), 'installer')
    expect(() => resolveInstaller(dir, 'directory.dmg')).toThrow('regular installer file')
    // Creating a file symlink on Windows can require privileges a normal clone lacks.
    if (process.platform !== 'win32') {
      await symlink(join(dir, 'actual.dmg'), join(dir, 'linked.dmg'))
      expect(() => resolveInstaller(dir, 'linked.dmg')).toThrow('regular installer file')
    }
    for (const filename of ['../actual.dmg', '..\\actual.dmg', '/actual.dmg']) {
      expect(() => resolveInstaller(dir, filename)).toThrow('single filename')
    }
  })
})
