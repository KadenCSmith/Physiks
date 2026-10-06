import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createModel, parseArguments } from '../scripts/new-model.mjs'

const workspaces = []
async function workspace() {
  const rootDir = await mkdtemp(join(tmpdir(), 'cinematic-model-test-'))
  workspaces.push(rootDir)
  await mkdir(join(rootDir, 'src'))
  await writeFile(join(rootDir, 'src/models.ts'), '// Registry is intentionally edited by the app author.\n')
  return rootDir
}
afterEach(async () => { await Promise.all(workspaces.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

describe('AI model scaffold', () => {
  it('creates an independent module and test with safe identifiers and exact registration guidance', async () => {
    const rootDir = await workspace()
    const report = await createModel({ rootDir, id: 'wave-lab', title: 'Wave lab' })
    expect(report.exportName).toBe('waveLabModel')
    expect(report.files).toHaveLength(7)
    expect(report.registration).toContain("import { waveLabModel } from './models/wave-lab/model'")
    for (const path of report.files) {
      const source = await readFile(join(rootDir, path), 'utf8')
      expect(source).not.toMatch(/__MODEL_ID__|__MODEL_EXPORT__|__TITLE_LITERAL__/)
    }
    expect(await readFile(join(rootDir, 'src/models.ts'), 'utf8')).toContain('intentionally edited')
    expect(await readFile(join(rootDir, 'src/models/wave-lab/calculation.ts'), 'utf8')).not.toMatch(/from ['"]react['"]|<svg/)
  })
  it('makes dry-run entirely mutation-free', async () => {
    const rootDir = await workspace()
    const report = await createModel({ rootDir, id: 'preview-model', dryRun: true })
    expect(report.dryRun).toBe(true)
    expect(await readdir(rootDir)).toEqual(['src'])
    expect(await readdir(join(rootDir, 'src'))).toEqual(['models.ts'])
  })
  it('keeps numeric word boundaries distinct in exported identifiers', async () => {
    const rootDir = await workspace()
    const hyphenated = await createModel({ rootDir, id: 'a-1', dryRun: true })
    const compact = await createModel({ rootDir, id: 'a1', dryRun: true })
    expect(hyphenated.exportName).toBe('a_1Model')
    expect(compact.exportName).toBe('a1Model')
  })
  it.each(['../escape', 'a/b', 'Unsafe', 'bad_name', 'constructor', 'prototype', 'wave--lab'])('rejects unsafe model id %s before writing', async id => {
    const rootDir = await workspace()
    await expect(createModel({ rootDir, id })).rejects.toThrow('safe lowercase kebab')
    expect(await readdir(rootDir)).toEqual(['src'])
  })
  it('refuses both folder and test collisions while preserving existing contents', async () => {
    const rootDir = await workspace()
    await mkdir(join(rootDir, 'tests'))
    await writeFile(join(rootDir, 'tests/duplicate.test.ts'), 'existing test')
    await expect(createModel({ rootDir, id: 'duplicate' })).rejects.toThrow('Already exists: tests/duplicate.test.ts')
    expect(await readFile(join(rootDir, 'tests/duplicate.test.ts'), 'utf8')).toBe('existing test')
    expect(await readdir(join(rootDir, 'src'))).toEqual(['models.ts'])
    await mkdir(join(rootDir, 'src/models/duplicate'), { recursive: true })
    await writeFile(join(rootDir, 'src/models/duplicate/preserve.txt'), 'existing model')
    await expect(createModel({ rootDir, id: 'duplicate' })).rejects.toThrow('Already exists: src/models/duplicate')
    expect(await readFile(join(rootDir, 'src/models/duplicate/preserve.txt'), 'utf8')).toBe('existing model')
  })
  it('refuses a symlinked model destination', async () => {
    const rootDir = await workspace()
    const other = await workspace()
    await symlink(other, join(rootDir, 'src/models'), 'dir')
    await expect(createModel({ rootDir, id: 'linked-model' })).rejects.toThrow('linked or non-directory')
    expect(await readdir(other)).toEqual(['src'])
  })
  it('serializes code-like titles as inert string literals', async () => {
    const rootDir = await workspace()
    const title = 'A "quote" ${process.exit()} $& </script>'
    await createModel({ rootDir, id: 'title-test', title })
    const source = await readFile(join(rootDir, 'src/models/title-test/model.ts'), 'utf8')
    expect(source).toContain(`title: ${JSON.stringify(title)},`)
  })
  it('rejects malformed titles and unknown CLI options', async () => {
    const rootDir = await workspace()
    await expect(createModel({ rootDir, id: 'valid-id', title: ' ' })).rejects.toThrow('nonempty line')
    await expect(createModel({ rootDir, id: 'valid-id', title: 'Line\nBreak' })).rejects.toThrow('nonempty line')
    expect(() => parseArguments(['valid-id', '--force'])).toThrow('Unknown option')
    expect(parseArguments(['--dry-run', 'valid-id', 'A title'])).toEqual({ id: 'valid-id', title: 'A title', dryRun: true })
    expect(parseArguments(['--help'])).toEqual({ help: true })
  })
})
