/**
 * The narrow data-access contract the UI depends on. It is implemented by api.ts, which calls
 * the A10 Hospital API server (MySQL). Services in src/services call only this interface.
 */

export type FilterOp = 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte' | 'is' | 'ilike'
export interface Filter {
  col: string
  op: FilterOp
  value: unknown
}

export interface SelectQuery {
  columns?: string
  filters?: Filter[]
  /** Case-insensitive "contains" search across columns (OR). */
  search?: { cols: string[]; term: string }
  order?: { col: string; asc?: boolean }[]
  limit?: number
  offset?: number
  count?: boolean
}

export interface SelectResult<T> {
  rows: T[]
  count: number | null
}

export interface Session {
  userId: string
  email: string
}

export interface SignUpInput {
  email: string
  password: string
  metadata: Record<string, unknown>
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'INITIAL'

export interface AuthApi {
  getSession(): Promise<Session | null>
  onChange(cb: (event: AuthEvent, session: Session | null) => void): () => void
  signUp(input: SignUpInput): Promise<{ needsVerification: boolean }>
  signIn(email: string, password: string, remember: boolean): Promise<Session>
  signOut(): Promise<void>
  resendVerification(email: string): Promise<void>
  requestPasswordReset(email: string): Promise<void>
  /** Completes recovery with the token from the emailed link. */
  completePasswordReset(input: { token?: string | null; password: string }): Promise<void>
  /** Handles the email verification / magic link landing. Returns the session if one was established. */
  handleCallback(params: URLSearchParams): Promise<Session | null>
  /** Re-checks the current password before sensitive operations. */
  reauthenticate(password: string): Promise<void>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}

export interface StorageApi {
  upload(bucket: 'lab-reports' | 'credentials', path: string, file: File): Promise<void>
  /** A short-lived URL for a private object. */
  signedUrl(bucket: 'lab-reports' | 'credentials', path: string): Promise<string>
}

export interface Backend {
  mode: 'mysql'
  auth: AuthApi
  storage: StorageApi
  select<T>(relation: string, query?: SelectQuery): Promise<SelectResult<T>>
  /** Calls a function returning a single (scalar/jsonb) value. */
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>
  /** Calls a set-returning function. */
  rpcRows<T>(fn: string, args?: Record<string, unknown>): Promise<T[]>
  insert<T>(table: string, values: Record<string, unknown>): Promise<T>
  update<T>(table: string, values: Record<string, unknown>, filters: Filter[]): Promise<T[]>
  remove(table: string, filters: Filter[]): Promise<void>
}

export class BackendError extends Error {
  code?: string
  hint?: string
  constructor(message: string, code?: string, hint?: string) {
    super(message)
    this.name = 'BackendError'
    this.code = code
    this.hint = hint
  }
}

export const IDENT = /^[a-z_][a-z0-9_]*$/

export function assertIdent(name: string) {
  if (!IDENT.test(name)) throw new BackendError(`Invalid identifier: ${name}`)
  return name
}

/** Strips characters that have meaning in filter syntax or LIKE patterns. */
export function sanitizeSearch(term: string) {
  return term.replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 80)
}
