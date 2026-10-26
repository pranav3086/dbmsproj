import { zodResolver } from '@hookform/resolvers/zod'
import { FlaskConical, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { z } from 'zod'
import { homeFor, useAuth } from '@/app/auth'
import { Button } from '@/components/common/Button'
import { Checkbox, FormField, Input, PasswordInput } from '@/components/forms/Field'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { isDemo } from '@/lib/config'
import { errorMessage } from '@/lib/utils'
import { safeNext } from '@/routes/guards'
import { signInSchema } from '@/schemas'

type Values = z.infer<typeof signInSchema>

function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const [accounts, setAccounts] = useState<{ email: string; label: string }[]>([])
  const [password, setPassword] = useState('')
  useEffect(() => {
    import('@/lib/backend/dev-tools').then((m) => {
      setAccounts(m.DEMO_ACCOUNTS)
      setPassword(m.DEMO_PASSWORD)
    })
  }, [])
  return (
    <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-warning/40 bg-[#fdf9f0] p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#7a5413]"><FlaskConical className="h-4 w-4" /> Demo accounts (development build only)</p>
      <p className="mt-1 text-[13px] text-[#7a5413]/80">Fictional accounts seeded into the MySQL database. Password for all: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">{password}</code></p>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {accounts.map((a) => (
          <button key={a.email} type="button" onClick={() => onPick(a.email, password)} className="rounded-xl border border-warning/20 bg-white px-3 py-2 text-left text-[13px] transition-colors hover:border-warning/50">
            <span className="block font-medium text-ink">{a.label}</span>
            <span className="block truncate text-muted">{a.email}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SignIn() {
  useDocumentTitle('Sign in')
  const { refreshAccess } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState<string | null>(null)
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    setUnverified(null)
    try {
      await db().auth.signIn(v.email, v.password, v.remember)
      const access = await refreshAccess()
      navigate(safeNext(params.get('next')) ?? homeFor(access), { replace: true })
    } catch (e) {
      const msg = errorMessage(e)
      if (/verify your email/i.test(msg)) setUnverified(v.email)
      setError(msg)
    }
  })

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage appointments, prescriptions, reports and orders.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && (
          <FormAlert>
            {error}
            {unverified && (
              <> <Link to={`/check-email?email=${encodeURIComponent(unverified)}`} className="font-semibold underline">Resend the verification email</Link>.</>
            )}
          </FormAlert>
        )}
        <FormField label="Email address" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password?.message} required>
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </FormField>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Keep me signed in" {...register('remember')} />
          <Link to="/forgot-password" className="rounded text-sm font-medium text-mint-700 hover:underline">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} icon={<LogIn className="h-4 w-4" />}>Sign in</Button>
        <p className="text-center text-sm text-muted">
          New to A10 Hospital? <Link to="/signup" className="font-semibold text-mint-700 hover:underline">Create an account</Link>
        </p>
        <p className="text-center text-[12.5px] text-muted">Haven’t verified your email yet? Check your inbox for the confirmation link, or <Link to="/check-email" className="underline">request a new one</Link>.</p>
      </form>
      {isDemo && <DemoAccounts onPick={(e, p) => { setValue('email', e); setValue('password', p) }} />}
    </AuthShell>
  )
}
