import { useAuth } from '@/app/auth'
import { Button, ButtonLink } from '@/components/common/Button'
import { AuthShell } from '@/components/layout/AuthShell'

export default function AccountInactive() {
  const { signOut, status } = useAuth()
  return (
    <AuthShell title="This account is inactive" subtitle="Access has been paused by the hospital administration.">
      <p className="text-[15px] text-muted-strong">If you think this is a mistake, please contact the hospital. Your records are retained and access can be restored by an administrator.</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink to="/contact">Contact us</ButtonLink>
        {status === 'signed-in' && <Button variant="secondary" onClick={() => void signOut()}>Sign out</Button>}
      </div>
    </AuthShell>
  )
}
