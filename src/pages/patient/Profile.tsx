import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useBlocker } from 'react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog, Modal } from '@/components/common/Dialog'
import { PageHeader } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { FormField, Input, PasswordInput, PasswordRequirements, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { db } from '@/lib/backend'
import { errorMessage } from '@/lib/utils'
import { password as passwordRule, profileSchema } from '@/schemas'
import { getMyProfile, updateMyProfile } from '@/services/account'
import type { Profile as ProfileT } from '@/types/models'

type Values = z.infer<typeof profileSchema>
const toForm = (p: ProfileT): Values => ({
  full_name: p.full_name, phone: p.phone ?? '', date_of_birth: p.date_of_birth ?? '', address: p.address ?? '',
  emergency_contact_name: p.emergency_contact_name ?? '', emergency_contact_phone: p.emergency_contact_phone ?? '', blood_group: p.blood_group ?? '',
})
const nul = (v?: string) => (v && v.trim() ? v.trim() : null)

function ChangePassword({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)
  const change = useMutation({
    mutationFn: () => {
      const parsed = passwordRule.safeParse(next)
      if (!parsed.success) throw new Error(parsed.error.issues[0].message)
      return db().auth.changePassword(current, next)
    },
    onSuccess: () => { toast.success('Password updated'); onOpenChange(false); setCurrent(''); setNext('') },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Change password" description="For your security, confirm your current password first." footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={change.isPending} onClick={() => { setError(null); change.mutate() }}>Update password</Button></>}>
      <div className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <FormField label="Current password"><PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></FormField>
        <FormField label="New password"><PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></FormField>
        <PasswordRequirements value={next} />
      </div>
    </Modal>
  )
}

export default function Profile() {
  useDocumentTitle('My profile')
  const { session, refreshAccess } = useAuth()
  const qc = useQueryClient()
  const uid = session!.userId
  const profile = useQuery({ queryKey: ['profile', uid], queryFn: () => getMyProfile(uid) })
  const [pwOpen, setPwOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<Values>({ resolver: zodResolver(profileSchema) })
  useEffect(() => { if (profile.data) reset(toForm(profile.data)) }, [profile.data, reset])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && !isSubmitting && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (isDirty) e.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await updateMyProfile(uid, {
        full_name: v.full_name.trim(), phone: nul(v.phone), date_of_birth: nul(v.date_of_birth), address: nul(v.address),
        emergency_contact_name: nul(v.emergency_contact_name), emergency_contact_phone: nul(v.emergency_contact_phone), blood_group: nul(v.blood_group),
      })
      qc.setQueryData(['profile', uid], saved)
      reset(toForm(saved))
      await refreshAccess()
      toast.success('Profile saved')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  if (profile.isLoading) return <LoadingSkeleton variant="detail" rows={8} />
  if (profile.error || !profile.data) return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />

  return (
    <>
      <PageHeader title="My profile" description="Keep your details up to date so the care team can reach you." actions={<Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setPwOpen(true)}>Change password</Button>} />
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <section className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Personal details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <FormField label="Full name" error={errors.full_name?.message} required><Input autoComplete="name" {...register('full_name')} /></FormField>
            <FormField label="Email address" hint="Contact the hospital to change the email on your account."><Input value={profile.data.email} disabled /></FormField>
            <FormField label="Phone number" error={errors.phone?.message} optional><Input type="tel" autoComplete="tel" {...register('phone')} /></FormField>
            <FormField label="Date of birth" error={errors.date_of_birth?.message} optional><Input type="date" max={new Date().toISOString().slice(0, 10)} {...register('date_of_birth')} /></FormField>
            <FormField label="Address" error={errors.address?.message} optional className="sm:col-span-2"><Textarea rows={2} autoComplete="street-address" {...register('address')} /></FormField>
            <FormField label="Blood group" optional hint="Only if known from a verified test."><Select {...register('blood_group')}><option value="">Not provided</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</Select></FormField>
          </div>
        </section>
        <section className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Emergency contact</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <FormField label="Name" error={errors.emergency_contact_name?.message} optional><Input {...register('emergency_contact_name')} /></FormField>
            <FormField label="Phone" error={errors.emergency_contact_phone?.message} optional><Input type="tel" {...register('emergency_contact_phone')} /></FormField>
          </div>
        </section>
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
          {isDirty && <span className="mr-auto pl-2 text-sm text-warning" role="status">You have unsaved changes</span>}
          <Button variant="secondary" disabled={!isDirty || isSubmitting} onClick={() => reset(toForm(profile.data!))}>Cancel</Button>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty} icon={<Save className="h-4 w-4" />}>Save changes</Button>
        </div>
      </form>
      <ChangePassword open={pwOpen} onOpenChange={setPwOpen} />
      <ConfirmationDialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.reset?.()} title="Discard unsaved changes?" description="You have changes that haven’t been saved. Leave this page anyway?" confirmLabel="Discard changes" tone="danger" onConfirm={() => blocker.proceed?.()} />
    </>
  )
}
