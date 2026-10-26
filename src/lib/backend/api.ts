/**
 * MySQL BACKEND — talks to the A10 Hospital API server (server/), which runs every request on
 * MySQL as the signed-in user. Rows are filtered by the security views in a10_api and changes go
 * through stored procedures in a10_hospital, so the browser never decides who may see what.
 * The session lives in an httpOnly cookie that scripts on this page cannot read.
 */
import { BackendError, type AuthApi, type AuthEvent, type Backend, type Filter, type SelectQuery, type Session } from './types'

interface ErrorBody {
  error?: { message?: string; code?: string; hint?: string }
}

async function request<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: body === undefined && !init.body ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: init.body ? init.headers : { 'Content-Type': 'application/json' },
      body: init.body ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
  } catch {
    throw new BackendError('Cannot reach the A10 Hospital server. Please check that it is running and try again.')
  }
  const data = (await res.json().catch(() => null)) as (T & ErrorBody) | null
  if (!res.ok) {
    const e = data?.error
    throw new BackendError(e?.message ?? `Request failed (${res.status})`, e?.code, e?.hint)
  }
  return data as T
}

export function createApiBackend(): Backend {
  const listeners = new Set<(e: AuthEvent, s: Session | null) => void>()
  const emit = (e: AuthEvent, s: Session | null) => listeners.forEach((l) => l(e, s))

  const auth: AuthApi = {
    getSession: () => request<Session | null>('/auth/session'),
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    signUp: (input) => request<{ needsVerification: boolean }>('/auth/signup', input),
    async signIn(email, password, remember) {
      const s = await request<Session>('/auth/signin', { email, password, remember })
      emit('SIGNED_IN', s)
      return s
    },
    async signOut() {
      await request('/auth/signout', {})
      emit('SIGNED_OUT', null)
    },
    resendVerification: (email) => request('/auth/resend', { email }),
    requestPasswordReset: (email) => request('/auth/recover', { email }),
    async completePasswordReset({ token, password }) {
      await request('/auth/reset', { token, password })
      emit('SIGNED_OUT', null)
    },
    async handleCallback(params) {
      const token = params.get('verify')
      if (!token) return auth.getSession()
      const s = await request<Session>('/auth/verify', { token })
      emit('SIGNED_IN', s)
      return s
    },
    reauthenticate: (password) => request('/auth/reauth', { password }),
    changePassword: (current, next) => request('/auth/password', { current, next }),
  }

  return {
    mode: 'mysql',
    auth,
    storage: {
      async upload(bucket, path, file) {
        if (file.size > 10 * 1024 * 1024) throw new BackendError('Files must be 10 MB or smaller.')
        const qs = new URLSearchParams({ bucket, path })
        await request(`/storage/upload?${qs}`, undefined, {
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        })
      },
      async signedUrl(bucket, path) {
        const { url } = await request<{ url: string }>('/storage/sign', { bucket, path })
        return url
      },
    },
    select: <T,>(relation: string, query: SelectQuery = {}) =>
      request<{ rows: T[]; count: number | null }>('/select', { relation, query }),
    rpc: <T,>(fn: string, args: Record<string, unknown> = {}) => request<T>(`/rpc/${encodeURIComponent(fn)}`, { args }),
    rpcRows: <T,>(fn: string, args: Record<string, unknown> = {}) => request<T[]>(`/rpc-rows/${encodeURIComponent(fn)}`, { args }),
    async insert<T>(table: string, values: Record<string, unknown>) {
      const rows = await request<T[]>('/write', { op: 'insert', table, values })
      return rows[0]
    },
    update: <T,>(table: string, values: Record<string, unknown>, filters: Filter[]) =>
      request<T[]>('/write', { op: 'update', table, values, filters }),
    async remove(table: string, filters: Filter[]) {
      await request('/write', { op: 'remove', table, filters })
    },
  }
}
