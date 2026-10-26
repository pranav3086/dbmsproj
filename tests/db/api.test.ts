import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app.mjs'
import { createTestDb, type TestDb } from './harness'

let t: TestDb
let server: Server
let base = ''

beforeAll(async () => {
  t = await createTestDb('a10u')
  server = createApp(t.db, { devTools: true }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})
afterAll(async () => {
  server?.close()
  await t?.close()
})

/** Minimal cookie-keeping client, like a browser tab. */
function client() {
  let cookie = ''
  return async (path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    return { status: res.status, body: await res.json(), cookie: set }
  }
}

describe('HTTP API', () => {
  it('signs up, verifies by email link, signs in and reads only own data', async () => {
    const tab = client()
    const signup = await tab('/auth/signup', { email: 'new.patient@a10.example', password: 'Str0ng#Password', metadata: { full_name: 'New Patient' } })
    expect(signup.body).toEqual({ needsVerification: true })

    const early = await tab('/auth/signin', { email: 'new.patient@a10.example', password: 'Str0ng#Password', remember: false })
    expect(early.status).toBe(401)
    expect(early.body.error.message).toMatch(/verify your email/)

    const mail = await tab('/dev/mailbox')
    const link: string = mail.body.auth.find((m: { to_email: string }) => m.to_email === 'new.patient@a10.example').link
    const token = new URL(link).searchParams.get('verify')
    const verified = await tab('/auth/verify', { token })
    expect(verified.body.email).toBe('new.patient@a10.example')
    expect(verified.cookie).toMatch(/a10_session=.+; .*HttpOnly/i)

    const access = await tab('/rpc/get_my_access', { args: {} })
    expect(access.body.roles).toEqual(['patient'])
    const appts = await tab('/select', { relation: 'v_appointments', query: {} })
    expect(appts.body.rows).toEqual([])

    expect((await tab('/auth/verify', { token })).status).toBe(400) // single use
  })

  it('rejects wrong passwords and unknown relations, functions and columns', async () => {
    const tab = client()
    expect((await tab('/auth/signin', { email: 'patient@a10.example', password: 'wrong', remember: false })).status).toBe(401)
    expect((await tab('/select', { relation: 'auth_users', query: {} })).status).toBe(404)
    expect((await tab('/rpc/bootstrap_admin', { args: { p_email: 'patient@a10.example' } })).status).toBe(404)
    expect((await tab('/select', { relation: 'v_doctors', query: { filters: [{ col: 'id; DROP TABLE x', op: 'eq', value: 1 }] } })).status).toBe(400)
  })

  it('a signed-in session sees its rows; signing out ends the session in the database', async () => {
    const tab = client()
    const s = await tab('/auth/signin', { email: 'patient@a10.example', password: 'DemoCare#2026', remember: true })
    expect(s.status).toBe(200)
    const rows = (await tab('/select', { relation: 'v_appointments', query: { count: true } })).body
    expect(rows.count).toBe(5)
    await tab('/auth/signout', {})
    expect((await tab('/auth/session')).body).toBeNull()
    expect((await tab('/select', { relation: 'v_appointments', query: {} })).body.rows).toEqual([])
  })

  it('password reset uses a single-use emailed token', async () => {
    const tab = client()
    await tab('/auth/recover', { email: 'patient2@a10.example' })
    const mail = await tab('/dev/mailbox')
    const link: string = mail.body.auth.find((m: { subject: string; to_email: string }) => m.to_email === 'patient2@a10.example' && /Reset/.test(m.subject)).link
    const token = new URL(link).searchParams.get('token')
    expect((await tab('/auth/reset', { token, password: 'weak' })).status).toBe(400)
    expect((await tab('/auth/reset', { token, password: 'N3w#Password!' })).status).toBe(200)
    expect((await tab('/auth/signin', { email: 'patient2@a10.example', password: 'N3w#Password!', remember: false })).status).toBe(200)
  })
})
