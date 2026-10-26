// Runs the project's own MySQL server (port 3307, data in ./.mysql). It is separate from any
// other MySQL service on this computer. The first run initialises an empty data directory and
// sets the root password from .env (DB_ROOT_PASSWORD, default A10root#2026).
//   npm run db:server
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import mysql from 'mysql2/promise'
import { dataDir, exe, iniFile, mysqlBin, mysqlHome } from './lib/mysql-paths.mjs'
import { env } from './lib/env.mjs'

const fwd = (p) => p.replace(/\\/g, '/')

mkdirSync(mysqlHome, { recursive: true })
// Small memory footprint: this is a single-user development database.
writeFileSync(iniFile, `[mysqld]
basedir=${fwd(mysqlBin().replace(/[\\/]bin$/, ''))}
datadir=${fwd(dataDir)}
port=${env.port}
bind-address=127.0.0.1
mysqlx=OFF
skip-log-bin
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone='+00:00'
group_concat_max_len=1048576
performance_schema=OFF
innodb_buffer_pool_size=64M
max_connections=40
`)

const fresh = !existsSync(dataDir)
if (fresh) {
  console.log('Initialising a new MySQL data directory in .mysql/data …')
  const init = spawnSync(exe('mysqld'), [`--defaults-file=${iniFile}`, '--initialize-insecure', '--console'], { stdio: 'inherit' })
  if (init.status !== 0) process.exit(init.status ?? 1)
}

console.log(`Starting MySQL on 127.0.0.1:${env.port} (Ctrl+C to stop) …`)
const server = spawn(exe('mysqld'), [`--defaults-file=${iniFile}`, '--console'], { stdio: 'inherit' })

if (fresh) {
  const open = () => new Promise((resolve) => {
    const s = createConnection({ host: '127.0.0.1', port: env.port }, () => { s.end(); resolve(true) })
    s.on('error', () => resolve(false))
  })
  for (let i = 0; i < 120 && !(await open()); i++) await new Promise((r) => setTimeout(r, 500))
  const conn = await mysql.createConnection({ host: '127.0.0.1', port: env.port, user: 'root', password: '' })
  await conn.query(`ALTER USER 'root'@'localhost' IDENTIFIED BY ?`, [env.rootPassword])
  await conn.end()
  console.log('Root password set (see DB_ROOT_PASSWORD in .env).')
}

let stopping = false
const stop = () => {
  if (stopping) return
  stopping = true
  // mysqladmin shutdown is a clean stop; fall back to killing the process.
  const r = spawnSync(exe('mysqladmin'), ['-h127.0.0.1', `-P${env.port}`, '-uroot', `-p${env.rootPassword}`, 'shutdown'], { stdio: 'ignore' })
  if (r.status !== 0) server.kill()
  setTimeout(() => server.kill(), 15000).unref()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
// Lets a parent process (scripts/dev.mjs) request a clean shutdown on Windows, where
// signals cannot be delivered to child processes.
process.on('message', (m) => { if (m === 'shutdown') stop() })
server.on('exit', (code) => process.exit(code ?? 0))
