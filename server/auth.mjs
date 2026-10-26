// Sign-up, sign-in, sessions, email verification and password recovery.
// The browser gets a random session token in an httpOnly cookie; MySQL stores only its
// SHA-256 hash (auth_sessions) and derives the caller's identity from it on every query.
// Emails are not sent: they are written to the development mailbox (/dev/mailbox).
import { hashPassword, verifyPassword } from '../scripts/lib/passwords.mjs'
import { newToken, tokenHash } from '../scripts/lib/sessions.mjs'
import { ApiError } from './db.mjs'

export const SESSION_COOKIE = 'a10_session'
const SESSION_HOURS = 12
const REMEMBER_HOURS = 24 * 30
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/

export function createAuth(db) {
  const failedLogins = new Map()

  const mail = (to, subject, body, link) => db.call(null, 'dev_send_mail', [to, subject, body, link])
  async function findUser(email) {
    const [user] = await db.call(null, 'auth_find_user', [String(email ?? '').trim().toLowerCase()])
    return user ?? null
  }
  async function issueToken(userId, kind) {
    const token = newToken()
    await db.call(null, 'auth_issue_token', [userId, kind, tokenHash(token)])
    return token
  }
  async function consumeToken(token, kind) {
    const [row] = await db.call(null, 'auth_consume_token', [tokenHash(String(token ?? '')), kind])
    return row
  }
  async function startSession(userId, remember) {
    const token = newToken()
    const hours = remember ? REMEMBER_HOURS : SESSION_HOURS
    await db.call(null, 'auth_create_session', [userId, tokenHash(token), hours])
    return { token, maxAge: remember ? hours * 3600_000 : undefined }
  }
  const checkPassword = (password) => {
    if (!PASSWORD_RULE.test(String(password ?? ''))) {
      throw new ApiError('Use at least 10 characters with upper- and lower-case letters, a number and a symbol.')
    }
  }

  return {
    async whoami(token) {
      if (!token) return null
      const [me] = await db.call(token, 'auth_whoami', [])
      return me ? { userId: me.user_id, email: me.email } : null
    },

    async signUp({ email, password, metadata }, origin) {
      const normalized = String(email ?? '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new ApiError('Enter a valid email address.')
      checkPassword(password)
      const result = await db.call(null, 'auth_sign_up', [normalized, await hashPassword(password), metadata ?? {}])
      const { id, existed } = result[0].result
      if (existed) {
        // Same response as a fresh sign-up, so the form never reveals registered addresses.
        await mail(normalized, 'A10 Hospital — Sign-up attempt',
          'Someone tried to create an account with this email. If this was you, sign in or reset your password instead.', `${origin}/signin`)
      } else {
        const token = await issueToken(id, 'signup')
        await mail(normalized, 'A10 Hospital — Confirm your email',
          'Please confirm your email address to activate your A10 Hospital account. This link expires in 1 hour.', `${origin}/auth/callback?verify=${token}`)
      }
      return { needsVerification: true }
    },

    async signIn({ email, password, remember }) {
      const normalized = String(email ?? '').trim().toLowerCase()
      const recent = (failedLogins.get(normalized) ?? []).filter((t) => t > Date.now() - 60_000)
      if (recent.length >= 5) throw new ApiError('Too many attempts. Please wait a minute and try again.', { status: 429 })
      const user = await findUser(normalized)
      if (!user || !(await verifyPassword(String(password ?? ''), user.password_hash))) {
        failedLogins.set(normalized, [...recent, Date.now()])
        throw new ApiError('Invalid email or password.', { status: 401 })
      }
      if (!user.email_confirmed_at) throw new ApiError('Please verify your email address before signing in.', { status: 401 })
      failedLogins.delete(normalized)
      const session = await startSession(user.id, !!remember)
      return { session, user: { userId: user.id, email: user.email } }
    },

    async signOut(token) {
      if (token) await db.call(token, 'auth_end_session', [])
    },

    async resendVerification(email, origin) {
      const user = await findUser(email)
      if (user && !user.email_confirmed_at) {
        const token = await issueToken(user.id, 'signup')
        await mail(user.email, 'A10 Hospital — Confirm your email', 'Here is a new confirmation link. It expires in 1 hour.', `${origin}/auth/callback?verify=${token}`)
      }
    },

    async requestPasswordReset(email, origin) {
      // Never reveals whether the address has an account.
      const user = await findUser(email)
      if (user) {
        const token = await issueToken(user.id, 'recovery')
        await mail(user.email, 'A10 Hospital — Reset your password',
          'We received a request to reset your password. This link expires in 1 hour. If you did not request it, you can ignore this message.',
          `${origin}/reset-password?token=${token}`)
      }
    },

    async completePasswordReset({ token, password }) {
      if (!token) throw new ApiError('This reset link is invalid or has expired. Please request a new one.')
      checkPassword(password)
      const row = await consumeToken(token, 'recovery')
      await db.call(null, 'auth_set_password', [row.user_id, await hashPassword(password)])
      await db.call(null, 'auth_confirm_email', [row.user_id])
    },

    async verifyEmail(token) {
      const row = await consumeToken(token, 'signup')
      await db.call(null, 'auth_confirm_email', [row.user_id])
      const session = await startSession(row.user_id, true)
      return { session, user: { userId: row.user_id, email: row.email } }
    },

    async reauthenticate(sessionToken, password) {
      const [me] = sessionToken ? await db.call(sessionToken, 'auth_whoami', []) : []
      if (!me) throw new ApiError('Please sign in again.', { status: 401 })
      if (!(await verifyPassword(String(password ?? ''), me.password_hash))) throw new ApiError('Your current password is incorrect.')
      return me
    },

    async changePassword(sessionToken, current, next) {
      const me = await this.reauthenticate(sessionToken, current)
      checkPassword(next)
      await db.call(sessionToken, 'auth_set_password', [me.user_id, await hashPassword(next)])
    },
  }
}
