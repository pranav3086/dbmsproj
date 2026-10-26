import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db } from '@/lib/backend'
import type { Session } from '@/lib/backend/types'
import { getMyAccess } from '@/services/account'
import type { Access, AppRole, StaffPermission } from '@/types/models'

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in'
  session: Session | null
  access: Access | null
  /** True after a password-recovery link established a temporary session. */
  recovery: boolean
  refreshAccess: () => Promise<Access | null>
  signOut: () => Promise<void>
  hasRole: (role: AppRole) => boolean
  can: (permission: StaffPermission) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

/** Where a signed-in user belongs, derived only from server-side role data. */
export function homeFor(access: Access | null): string {
  if (!access) return '/signin'
  if (!access.is_active) return '/account-inactive'
  if (access.roles.includes('admin')) return '/admin/dashboard'
  if (access.roles.includes('doctor')) return '/doctor/dashboard'
  if (access.roles.includes('staff')) return '/staff/dashboard'
  if (access.roles.includes('patient')) return '/patient/dashboard'
  return '/verification-pending'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [recovery, setRecovery] = useState(false)

  const load = useCallback(async (s: Session | null) => {
    setSession(s)
    if (!s) {
      setAccess(null)
      setStatus('signed-out')
      return null
    }
    try {
      const a = await getMyAccess()
      setAccess(a)
      setStatus(a ? 'signed-in' : 'signed-out')
      return a
    } catch {
      setAccess(null)
      setStatus('signed-out')
      return null
    }
  }, [])

  useEffect(() => {
    const auth = db().auth
    let cancelled = false
    auth.getSession().then((s) => { if (!cancelled) void load(s) })
    const off = auth.onChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setRecovery(false)
        queryClient.clear()
      }
      if (event !== 'INITIAL') void load(s)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [load, queryClient])

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      access,
      recovery,
      refreshAccess: async () => load(await db().auth.getSession()),
      signOut: async () => {
        await db().auth.signOut()
        queryClient.clear()
        await load(null)
      },
      hasRole: (role) => !!access?.is_active && access.roles.includes(role),
      can: (permission) => !!access?.is_active && (access.roles.includes('staff') && access.permissions.includes(permission)),
    }),
    [status, session, access, recovery, load, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
