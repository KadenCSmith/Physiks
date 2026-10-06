const { readDesktopIdentity } = require('./desktop/identity.cjs')
const identity = readDesktopIdentity()

module.exports = {
  appId: identity.appId,
  productName: identity.productName,
  executableName: identity.executableName,
  directories: { output: 'release' },
  files: ['dist/**/*', 'desktop/**/*', 'package.json'],
  asar: true,
  npmRebuild: false,
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',
  mac: { target: ['dmg'], category: 'public.app-category.education', identity: '-', hardenedRuntime: true, notarize: false, entitlements: 'desktop/entitlements.mac.plist', entitlementsInherit: 'desktop/entitlements.mac.plist' },
  win: { target: ['nsis'], signExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
  linux: { target: ['AppImage'], category: 'Education', maintainer: 'App template maintainer' },
}
