// Starts the API server (default http://127.0.0.1:3001). In development, Vite proxies /api here.
//   npm run api
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import express from 'express'
import { env } from '../scripts/lib/env.mjs'
import { root } from '../scripts/lib/mysql-paths.mjs'
import { setupDatabase } from '../scripts/lib/setup.mjs'
import { createApp } from './app.mjs'
import { createDb } from './db.mjs'

const devTools = process.env.DEV_TOOLS !== 'off'
const db = createDb({ host: env.host, port: env.port, user: env.appUser, password: env.appPassword, prefix: env.prefix })

try {
  await db.loadCatalog()
} catch (e) {
  console.error(`Cannot reach MySQL on ${env.host}:${env.port} as ${env.appUser}: ${e.message}`)
  console.error('Start the database with "npm run db:server", and build it once with "npm run db:setup".')
  process.exit(1)
}

const app = createApp(db, {
  devTools,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173').split(','),
  onReset: async () => {
    console.log('Resetting the demo database …')
    await setupDatabase({ prefix: env.prefix, demo: true })
  },
})

// Serve the production build too, so `npm run build && npm run api` is a complete deployment.
const dist = join(root, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

app.listen(env.apiPort, '127.0.0.1', () => {
  console.log(`A10 Hospital API on http://127.0.0.1:${env.apiPort} (MySQL ${env.host}:${env.port}, account ${env.appUser})`)
})
