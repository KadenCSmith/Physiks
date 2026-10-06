import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createModel } from './new-model.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const id = `scaffold-check-${randomUUID()}`
let generated = false

async function runPackageBin(packageName, binName, args) {
  const packageDir = join(root, 'node_modules', packageName)
  const metadata = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
  const bin = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin[binName]
  const result = spawnSync(process.execPath, [join(packageDir, bin), ...args], { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${binName} failed for the generated scaffold.`)
}

try {
  await createModel({ rootDir: root, id, title: 'Generated scaffold check' })
  generated = true
  console.log('Checking a fresh generated model, including its imports and tests.')
  await runPackageBin('typescript', 'tsc', ['--noEmit'])
  await runPackageBin('vitest', 'vitest', ['run', `tests/${id}.test.ts`])
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (generated) {
    try {
      await rm(join(root, 'src/models', id), { recursive: true })
      await rm(join(root, 'tests', `${id}.test.ts`))
    } catch (error) {
      console.error(`Could not remove this check's temporary model ${id}: ${error.message}`)
      process.exitCode = 1
    }
  }
}
