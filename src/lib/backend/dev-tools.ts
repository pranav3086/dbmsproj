/** Development-only helpers: demo accounts, the simulated mailbox and resetting the sample data. */
import accounts from '../../../database/demo_accounts.json'
import { BackendError } from './types'

export const DEMO_PASSWORD = 'DemoCare#2026'
export const DEMO_ACCOUNTS: { email: string; label: string }[] = accounts.map((a) => ({ email: a.email, label: a.label }))

interface MailboxMessage { id: number; to_email: string; subject: string; body: string; link: string | null; created_at: string }
interface OutboxMessage { id: string; to_email: string; subject: string; body: string; status: string; created_at: string }

async function post<T>(path: string, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const res = await fetch(`/api/dev/${path}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new BackendError(data?.error?.message ?? `Request failed (${res.status})`)
  return data as T
}

export const listDemoMailbox = () => post<{ auth: MailboxMessage[]; outbox: OutboxMessage[] }>('mailbox', 'GET')

/** Rebuilds the MySQL database with fresh sample data (all changes are lost). */
export const resetDemoDatabase = () => post<null>('reset')
