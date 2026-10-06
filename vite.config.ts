import { defineConfig } from 'vite'
import { appConfig } from './src/app.config'
import { name as packageName } from './package.json'
export default defineConfig({
  plugins: [{ name: 'app-metadata', generateBundle() { this.emitFile({ type: 'asset', fileName: 'app-metadata.json', source: JSON.stringify({ id: appConfig.id, title: appConfig.title, version: appConfig.version, packageName }) }) } }],
  base: './',
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 5184, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { math: ['katex'], react: ['react', 'react-dom'] } } } },
})
