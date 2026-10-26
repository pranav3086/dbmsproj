// Builds the database from the files in database/: schema, functions, triggers, procedures,
// views, the application account and its grants, reference data and (optionally) demo data.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import mysql from 'mysql2/promise'
import { env } from './env.mjs'
import { root } from './mysql-paths.mjs'
import { hashPassword } from './passwords.mjs'
import { runSqlFile, SCHEMA_FILES } from './sql-runner.mjs'

export const demoAccounts = JSON.parse(readFileSync(join(root, 'database', 'demo_accounts.json'), 'utf8'))

export function rootConnection() {
  return mysql.createConnection({
    host: env.host, port: env.port, user: 'root', password: env.rootPassword,
    timezone: 'Z', charset: 'UTF8MB4_0900_AI_CI', dateStrings: true,
  })
}

export async function setupDatabase({ prefix = 'a10', appUser = env.appUser, appPassword = env.appPassword, demo = true, siteUrl = 'http://localhost:5173', log = () => {} } = {}) {
  const conn = await rootConnection()
  try {
    await conn.query(`SET SESSION time_zone = '+00:00', SESSION group_concat_max_len = 1048576`)
    for (const file of SCHEMA_FILES) {
      log(`  ${file}`)
      await runSqlFile(conn, file, { prefix })
    }
    log('  application account and grants')
    await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [appUser, appPassword])
    await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [appUser, appPassword])
    await conn.query(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@'%'`, [appUser])
    await runSqlFile(conn, '08_grants.sql', { prefix, appUser })
    log('  seed.sql')
    await runSqlFile(conn, 'seed.sql', { prefix })
    await conn.query(`UPDATE ${prefix}_hospital.settings SET value = JSON_QUOTE(?) WHERE \`key\` = 'site_url'`, [siteUrl])
    if (demo) {
      log('  demo accounts and sample records')
      const hash = await hashPassword(env.demoPassword)
      for (const a of demoAccounts) {
        await conn.query(
          `INSERT INTO ${prefix}_hospital.auth_users (email, password_hash, raw_user_meta_data, email_confirmed_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
          [a.email, hash, JSON.stringify(a.meta)],
        )
      }
      await runSqlFile(conn, 'demo_fixtures.sql', { prefix })
    }
  } finally {
    await conn.end()
  }
}
