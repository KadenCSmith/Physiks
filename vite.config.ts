/// <reference types="node" />
import { defineConfig } from 'vite'
import { appConfig } from './src/app.config'
import { name as packageName } from './package.json'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function bundledNotices() {
  return ['react', 'react-dom', 'scheduler', 'lucide-react', 'katex'].map(dependency => {
    const directory = join(process.cwd(), 'node_modules', dependency)
    const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { version: string }
    const license = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].find(file => existsSync(join(directory, file)))
    if (!license) throw new Error(`Missing bundled-library license: ${dependency}`)
    return `${dependency} ${metadata.version}\n${readFileSync(join(directory, license), 'utf8')}`
  }).join('\n\n')
}
export default defineConfig({
  plugins: [{ name: 'app-metadata', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'app-metadata.json', source: JSON.stringify({ id: appConfig.id, title: appConfig.title, version: appConfig.version, packageName }) })
    this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source: bundledNotices() })
  } }],
  base: './',
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 5184, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { math: ['katex'], react: ['react', 'react-dom'] } } } },
})
