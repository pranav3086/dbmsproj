import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { homeFor, useAuth } from '@/app/auth'
import { Spinner } from '@/components/common/States'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { db } from '@/lib/backend'
import { errorMessage } from '@/lib/utils'

/** Landing page for email-verification links. */
export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshAccess } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    db().auth.handleCallback(params)
      .then(async (session) => {
        if (!session) {
          navigate('/signin', { replace: true })
          return
        }
        const access = await refreshAccess()
        navigate(homeFor(access), { replace: true })
      })
      .catch((e) => setError(errorMessage(e)))
  }, [params, navigate, refreshAccess])

  return (
    <AuthShell title={error ? 'We couldn’t verify that link' : 'Verifying your email…'}>
      {error ? (
        <div className="space-y-4">
          <FormAlert>{error}</FormAlert>
          <p className="text-sm text-muted">Links expire after a short time and can be used once. <Link to="/check-email" className="font-semibold text-mint-700 underline">Request a new verification email</Link> or <Link to="/signin" className="font-semibold text-mint-700 underline">sign in</Link>.</p>
        </div>
      ) : (
        <Spinner label="Confirming your account" />
      )}
    </AuthShell>
  )
}
