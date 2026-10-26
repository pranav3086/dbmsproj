import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button, ButtonLink } from '@/components/common/Button'
import { FormField, Input } from '@/components/forms/Field'
import { AuthShell } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { isDemo } from '@/lib/config'
import { errorMessage } from '@/lib/utils'

export default function CheckEmail() {
  useDocumentTitle('Check your email')
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [busy, setBusy] = useState(false)
  const isDoctor = params.get('type') === 'doctor'

  const resend = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error('Enter the email address you registered with.')
    setBusy(true)
    try {
      await db().auth.resendVerification(email)
      toast.success('If an unverified account exists for that address, a new link is on its way.')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Check your email" subtitle="One more step to activate your account.">
      <div className="card p-6">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><MailCheck className="h-6 w-6" /></span>
          <div className="text-[15px] leading-relaxed text-muted-strong">
            <p>If the address can be used for a new account, we’ve sent a confirmation link{params.get('email') ? <> to <strong className="text-ink">{params.get('email')}</strong></> : ''}. Open it to verify your email, then sign in.</p>
            {isDoctor && <p className="mt-3">After verification your professional account stays <strong>pending</strong> until an administrator approves it.</p>}
            {isDemo && (
              <p className="mt-3 rounded-xl bg-[#fdf9f0] px-3 py-2 text-[13.5px] text-[#7a5413]">
                Demo mode: no email is sent. Open the <Link to="/dev/mailbox" className="font-semibold underline">demo mailbox</Link> to find your confirmation link.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <p className="text-sm font-medium text-ink">Didn’t receive it?</p>
        <FormField label="Email address"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></FormField>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={resend} loading={busy}>Resend verification email</Button>
          <ButtonLink to="/signin" variant="ghost">Back to sign in</ButtonLink>
        </div>
      </div>
    </AuthShell>
  )
}
