import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const digest = data => createHash('sha256').update(data).digest('hex')
const supportedTerms = new Set(['MIT', 'MIT-0', 'Apache-2.0', 'LLVM-exception', 'BSD-2-Clause', 'BSD-3-Clause', 'Unlicense', 'Zlib', 'Unicode-3.0', 'CC0-1.0', '0BSD', 'ISC', 'MPL-2.0', 'AND', 'OR', 'WITH'])

export function includeNativeNotices(config, directory) {
  return { ...config, bundle: { ...config.bundle, resources: {
    ...config.bundle?.resources, [`${directory.replaceAll('\\', '/')}/`]: 'notices/',
  } } }
}

/** A conservative normal dependency closure includes proc-macro dependencies.
 * Target filtering is done by locked Cargo metadata, not platform-name guesses.
 */
export function nativePackages(metadata) {
  const packages = new Map(metadata.packages.map(pkg => [pkg.id, pkg]))
  const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]))
  const seen = new Set()
  function visit(id) {
    if (seen.has(id)) return
    seen.add(id)
    for (const dependency of nodes.get(id)?.deps ?? []) {
      if (dependency.dep_kinds.some(kind => kind.kind === null)) visit(dependency.pkg)
    }
  }
  visit(metadata.resolve.root)
  return [...seen].map(id => packages.get(id)).filter(pkg => pkg?.source)
    .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
}

function licenseFiles(directory, relative = '') {
  return readdirSync(join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    const file = join(relative, entry.name)
    if (entry.isSymbolicLink()) return []
    if (entry.isDirectory()) return licenseFiles(directory, file)
    return /^(licen[cs]e|copying|copyright|notice)([._-]|$)/i.test(entry.name) ? [file] : []
  }).sort()
}

export function buildNativeNotices({ metadata, lockText, outputDirectory, overridesDirectory }) {
  lockText = lockText.replaceAll('\r\n', '\n')
  const overrides = JSON.parse(readFileSync(join(overridesDirectory, 'index.json'), 'utf8'))
  const texts = new Map()
  const entries = []
  const archives = []
  for (const pkg of nativePackages(metadata)) {
    const key = `${pkg.name}@${pkg.version}`
    if (!pkg.license || !pkg.source.startsWith('registry+')) throw new Error(`Native license review required: ${key} (${pkg.license ?? 'no license'})`)
    if ((pkg.license.match(/[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? []).some(term => !supportedTerms.has(term))) {
      throw new Error(`Native license obligations need review: ${key} (${pkg.license})`)
    }
    const directory = dirname(pkg.manifest_path)
    let files = licenseFiles(directory).map(file => ({ text: readFileSync(join(directory, file), 'utf8'), origin: file.replaceAll('\\', '/') }))
    if (!files.length) {
      const override = overrides[key]
      if (!override || override.license !== pkg.license) throw new Error(`Missing native license text: ${key}; add a verified, versioned override.`)
      const text = readFileSync(join(overridesDirectory, override.file), 'utf8')
      if (digest(text) !== override.sha256) throw new Error(`Native license override checksum mismatch: ${key}`)
      files = [{ text, origin: override.provenance }]
    }
    const licenses = files.map(({ text, origin }) => {
      const sha256 = digest(text)
      texts.set(sha256, text)
      return { textId: sha256, origin }
    })
    const entry = { name: pkg.name, version: pkg.version, license: pkg.license,
      source: `https://crates.io/crates/${pkg.name}/${pkg.version}`, licenses }
    // Supply exact unmodified MPL sources alongside the executable, so source
    // availability does not depend on an upstream website remaining reachable.
    if (pkg.license.includes('MPL-2.0')) {
      const archiveName = `${pkg.name}-${pkg.version}.crate`
      const registry = dirname(dirname(dirname(directory)))
      const archive = join(registry, 'cache', dirname(directory).split(/[\\/]/).at(-1), archiveName)
      if (!existsSync(archive)) throw new Error(`Missing exact MPL source archive: ${key}; run cargo fetch --locked.`)
      const block = lockText.split('[[package]]').find(part => part.includes(`name = ${JSON.stringify(pkg.name)}\n`) && part.includes(`version = ${JSON.stringify(pkg.version)}\n`))
      const checksum = block?.match(/^checksum = "([a-f0-9]{64})"$/m)?.[1]
      if (!checksum || digest(readFileSync(archive)) !== checksum) throw new Error(`MPL source archive does not match Cargo.lock: ${key}`)
      entry.bundledSource = `sources/${archiveName}`
      entry.sourceSha256 = checksum
      archives.push({ archive, archiveName })
    }
    entries.push(entry)
  }
  rmSync(outputDirectory, { recursive: true, force: true })
  mkdirSync(join(outputDirectory, 'sources'), { recursive: true })
  for (const { archive, archiveName } of archives) copyFileSync(archive, join(outputDirectory, 'sources', archiveName))
  const header = 'Native third-party notices\n\nThese notices apply to dependencies, not a license assignment to this app.\nThe inventory conservatively includes normal dependencies and proc-macro dependencies.\nMPL-2.0 source archives are unmodified published .crate files (gzip tar archives), verified against Cargo.lock and included under sources/. Their source remains governed by MPL-2.0.\n\n'
  const inventory = entries.map(entry => `${entry.name} ${entry.version}\nLicense: ${entry.license}\nSource: ${entry.source}\n${entry.bundledSource ? `Bundled MPL source: ${entry.bundledSource}\nSHA-256: ${entry.sourceSha256}\n` : ''}${entry.licenses.map(license => `License text ${license.textId}\nOrigin: ${license.origin}`).join('\n')}\n`).join('\n')
  const body = [...texts].sort(([a], [b]) => a.localeCompare(b)).map(([id, text]) => `\n===== License text ${id} =====\n${text}`).join('\n')
  writeFileSync(join(outputDirectory, 'NATIVE_NOTICES.txt'), header + inventory + body)
  writeFileSync(join(outputDirectory, 'native-inventory.json'), JSON.stringify(entries, null, 2) + '\n')
  return { directory: outputDirectory, packages: entries.length, sourceArchives: archives.length }
}

export function generateNativeNotices(root, target) {
  const result = spawnSync('cargo', ['metadata', '--offline', '--locked', '--manifest-path', 'src-tauri/Cargo.toml', '--format-version', '1', '--filter-platform', target, '--features', 'custom-protocol'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`Cannot read locked Cargo metadata after fetch: ${result.error?.message ?? result.stderr}`)
  return buildNativeNotices({ metadata: JSON.parse(result.stdout), lockText: readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8'),
    outputDirectory: resolve(root, 'release/native-notices'), overridesDirectory: join(root, 'desktop/license-overrides') })
}
