import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const apiPort = Number(process.env.API_PORT || 3001)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // The API server (server/index.mjs) owns /api; the browser talks to it through this proxy,
  // so the session cookie stays same-origin.
  server: {
    port: 5173,
    proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } },
    // MySQL writes to .mysql/data constantly; watching it would reload the page in a loop.
    watch: { ignored: ['**/.mysql/**', '**/test-results/**', '**/playwright-report/**'] },
  },
  preview: { proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
        },
      },
    },
  },
})
