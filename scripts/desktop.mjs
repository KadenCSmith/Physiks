import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesktopIdentity } from '../desktop/identity.cjs'
import { desktopPlan, hostTarget } from '../desktop/build-config.mjs'
import { resolveInstaller } from '../desktop/installer.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [mode, ...options] = process.argv.slice(2)
let target = hostTarget()
if (options.length) {
  if (options.length !== 2 || options[0] !== '--target') throw new Error('Only --target <Rust target> is supported.')
  target = options[1]
}

function run(command, args) {
  const desktopEnvironment = { ...process.env }
  // Empty GitHub secrets must be absent, not mistaken for notarization credentials.
  for (const name of ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID']) {
    if (!desktopEnvironment[name]) delete desktopEnvironment[name]
  }
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: desktopEnvironment })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

// Build local assets; remote code and a separately installed browser are unnecessary.
run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--base=./'])
const identity = readDesktopIdentity()
const plan = desktopPlan(identity, mode, target, process.env.APPLE_SIGNING_IDENTITY)
if (mode === 'test') {
  run('cargo', ['test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml'])
} else {
  const args = [mode === 'dev' ? 'dev' : 'build', '--config', JSON.stringify(plan.config)]
  if (mode === 'dev') args.push('--no-watch')
  else {
    args.push('--target', target, '--ci')
    if (mode === 'pack') args.push(...(plan.platform.os === 'mac' ? ['--bundles', 'app'] : ['--no-bundle']))
    else args.push('--bundles', plan.platform.bundle)
  }
  run(process.execPath, [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), ...args])
  if (mode === 'build') {
    const folder = join(root, 'src-tauri/target', target, 'release/bundle', plan.platform.bundle)
    const installer = resolveInstaller(folder, plan.bundleFilename)
    mkdirSync(join(root, 'release'), { recursive: true })
    copyFileSync(installer, join(root, 'release', plan.filename))
    console.log(`Download ready: release/${plan.filename}`)
  }
}
