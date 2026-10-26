// Creates and removes sign-in sessions directly (as root) — used by the SQL console's
// --as option and by the tests, which need "a request from user X" without a browser.
import { createHash, randomBytes } from 'node:crypto'

export const newToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex')

export async function openSession(rootConn, email, { prefix = 'a10', hours = 1 } = {}) {
  const [rows] = await rootConn.query(`SELECT id FROM ${prefix}_hospital.auth_users WHERE email = ?`, [email.toLowerCase()])
  if (!rows[0]) throw new Error(`No account with email ${email}`)
  const token = newToken()
  await rootConn.query(
    `INSERT INTO ${prefix}_hospital.auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP(3) + INTERVAL ? HOUR)`,
    [tokenHash(token), rows[0].id, hours],
  )
  return { token, userId: rows[0].id }
}

export async function closeSession(rootConn, token, { prefix = 'a10' } = {}) {
  await rootConn.query(`DELETE FROM ${prefix}_hospital.auth_sessions WHERE token_hash = ?`, [tokenHash(token)])
}
