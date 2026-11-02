// One command to run the project: starts MySQL (port 3307), builds the database if it is
// missing, then runs the website (port 3000). Ctrl+C stops everything.
//   npm start
import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { env } from './lib/env.mjs'
import { rootConnection, setupDatabase } from './lib/setup.mjs'
import { TABLES } from './lib/tables.mjs'

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
  // Stop the website first, then ask MySQL for a clean shutdown.
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

// Build the database the first time, or if it is not exactly the 8 tables.
const conn = await rootConnection()
const [found] = await conn.query(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`, [env.database])
await conn.end()
if (found.length !== TABLES.length || !found.every((t) => TABLES.includes(t.name))) {
  console.log('Building the database …')
  await setupDatabase({ log: console.log })
}

run('web', ['server/index.mjs'])
console.log(`\nA10 Hospital: open http://localhost:${env.webPort}  (Ctrl+C to stop)\n`)
