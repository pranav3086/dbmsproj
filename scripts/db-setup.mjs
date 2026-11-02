// (Re)builds the a10_hospital database on the project's MySQL server.
// WARNING: drops and recreates the database, so all rows are replaced with the sample data.
//   npm run db:setup              8 tables + sample data
//   npm run db:setup -- --empty   8 tables only
import { setupDatabase } from './lib/setup.mjs'
import { env } from './lib/env.mjs'

const seed = !process.argv.includes('--empty')
console.log(`Building the ${env.database} database on 127.0.0.1:${env.port} …`)
try {
  await setupDatabase({ seed, log: console.log })
  console.log('Done.')
} catch (e) {
  console.error(`\nSetup failed: ${e.message}`)
  if (/ECONNREFUSED/.test(e.message)) console.error('Is the MySQL server running? Start it with: npm run db:server')
  process.exit(1)
}
