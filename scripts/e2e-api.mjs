// Used by Playwright: rebuilds the isolated e2e database (DB_PREFIX, e.g. a10e_*), then starts
// the API server on it. Your own a10_* demo data is not touched.
import { env } from './lib/env.mjs'
import { setupDatabase } from './lib/setup.mjs'

await setupDatabase({ prefix: env.prefix, appUser: env.appUser, appPassword: env.appPassword, demo: true, siteUrl: 'http://localhost:5174' })
await import('../server/index.mjs')
