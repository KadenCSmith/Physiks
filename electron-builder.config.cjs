const { readDesktopIdentity } = require('./desktop/identity.cjs')
const identity = readDesktopIdentity()

module.exports = {
  appId: identity.appId,
  productName: identity.productName,
  executableName: identity.executableName,
  directories: { app: 'release/staged-app', output: 'release' },
  // The packager may search the parent project's dependencies even when the
  // staged app has none. Keep this explicit exclusion as well as staging.
  files: ['dist/**/*', 'desktop/**/*', 'package.json', 'THIRD_PARTY_NOTICES.txt', '!**/node_modules/**/*'],
  asar: true,
  npmRebuild: false,
  artifactName: '${name}-${version}-${os}-${arch}.${ext}',
  mac: { target: ['dmg'], category: 'public.app-category.education', identity: '-', hardenedRuntime: true, notarize: false, entitlements: 'desktop/entitlements.mac.plist', entitlementsInherit: 'desktop/entitlements.mac.plist' },
  win: { target: ['nsis'], signExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
  linux: { target: ['AppImage'], category: 'Education', maintainer: 'App template maintainer' },
}
