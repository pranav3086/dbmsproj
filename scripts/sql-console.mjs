// Opens the real MySQL command-line client as root on the a10_hospital database.
//   npm run db:sql                        interactive shell
//   npm run db:sql -- "SHOW TABLES"       run one statement and exit
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { env } from './lib/env.mjs'
import { exe, mysqlHome, root } from './lib/mysql-paths.mjs'

const statement = process.argv.slice(2).join(' ').trim()

// Credentials go in a temporary option file rather than on the command line.
const cnf = join(mysqlHome, `client-${process.pid}.cnf`)
writeFileSync(cnf, `[client]\nuser=root\npassword="${env.rootPassword.replace(/"/g, '\\"')}"\nhost=${env.host}\nport=${env.port}\n`)

const clientArgs = [
  `--defaults-extra-file=${cnf}`,
  '--default-character-set=utf8mb4',
  `--database=${env.database}`,
  ...(statement ? ['--table', '-e', statement] : ['--prompt', 'mysql> ']),
]

if (!statement) console.log(`MySQL shell as root on ${env.database} (try: SHOW TABLES; DESCRIBE doctors;). Type exit to leave.`)
// Run from the project folder so  SOURCE database/queries.sql;  works.
const r = spawnSync(exe('mysql'), clientArgs, { stdio: 'inherit', cwd: root })
rmSync(cnf, { force: true })
process.exit(r.status ?? 0)
