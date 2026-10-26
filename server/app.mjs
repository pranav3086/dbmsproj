// HTTP API used by the React app (proxied from Vite at /api in development).
import { randomBytes } from 'node:crypto'
import express from 'express'
import { createAuth, SESSION_COOKIE } from './auth.mjs'
import { ApiError, toApiError } from './db.mjs'

const BUCKETS = new Set(['lab-reports', 'credentials'])

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function createApp(db, { devTools = true, allowedOrigins = [], onReset } = {}) {
  const auth = createAuth(db)
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')

  // Signed URLs for private files: short-lived, single-purpose keys held in memory.
  const signed = new Map()

  const origin = (req) => req.get('origin') || `${req.protocol}://${req.get('host')}`
  const token = (req) => readCookie(req, SESSION_COOKIE)
  const setSession = (res, session) =>
    res.cookie(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: session.maxAge })
  const clearSession = (res) => res.clearCookie(SESSION_COOKIE, { path: '/' })

  // Cross-site request protection: state-changing requests must come from an allowed origin.
  app.use((req, res, next) => {
    const o = req.get('origin')
    if (req.method !== 'GET' && o && allowedOrigins.length && !allowedOrigins.includes(o)) {
      return res.status(403).json({ error: { message: 'Origin not allowed.' } })
    }
    next()
  })
  app.use('/api', express.json({ limit: '1mb' }))

  const route = (fn) => async (req, res) => {
    try {
      const out = await fn(req, res)
      if (!res.headersSent) res.json(out ?? null)
    } catch (e) {
      const err = toApiError(e)
      if (err.status === 401 && /sign in/i.test(err.message)) clearSession(res)
      res.status(err.status).json({ error: { message: err.message, code: err.code, hint: err.hint } })
    }
  }

  // ── Data
  app.post('/api/select', route((req) => db.select(token(req), String(req.body?.relation ?? ''), req.body?.query ?? {})))
  app.post('/api/rpc/:fn', route((req) => db.rpc(token(req), req.params.fn, req.body?.args ?? {})))
  app.post('/api/rpc-rows/:fn', route((req) => db.rpcRows(token(req), req.params.fn, req.body?.args ?? {})))
  app.post('/api/write', route((req) => {
    const { op, table, values, filters } = req.body ?? {}
    return db.write(token(req), op, String(table ?? ''), values ?? {}, filters ?? [])
  }))

  // ── Auth
  app.get('/api/auth/session', route(async (req, res) => {
    const me = await auth.whoami(token(req))
    if (!me && token(req)) clearSession(res)
    return me
  }))
  app.post('/api/auth/signup', route((req) => auth.signUp(req.body ?? {}, origin(req))))
  app.post('/api/auth/signin', route(async (req, res) => {
    const { session, user } = await auth.signIn(req.body ?? {})
    setSession(res, session)
    return user
  }))
  app.post('/api/auth/signout', route(async (req, res) => {
    await auth.signOut(token(req))
    clearSession(res)
  }))
  app.post('/api/auth/resend', route((req) => auth.resendVerification(req.body?.email, origin(req))))
  app.post('/api/auth/recover', route((req) => auth.requestPasswordReset(req.body?.email, origin(req))))
  app.post('/api/auth/reset', route(async (req, res) => {
    await auth.completePasswordReset(req.body ?? {})
    clearSession(res)
  }))
  app.post('/api/auth/verify', route(async (req, res) => {
    const { session, user } = await auth.verifyEmail(req.body?.token)
    setSession(res, session)
    return user
  }))
  app.post('/api/auth/reauth', route(async (req) => { await auth.reauthenticate(token(req), req.body?.password) }))
  app.post('/api/auth/password', route((req) => auth.changePassword(token(req), req.body?.current, req.body?.next)))

  // ── Private storage (files live in MySQL, LONGBLOB)
  app.post('/api/storage/upload', express.raw({ type: () => true, limit: '10mb' }), route(async (req) => {
    const bucket = String(req.query.bucket ?? '')
    const path = String(req.query.path ?? '')
    if (!BUCKETS.has(bucket) || !path || path.length > 400) throw new ApiError('Invalid upload location.')
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new ApiError('The file is empty.')
    await db.call(token(req), 'storage_put', [bucket, path, req.get('content-type') || 'application/octet-stream', req.body])
  }))
  app.post('/api/storage/sign', route(async (req) => {
    const { bucket, path } = req.body ?? {}
    if (!BUCKETS.has(bucket)) throw new ApiError('Invalid bucket.')
    const rows = await db.call(token(req), 'storage_get', [bucket, String(path ?? '')])
    if (!rows[0]) throw new ApiError('This document is not available.', { status: 404 })
    const key = randomBytes(24).toString('base64url')
    signed.set(key, { bucket, path, session: token(req), expires: Date.now() + 60_000 })
    for (const [k, v] of signed) if (v.expires < Date.now()) signed.delete(k)
    return { url: `/api/storage/file/${key}` }
  }))
  app.get('/api/storage/file/:key', route(async (req, res) => {
    const entry = signed.get(req.params.key)
    if (!entry || entry.expires < Date.now()) throw new ApiError('This link has expired.', { status: 404 })
    const [file] = await db.call(entry.session, 'storage_get', [entry.bucket, entry.path])
    if (!file) throw new ApiError('This document is not available.', { status: 404 })
    res.setHeader('Content-Type', file.mime)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(file.data)
  }))

  // ── Development tools (simulated mailbox, reset)
  if (devTools) {
    app.get('/api/dev/mailbox', route(() => db.rpc(null, 'dev_list_mailbox')))
    if (onReset) app.post('/api/dev/reset', route(async (req, res) => {
      await onReset()
      clearSession(res)
    }))
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: { message: 'Not found' } }))
  return app
}
