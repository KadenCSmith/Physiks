import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const stage = join(root, 'release', 'staged-app')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (!existsSync(join(root, 'dist', 'index.html')) || !existsSync(join(root, 'dist', 'app-metadata.json'))) {
  throw new Error('Build the web app before staging the desktop package.')
}

// The renderer dependencies are already bundled by Vite. Electron's main
// process imports only its own API, Node built-ins, and these local files.
// A separate manifest prevents the packager from including a second copy of
// every renderer dependency (including entire icon and math source packages).
const runtimeManifest = Object.fromEntries(
  ['name', 'version', 'description', 'author', 'license', 'homepage', 'repository', 'type', 'main']
    .filter(key => manifest[key] !== undefined)
    .map(key => [key, manifest[key]]),
)

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
for (const directory of ['dist', 'desktop']) cpSync(join(root, directory), join(stage, directory), { recursive: true })
writeFileSync(join(stage, 'package.json'), `${JSON.stringify(runtimeManifest, null, 2)}\n`)

// Preserve the licenses of renderer libraries when their source packages are
// omitted. The license notices do not assign a license to this template.
const notices = ['Third-party libraries bundled into the renderer.\n']
for (const dependency of ['react', 'react-dom', 'scheduler', 'lucide-react', 'katex']) {
  const directory = join(root, 'node_modules', dependency)
  const dependencyManifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  const licenseFile = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find(file => existsSync(join(directory, file)))
  if (!licenseFile) throw new Error(`Missing bundled-library license: ${dependency}`)
  notices.push(`${dependency} ${dependencyManifest.version}\n${readFileSync(join(directory, licenseFile), 'utf8')}`)
}
writeFileSync(join(stage, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n'))
console.log('Staged desktop app without duplicate renderer node_modules.')
