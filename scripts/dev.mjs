// One command for local development: starts MySQL (port 3307), builds the database the first
// time, then runs the API server (3001) and the website (5173). Ctrl+C stops everything.
//   npm start
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { env } from './lib/env.mjs'
import { rootConnection, setupDatabase } from './lib/setup.mjs'

const children = []
const run = (name, args) => {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  child.label = name
  const tag = `[${name}]`.padEnd(8)
  const pipe = (stream, out) => {
    let rest = ''
    stream.on('data', (d) => {
      const lines = (rest + d).split(/\r?\n/)
      rest = lines.pop()
      for (const l of lines) if (l.trim()) out.write(`${tag} ${l}\n`)
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`${tag} exited (${code}); stopping.`)
      stop()
    }
  })
  children.push(child)
  return child
}

const portOpen = (port) => new Promise((resolve) => {
  const s = createConnection({ host: '127.0.0.1', port }, () => { s.end(); resolve(true) })
  s.on('error', () => resolve(false))
})

let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  // Stop the web servers first, then ask MySQL for a clean shutdown.
  const mysqlChild = children.find((c) => c.label === 'mysql')
  for (const c of children) if (c !== mysqlChild) c.kill()
  if (mysqlChild && mysqlChild.exitCode === null) {
    mysqlChild.send('shutdown')
    mysqlChild.on('exit', () => process.exit(0))
  } else {
    process.exit(0)
  }
  setTimeout(() => process.exit(0), 20000).unref()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

if (await portOpen(env.port)) {
  console.log(`MySQL is already running on port ${env.port}.`)
} else {
  run('mysql', ['scripts/mysql-server.mjs'])
  for (let i = 0; i < 120 && !(await portOpen(env.port)); i++) await new Promise((r) => setTimeout(r, 500))
}

const conn = await rootConnection()
const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'a10_hospital'`)
await conn.end()
if (!n) {
  console.log('First run: building the database …')
  await setupDatabase({ demo: true, log: console.log })
}

run('api', ['server/index.mjs'])
run('web', ['node_modules/vite/bin/vite.js'])
console.log('\nA10 Hospital: open http://localhost:5173  (Ctrl+C to stop)\n')
