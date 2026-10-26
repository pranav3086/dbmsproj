// Minimal .env loader (KEY=value lines) so the scripts and the API server need no extra dependency.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './mysql-paths.mjs'

for (const file of ['.env', '.env.local']) {
  const path = join(root, file)
  if (!existsSync(path)) continue
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

export const env = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  // Schema names are <prefix>_hospital and <prefix>_api (the tests use their own prefixes).
  prefix: process.env.DB_PREFIX || 'a10',
  rootPassword: process.env.DB_ROOT_PASSWORD ?? 'A10root#2026',
  appUser: process.env.DB_APP_USER || 'a10_app',
  appPassword: process.env.DB_APP_PASSWORD || 'A10app#2026',
  apiPort: Number(process.env.API_PORT || 3001),
  demoPassword: process.env.DEMO_PASSWORD || 'DemoCare#2026',
}
