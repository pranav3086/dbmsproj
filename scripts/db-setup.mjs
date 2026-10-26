// (Re)builds the a10_hospital and a10_api databases on the project's MySQL server.
// WARNING: drops and recreates both databases — all data is replaced with fresh sample data.
//   npm run db:setup              schema + reference data + demo accounts and sample records
//   npm run db:setup -- --no-demo schema + reference data only
import { setupDatabase } from './lib/setup.mjs'
import { env } from './lib/env.mjs'

const demo = !process.argv.includes('--no-demo')
console.log(`Building the A10 Hospital database on 127.0.0.1:${env.port} …`)
try {
  await setupDatabase({ demo, log: console.log })
  console.log(`Done. Databases: a10_hospital (tables), a10_api (security views). App login: ${env.appUser}.`)
  if (demo) console.log(`Demo accounts (*@a10.example) use the password ${env.demoPassword}.`)
} catch (e) {
  console.error(`\nSetup failed: ${e.message}`)
  if (/ECONNREFUSED/.test(e.message)) console.error('Is the MySQL server running? Start it with: npm run db:server')
  process.exit(1)
}
