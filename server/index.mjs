// A10 Hospital web server: serves the website in public/ and a small API that lists, inserts,
// updates and deletes rows in the 8 tables. Every response that changes data also returns the
// exact SQL statement that was run, so the website can show it.
//   npm run web
import express from 'express'
import mysql from 'mysql2/promise'
import { join } from 'node:path'
import { env } from '../scripts/lib/env.mjs'
import { root } from '../scripts/lib/mysql-paths.mjs'
import { TABLES } from '../scripts/lib/tables.mjs'


const pool = mysql.createPool({
  host: env.host, port: env.port, user: env.appUser, password: env.appPassword,
  database: env.database, dateStrings: true, connectionLimit: 5,
})

async function columns(table) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_TYPE AS columnType, IS_NULLABLE = 'YES' AS nullable,
            COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLUMN_KEY AS \`key\`
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [env.database, table],
  )
  const [fks] = await pool.query(
    `SELECT COLUMN_NAME AS name, REFERENCED_TABLE_NAME AS refTable
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [env.database, table],
  )
  return cols.map((c) => ({
    ...c,
    nullable: Boolean(c.nullable),
    autoIncrement: c.extra.includes('auto_increment'),
    enumValues: c.type === 'enum' ? c.columnType.slice(5, -1).split(',').map((v) => v.slice(1, -1).replace(/''/g, "'")) : null,
    references: fks.find((f) => f.name === c.name)?.refTable ?? null,
  }))
}

// Keeps only real, editable columns from the submitted form, so names can be put in the SQL safely.
async function cleanValues(table, body) {
  const cols = await columns(table)
  const values = {}
  for (const c of cols) {
    if (c.autoIncrement || !(c.name in body)) continue
    let v = body[c.name]
    if (v === '' || v === undefined) {
      if (c.nullable) v = null
      else if (c.defaultValue !== null) continue
    }
    values[c.name] = v
  }
  return values
}

const app = express()
app.use(express.json())
app.use(express.static(join(root, 'public')))

app.param('table', (req, res, next, table) => {
  if (!TABLES.includes(table)) return res.status(404).json({ error: `Unknown table ${table}` })
  next()
})

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req))
  } catch (e) {
    res.status(e.sqlMessage ? 400 : 500).json({ error: e.sqlMessage ?? e.message, sql: e.sql })
  }
}

app.get('/api/tables', handle(async () => {
  const [counts] = await pool.query(TABLES.map((t) => `SELECT '${t}' AS name, COUNT(*) AS \`rows\` FROM ${t}`).join(' UNION ALL '))
  return counts
}))

app.get('/api/tables/:table', handle(async (req) => {
  const t = req.params.table
  const [rows] = await pool.query(`SELECT * FROM ${t} ORDER BY id`)
  return { name: t, columns: await columns(t), rows }
}))

app.post('/api/tables/:table', handle(async (req) => {
  const t = req.params.table
  const values = await cleanValues(t, req.body)
  const sql = mysql.format(`INSERT INTO ${t} (??) VALUES (?)`, [Object.keys(values), Object.values(values)])
  const [result] = await pool.query(sql)
  return { sql, id: result.insertId }
}))

app.put('/api/tables/:table/:id', handle(async (req) => {
  const t = req.params.table
  const values = await cleanValues(t, req.body)
  const sql = mysql.format(`UPDATE ${t} SET ? WHERE id = ?`, [values, Number(req.params.id)])
  const [result] = await pool.query(sql)
  return { sql, changed: result.affectedRows }
}))

app.delete('/api/tables/:table/:id', handle(async (req) => {
  const sql = mysql.format(`DELETE FROM ${req.params.table} WHERE id = ?`, [Number(req.params.id)])
  const [result] = await pool.query(sql)
  return { sql, deleted: result.affectedRows }
}))

app.listen(env.webPort, '127.0.0.1', () => {
  console.log(`A10 Hospital website: http://localhost:${env.webPort}`)
})
