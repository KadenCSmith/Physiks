import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  preview: { host: '127.0.0.1', port: 5184, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { math: ['katex'], react: ['react', 'react-dom'] } } } },
})
