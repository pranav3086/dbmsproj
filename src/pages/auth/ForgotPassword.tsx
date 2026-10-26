import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/common/Button'
import { FormField, Input } from '@/components/forms/Field'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { isDemo } from '@/lib/config'
import { errorMessage } from '@/lib/utils'
import { email } from '@/schemas'

const schema = z.object({ email })

export default function ForgotPassword() {
  useDocumentTitle('Reset your password')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await db().auth.requestPasswordReset(v.email)
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    }
  })
  return (
    <AuthShell title="Forgot your password?" subtitle="We’ll email you a secure link to choose a new one.">
      {sent ? (
        <div className="space-y-4">
          {/* Same message whether or not the address exists — prevents account enumeration. */}
          <FormAlert tone="success">If an account exists for that email, a password reset link has been sent. The link expires after a short time.</FormAlert>
          {isDemo && <p className="text-sm text-muted">Demo mode: open the <Link to="/dev/mailbox" className="font-semibold text-mint-700 underline">demo mailbox</Link> to find the link.</p>}
          <Link to="/signin" className="inline-block text-sm font-semibold text-mint-700 hover:underline">← Return to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error && <FormAlert>{error}</FormAlert>}
          <FormField label="Email address" error={errors.email?.message} required><Input type="email" autoComplete="email" {...register('email')} /></FormField>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
          <Link to="/signin" className="block text-center text-sm font-medium text-mint-700 hover:underline">Return to sign in</Link>
        </form>
      )}
    </AuthShell>
  )
}
