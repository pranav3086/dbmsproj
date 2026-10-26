/**
 * Builds an isolated copy of the database (<prefix>_hospital / <prefix>_api, with its own
 * application account) on the project's MySQL server, from the same SQL files as the real one.
 * Tests then act exactly like the API server does: through the application account, with a
 * session token per user — so views, grants, procedures and triggers are all exercised for real.
 * Requires the MySQL server: npm run db:server
 */
import type { Connection } from 'mysql2/promise'
import { createDb } from '../../server/db.mjs'
import { env } from '../../scripts/lib/env.mjs'
import { closeSession, openSession } from '../../scripts/lib/sessions.mjs'
import { rootConnection, setupDatabase } from '../../scripts/lib/setup.mjs'

export type Db = ReturnType<typeof createDb>

export async function createTestDb(prefix: string) {
  const appUser = `${prefix}_app`
  const appPassword = `${prefix}-Test#2026`
  try {
    await setupDatabase({ prefix, appUser, appPassword, demo: true })
  } catch (e) {
    const msg = (e as Error).message
    if (/ECONNREFUSED/.test(msg)) throw new Error(`MySQL is not running on port ${env.port}. Start it with: npm run db:server`)
    throw e
  }
  const root: Connection = await rootConnection()
  await root.query(`SET SESSION time_zone = '+00:00'`)
  const db = createDb({ host: env.host, port: env.port, user: appUser, password: appPassword, prefix })
  const tokens = new Map<string, string>()

  return {
    db,
    root,
    prefix,
    /** Session token for an account (created on first use). null = signed out. */
    async token(email: string | null) {
      if (!email) return null
      if (!tokens.has(email)) tokens.set(email, (await openSession(root, email, { prefix })).token)
      return tokens.get(email)!
    },
    /** Creates a confirmed account through the normal sign-up trigger. */
    async createUser(email: string, meta: Record<string, unknown> = {}) {
      await root.query(
        `INSERT INTO ${prefix}_hospital.auth_users (email, raw_user_meta_data, email_confirmed_at) VALUES (?, ?, UTC_TIMESTAMP(3))`,
        [email, JSON.stringify(meta)],
      )
      const [rows] = await root.query(`SELECT id FROM ${prefix}_hospital.auth_users WHERE email = ?`, [email])
      return (rows as { id: string }[])[0].id
    },
    /** Runs SQL as root on the base tables (for setting up and checking results). */
    async q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const [rows] = await root.query(sql.replaceAll('{h}', `${prefix}_hospital`), params)
      return rows as T[]
    },
    async close() {
      for (const t of tokens.values()) await closeSession(root, t, { prefix })
      await root.query(`DROP DATABASE IF EXISTS ${prefix}_api`)
      await root.query(`DROP DATABASE IF EXISTS ${prefix}_hospital`)
      await root.query(`DROP USER IF EXISTS ?@'%'`, [appUser])
      await root.end()
      await db.end()
    },
  }
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>
