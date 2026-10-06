import { lstat, mkdir, readFile, realpath, rmdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const templatesRoot = fileURLToPath(new URL('./templates/model/', import.meta.url))
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const reservedIds = new Set(['constructor', 'prototype'])
const help = `Create a replaceable model without editing the app registry.

  npm run new:model -- <kebab-id> ["Model title"] [--dry-run]

Example: npm run new:model -- wave-lab "Wave lab"
Creates src/models/<id>/ and tests/<id>.test.ts. Existing files are never overwritten.
The generated linear response is illustrative; implement your app's actual behavior next.`

async function statOrNull(path) {
  try { return await lstat(path) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export function parseArguments(args) {
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const unknown = args.find(arg => arg.startsWith('-') && arg !== '--dry-run')
  if (unknown) throw new Error(`Unknown option: ${unknown}`)
  const positional = args.filter(arg => arg !== '--dry-run')
  if (positional.length < 1 || positional.length > 2) throw new Error(help)
  return { id: positional[0], title: positional[1], dryRun: args.includes('--dry-run') }
}

/** Exported for tests; CLI always uses this script's own repository, never a guessed cwd. */
export async function createModel({ rootDir = repositoryRoot, id, title, dryRun = false }) {
  if (typeof id !== 'string' || !idPattern.test(id) || reservedIds.has(id)) {
    throw new Error('Model id must be a safe lowercase kebab name, such as "wave-lab".')
  }
  const modelTitle = title ?? id.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
  if (typeof modelTitle !== 'string' || !modelTitle.trim() || modelTitle.length > 100 || /[\r\n]/.test(modelTitle)) {
    throw new Error('Model title must be one nonempty line of at most 100 characters.')
  }
  const root = await realpath(rootDir)
  if (!(await statOrNull(join(root, 'src/models.ts')))?.isFile()) {
    throw new Error('This workspace needs src/models.ts. Run the command from a copy of the app template.')
  }
  const modelDir = join(root, 'src/models', id)
  const testPath = join(root, 'tests', `${id}.test.ts`)
  for (const relative of ['src', 'src/models', 'tests']) {
    const info = await statOrNull(join(root, relative))
    if (info && (info.isSymbolicLink() || !info.isDirectory())) {
      throw new Error(`Refusing to write through a linked or non-directory path: ${relative}`)
    }
  }
  if (await statOrNull(modelDir)) throw new Error(`Already exists: src/models/${id}. Choose a new id; nothing was changed.`)
  if (await statOrNull(testPath)) throw new Error(`Already exists: tests/${id}.test.ts. Nothing was changed.`)
  const exportName = id.replace(/-([a-z0-9])/g, (_, char) => /[0-9]/.test(char) ? `_${char}` : char.toUpperCase()) + 'Model'
  const replacements = { __MODEL_ID__: id, __MODEL_EXPORT__: exportName, __TITLE_LITERAL__: JSON.stringify(modelTitle.trim()) }
  const paths = ['calculation.ts', 'model.ts', 'Scene.tsx', 'Lesson.tsx', 'formulas.ts', 'styles.css', 'test.ts']
  const files = await Promise.all(paths.map(async name => {
    let content = await readFile(join(templatesRoot, `${name}.template`), 'utf8')
    for (const [token, value] of Object.entries(replacements)) content = content.replaceAll(token, () => value)
    return { path: name === 'test.ts' ? testPath : join(modelDir, name), content }
  }))
  const registration = `import { ${exportName} } from './models/${id}/model'\n// Add ${exportName} to the models array in src/models.ts.`
  const report = { id, exportName, files: files.map(file => file.path.slice(root.length + 1)), registration, dryRun }
  if (dryRun) return report
  const written = []
  let createdModelDir = false
  try {
    await mkdir(dirname(modelDir), { recursive: true })
    await mkdir(dirname(testPath), { recursive: true })
    await mkdir(modelDir)
    createdModelDir = true
    for (const file of files) {
      await writeFile(file.path, file.content, { flag: 'wx' })
      written.push(file.path)
    }
  } catch (error) {
    // Only remove files this invocation exclusively created, never pre-existing paths.
    for (const path of written.reverse()) await unlink(path).catch(() => {})
    if (createdModelDir) await rmdir(modelDir).catch(() => {})
    throw error
  }
  return report
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) console.log(help)
    else {
      const report = await createModel(options)
      console.log(`${report.dryRun ? 'Would create' : 'Created'}:\n${report.files.map(path => `  ${path}`).join('\n')}`)
      console.log(`\nRegister manually in src/models.ts:\n${report.registration}`)
      console.log('\nReplace the illustrative linear response with your app specification.\nThen run npm run check:models, npm run check, and inspect npm run dev in a browser.')
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
