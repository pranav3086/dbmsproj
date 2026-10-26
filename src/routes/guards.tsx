import { ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { homeFor, useAuth } from '@/app/auth'
import { ButtonLink } from '@/components/common/Button'
import { LoadingSkeleton } from '@/components/common/States'
import type { AppRole, StaffPermission } from '@/types/models'

/**
 * Client-side guards improve navigation only. Every protected read and write is independently
 * enforced by MySQL security views and stored procedures (see database/).
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className="container-page py-16"><LoadingSkeleton variant="detail" rows={5} /></div>
  if (status === 'signed-out') {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/signin?next=${next}`} replace />
  }
  return <>{children}</>
}

export function RoleGuard({ roles, permissions, children }: { roles: AppRole[]; permissions?: StaffPermission[]; children: ReactNode }) {
  const { access, hasRole, can } = useAuth()
  if (access && !access.is_active) return <Navigate to="/account-inactive" replace />
  const roleOk = roles.some((r) => hasRole(r))
  const permOk = !permissions?.length || permissions.some((p) => can(p)) || hasRole('admin')
  if (!roleOk || !permOk) return <Forbidden />
  return <>{children}</>
}

export function Forbidden() {
  const { access } = useAuth()
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-error"><ShieldAlert className="h-7 w-7" /></div>
      <h1 className="text-2xl font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-muted">This area is limited to accounts with the appropriate role. If you believe this is a mistake, contact the hospital administrator.</p>
      <ButtonLink to={homeFor(access)} className="mt-6">Go to my portal</ButtonLink>
    </div>
  )
}

/** For sign-in / sign-up pages: signed-in users go straight to their portal. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, access } = useAuth()
  const [params] = useSearchParams()
  if (status === 'signed-in') return <Navigate to={safeNext(params.get('next')) ?? homeFor(access)} replace />
  return <>{children}</>
}

/** Only allow internal, same-origin redirect targets. */
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null
}
