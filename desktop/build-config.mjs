export const desktopTargets = {
  'aarch64-apple-darwin': { os: 'mac', arch: 'arm64', bundleArch: 'aarch64', bundle: 'dmg', extension: '.dmg' },
  'x86_64-apple-darwin': { os: 'mac', arch: 'x64', bundleArch: 'x64', bundle: 'dmg', extension: '.dmg' },
  'x86_64-pc-windows-msvc': { os: 'win', arch: 'x64', bundleArch: 'x64', bundle: 'nsis', extension: '.exe' },
  'x86_64-unknown-linux-gnu': { os: 'linux', arch: 'x86_64', bundleArch: 'amd64', bundle: 'appimage', extension: '.AppImage' },
}

export function hostTarget(platform = process.platform, arch = process.arch) {
  const target = { 'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin', 'win32-x64': 'x86_64-pc-windows-msvc', 'linux-x64': 'x86_64-unknown-linux-gnu' }[`${platform}-${arch}`]
  if (!target) throw new Error(`No desktop target configured for ${platform}/${arch}.`)
  return target
}

export function desktopPlan(identity, mode, target, signingIdentity) {
  if (!['dev', 'pack', 'build', 'test'].includes(mode)) throw new Error('Use desktop:dev, desktop:pack, desktop:build, or desktop:test.')
  const platform = desktopTargets[target]
  if (!platform) throw new Error(`Unsupported desktop target: ${target}`)
  const config = { productName: identity.productName, identifier: identity.appId, mainBinaryName: identity.executableName, version: identity.version }
  if (platform.os === 'mac') config.bundle = { macOS: { signingIdentity: signingIdentity || '-' } }
  // Match the pinned Tauri 2.12.1 bundler's product/version/architecture filenames.
  const bundleFilename = `${identity.productName}_${identity.version}_${platform.bundleArch}${platform.bundle === 'nsis' ? '-setup' : ''}${platform.extension}`
  return { config, platform, bundleFilename, filename: `${identity.executableName}-${identity.version}-${platform.os}-${platform.arch}${platform.extension}` }
}
