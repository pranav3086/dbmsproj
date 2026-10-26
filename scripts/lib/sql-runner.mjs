// Splits a .sql file into statements the way the `mysql` command-line client does, including
// DELIMITER directives (needed for procedures and triggers), so files can be run from Node.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './mysql-paths.mjs'

export function splitSql(sql) {
  const out = []
  let delimiter = ';'
  let buf = ''
  let i = 0
  let lineStart = true
  while (i < sql.length) {
    if (lineStart && !buf.trim()) {
      const m = sql.slice(i).match(/^[ \t]*DELIMITER[ \t]+(\S+)[ \t]*(\r?\n|$)/i)
      if (m) {
        delimiter = m[1]
        i += m[0].length
        buf = ''
        continue
      }
    }
    const c = sql[i]
    lineStart = false
    if (c === '\n') lineStart = true
    // comments
    if ((c === '-' && sql[i + 1] === '-' && /\s/.test(sql[i + 2] ?? ' ')) || c === '#') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
      continue
    }
    if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      continue
    }
    // quoted strings / identifiers
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === '\\' && c !== '`') { j += 2; continue }
        if (sql[j] === c) {
          if (sql[j + 1] === c) { j += 2; continue }
          break
        }
        j++
      }
      buf += sql.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (sql.startsWith(delimiter, i)) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      i += delimiter.length
      continue
    }
    buf += c
    i++
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/** Optional schema renaming lets the tests build an isolated copy (a10t_hospital / a10t_api). */
export function readSql(file, { prefix = 'a10', appUser } = {}) {
  let sql = readFileSync(join(root, 'database', file), 'utf8')
  if (prefix !== 'a10') sql = sql.replace(/\ba10_(hospital|api)\b/g, `${prefix}_$1`)
  if (appUser) sql = sql.replace(/'a10_app'@'%'/g, `'${appUser}'@'%'`)
  return sql
}

export async function runSqlFile(conn, file, opts) {
  for (const stmt of splitSql(readSql(file, opts))) {
    try {
      await conn.query(stmt)
    } catch (e) {
      throw new Error(`${file}: ${e.message}\n--- statement ---\n${stmt.slice(0, 400)}`)
    }
  }
}

export const SCHEMA_FILES = [
  '01_schema.sql',
  '02_functions.sql',
  '03_triggers.sql',
  '04_audit_triggers.sql',
  '05_procedures.sql',
  '06_auth_storage.sql',
  '07_views.sql',
]
