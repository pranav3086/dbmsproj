// Opens the real MySQL command-line client on the project database.
//   npm run db:sql                                   interactive shell as root (database a10_hospital)
//   npm run db:sql -- "SHOW TABLES"                  run one statement
//   npm run db:sql -- --as patient@a10.example       interactive shell as the application account,
//                                                    signed in as that user (database a10_api, rows
//                                                    filtered by the security views)
//   npm run db:sql -- --as admin@a10.example "SELECT COUNT(*) FROM consultations"
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env } from './lib/env.mjs'
import { exe, mysqlHome } from './lib/mysql-paths.mjs'
import { closeSession, openSession } from './lib/sessions.mjs'
import { rootConnection } from './lib/setup.mjs'

const args = process.argv.slice(2)
const asIdx = args.indexOf('--as')
const asEmail = asIdx >= 0 ? args[asIdx + 1] : null
if (asIdx >= 0) args.splice(asIdx, 2)
const statement = args.join(' ').trim()

let session = null
let root = null
if (asEmail) {
  root = await rootConnection()
  session = await openSession(root, asEmail)
}

// Credentials go in a temporary option file rather than on the command line.
const cnf = join(mysqlHome, `client-${process.pid}.cnf`)
const user = asEmail ? env.appUser : 'root'
const password = asEmail ? env.appPassword : env.rootPassword
writeFileSync(cnf, `[client]\nuser=${user}\npassword="${password.replace(/"/g, '\\"')}"\nhost=${env.host}\nport=${env.port}\n`)

const clientArgs = [
  `--defaults-extra-file=${cnf}`,
  '--default-character-set=utf8mb4',
  `--database=${asEmail ? 'a10_api' : 'a10_hospital'}`,
  // Every session runs in UTC; the setting below also applies to this console.
  `--init-command=SET time_zone='+00:00'${session ? `, @app_session_token='${session.token}'` : ''}`,
  ...(statement ? ['--table', '-e', statement] : ['--prompt', asEmail ? `${asEmail}> ` : 'mysql (root)> ']),
]

if (!statement) {
  console.log(asEmail
    ? `MySQL shell as the application account "${env.appUser}", signed in as ${asEmail}.\nOnly the security views in a10_api are readable (try: SHOW TABLES; SELECT * FROM appointments;). Type exit to leave.`
    : 'MySQL shell as root on a10_hospital (try: SHOW TABLES; DESCRIBE appointments;). Type exit to leave.')
}
const r = spawnSync(exe('mysql'), clientArgs, { stdio: 'inherit' })

rmSync(cnf, { force: true })
if (session) {
  await closeSession(root, session.token)
  await root.end()
}
process.exit(r.status ?? 0)
