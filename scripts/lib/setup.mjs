// Builds the database by running database/schema.sql, seed.sql and plsql.sql, then creates the
// website's MySQL account, which may only read and change rows in a10_hospital.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import { env } from './env.mjs'
import { root } from './mysql-paths.mjs'

export function rootConnection() {
  return mysql.createConnection({
    host: env.host, port: env.port, user: 'root', password: env.rootPassword, multipleStatements: true,
  })
}

const sqlFile = (name) => readFileSync(join(root, 'database', name), 'utf8')

// Splits a script written for the mysql shell into statements, following its DELIMITER lines
// (mysql2 doesn't understand DELIMITER, which procedures and triggers need).
function splitDelimited(sql) {
  const statements = []
  let delimiter = ';'
  let current = ''
  for (const line of sql.split(/\r?\n/)) {
    const d = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i)
    if (d) {
      delimiter = d[1]
      continue
    }
    current += line + '\n'
    if (line.trimEnd().endsWith(delimiter)) {
      const statement = current.trimEnd().slice(0, -delimiter.length).trim()
      if (statement.replace(/^\s*--.*$/gm, '').trim()) statements.push(statement)
      current = ''
    }
  }
  return statements
}

export async function setupDatabase({ seed = true, log = () => {} } = {}) {
  const conn = await rootConnection()
  try {
    // Left over from the earlier, larger version of this project (and its test copies).
    const [old] = await conn.query(`SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE 'a10%' AND SCHEMA_NAME <> ?`, [env.database])
    for (const { name } of old) await conn.query(`DROP DATABASE \`${name}\``)
    const [oldUsers] = await conn.query(`SELECT user FROM mysql.user WHERE user LIKE 'a10%' AND user <> ?`, [env.appUser])
    for (const { user } of oldUsers) await conn.query(`DROP USER ?@'%'`, [user])
    log('  schema.sql')
    await conn.query(sqlFile('schema.sql'))
    if (seed) {
      log('  seed.sql')
      await conn.query(sqlFile('seed.sql'))
    }
    // After the sample rows, so the triggers check only new changes.
    log('  plsql.sql')
    for (const statement of splitDelimited(sqlFile('plsql.sql'))) await conn.query(statement)
    log(`  MySQL account ${env.appUser} for the website`)
    await conn.query(`DROP USER IF EXISTS ?@'%'`, [env.appUser])
    await conn.query(`CREATE USER ?@'%' IDENTIFIED BY ?`, [env.appUser, env.appPassword])
    await conn.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${env.database}.* TO ?@'%'`, [env.appUser])
  } finally {
    await conn.end()
  }
}
