import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Clock, FileUp, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { homeFor, useAuth } from '@/app/auth'
import { Button } from '@/components/common/Button'
import { StatusBadge } from '@/components/common/Badge'
import { FormField, Input } from '@/components/forms/Field'
import { AuthShell, FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDate } from '@/lib/utils'
import { acceptInvitation, uploadCredential } from '@/services/account'

export default function VerificationPending() {
  useDocumentTitle('Account verification')
  const { access, refreshAccess, signOut } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState('')
  const upload = useMutation({
    mutationFn: (file: File) => uploadCredential(access!.user_id, file),
    onSuccess: async () => { toast.success('Document uploaded for review.'); await refreshAccess() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const accept = useMutation({
    mutationFn: () => acceptInvitation(token.trim()),
    onSuccess: async () => { const a = await refreshAccess(); toast.success('Staff access granted.'); navigate(homeFor(a)) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (access && access.roles.length > 0) return <Navigate to={homeFor(access)} replace />
  const app = access?.doctor_application

  return (
    <AuthShell title={app ? 'Professional verification' : 'Account setup'} subtitle={access?.email}>
      {app ? (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${app.status === 'rejected' ? 'bg-error/10 text-error' : 'bg-[#fbf3e4] text-warning'}`}>
                {app.status === 'rejected' ? <XCircle className="h-6 w-6" /> : app.status === 'approved' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
              </span>
              <div>
                <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Application status</h2><StatusBadge status={app.status} /></div>
                <p className="mt-1 text-sm text-muted">Submitted {formatDate(app.created_at)}</p>
                {app.status === 'pending' && <p className="mt-3 text-[15px] text-muted-strong">An administrator is reviewing your registration and licence details. Clinical dashboards and patient records stay locked until your account is approved. You’ll receive a notification when the review is complete.</p>}
                {app.status === 'rejected' && <p className="mt-3 text-[15px] text-muted-strong">Your application was not approved.{app.review_notes && <> Reviewer note: <em>“{app.review_notes}”</em></>} Please contact the hospital administration for next steps.</p>}
              </div>
            </div>
          </div>
          {app.status === 'pending' && (
            <div className="card p-6">
              <h2 className="text-base font-semibold">Supporting credentials</h2>
              <p className="mt-1 text-sm text-muted">Upload a copy of your registration certificate or licence (PDF, PNG or JPG, up to 10 MB). Files are stored privately and only visible to you and authorised reviewers.</p>
              {app.credential_path && <FormAlert tone="success">A document has been uploaded. You can replace it if needed.</FormAlert>}
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
              <Button variant="secondary" className="mt-4" icon={<FileUp className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                {app.credential_path ? 'Replace document' : 'Upload document'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <FormAlert tone="info">Your account doesn’t have portal access yet. Staff access is granted by invitation from an administrator.</FormAlert>
          <div className="card space-y-4 p-6">
            <h2 className="text-base font-semibold">Have an invitation code?</h2>
            <FormField label="Invitation code" hint="The code at the end of your invitation link (after invite=)"><Input value={token} onChange={(e) => setToken(e.target.value)} /></FormField>
            <Button onClick={() => accept.mutate()} loading={accept.isPending} disabled={token.trim().length < 30}>Accept invitation</Button>
          </div>
        </div>
      )}
      <Button variant="ghost" className="mt-6" onClick={() => void signOut()}>Sign out</Button>
    </AuthShell>
  )
}
