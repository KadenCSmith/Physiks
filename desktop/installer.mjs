import { lstatSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Select only this build's expected artifact; preserve every other file. */
export function resolveInstaller(folder, filename) {
  if (!filename || basename(filename) !== filename || /[/\\]/.test(filename)) {
    throw new Error('Installer filename must be a single filename within its bundle folder.')
  }
  const installer = join(folder, filename)
  let metadata
  try {
    metadata = lstatSync(installer)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    throw new Error(`Expected this build's installer at ${installer}. Older or unrelated installers will not be selected.`)
  }
  if (!metadata.isFile()) throw new Error(`Expected a regular installer file at ${installer}.`)
  return installer
}
