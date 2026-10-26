import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/common/Button'
import { FormField, PasswordInput, PasswordRequirements } from '@/components/forms/Field'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { errorMessage } from '@/lib/utils'
import { resetSchema } from '@/schemas'

export default function ResetPassword() {
  useDocumentTitle('Choose a new password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(params.get('error_description')?.replace(/\+/g, ' ') ?? null)
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirmPassword: '' } })
  const pw = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await db().auth.completePasswordReset({ token: params.get('token'), password: v.password })
      await db().auth.signOut().catch(() => undefined)
      toast.success('Your password has been updated. Please sign in.')
      navigate('/signin', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    }
  })

  return (
    <AuthShell title="Choose a new password" subtitle="Use a strong password you don’t use anywhere else.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {error && <FormAlert>{error} <Link to="/forgot-password" className="font-semibold underline">Request a new link</Link>.</FormAlert>}
        <FormField label="New password" error={errors.password?.message} required><PasswordInput autoComplete="new-password" {...register('password')} /></FormField>
        <PasswordRequirements value={pw} />
        <FormField label="Confirm new password" error={errors.confirmPassword?.message} required><PasswordInput autoComplete="new-password" {...register('confirmPassword')} /></FormField>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
        <Link to="/signin" className="block text-center text-sm font-medium text-mint-700 hover:underline">Return to sign in</Link>
      </form>
    </AuthShell>
  )
}
