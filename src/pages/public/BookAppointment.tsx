import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarCheck2, CheckCircle2, LogIn, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { StatusBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { DeptIcon } from '@/components/common/DeptIcon'
import { Avatar, DescriptionList, PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { SlotPicker } from '@/components/domain/SlotPicker'
import { FormField, Input, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn, errorMessage, formatDateTime, formatMoney } from '@/lib/utils'
import { phoneRegex } from '@/schemas'
import { getMyProfile } from '@/services/account'
import { bookAppointment } from '@/services/appointments'
import { getDoctor, listDepartments, listDoctors } from '@/services/directory'
import type { Appointment } from '@/types/models'

const STEPS = ['Department', 'Doctor', 'Date & time', 'Your details', 'Review', 'Confirmed']

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-10 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < step ? 'done' : n === step ? 'current' : 'todo'
        return (
          <li key={label} className="flex shrink-0 items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors duration-300', state === 'done' ? 'bg-mint-500 text-white' : state === 'current' ? 'bg-forest text-white' : 'bg-mint-50 text-muted ring-1 ring-line')}>
              {state === 'done' ? '✓' : n}
            </span>
            <span className={cn('text-sm', state === 'current' ? 'font-semibold text-forest' : 'text-muted', state !== 'current' && 'hidden md:inline')}>{label}</span>
            {n < STEPS.length && <span className={cn('mx-1 h-px w-6 sm:w-10', n < step ? 'bg-mint-400' : 'bg-line')} aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

export default function BookAppointment() {
  useDocumentTitle('Book an appointment')
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const qc = useQueryClient()
  const { status, access, hasRole, session } = useAuth()
  const deptSlug = params.get('department')
  const doctorSlug = params.get('doctor')
  const slot = params.get('slot')
  const doctor = useQuery({ queryKey: ['doctor', doctorSlug], queryFn: () => getDoctor(doctorSlug!), enabled: !!doctorSlug })
  const effectiveDept = deptSlug ?? doctor.data?.department_slug ?? null

  const initialStep = slot && doctorSlug ? 4 : doctorSlug ? 3 : deptSlug ? 2 : 1
  const [step, setStep] = useState(initialStep)
  const [details, setDetails] = useState({ name: '', phone: '', reason: '' })
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})
  const [booked, setBooked] = useState<Appointment | null>(null)

  const profile = useQuery({ queryKey: ['profile', session?.userId], queryFn: () => getMyProfile(session!.userId), enabled: !!session && hasRole('patient') })
  useEffect(() => {
    if (profile.data) setDetails((d) => ({ name: d.name || profile.data!.full_name, phone: d.phone || profile.data!.phone || '', reason: d.reason }))
  }, [profile.data])

  const set = (patch: Record<string, string | null>) =>
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k) }
      return n
    }, { replace: true })
  const go = (s: number) => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments(), enabled: step === 1 })
  const doctors = useQuery({ queryKey: ['doctors', { book: effectiveDept }], queryFn: () => listDoctors({ department: effectiveDept!, availableOnly: true, pageSize: 50 }), enabled: step === 2 && !!effectiveDept })

  const confirm = useMutation({
    mutationFn: () => bookAppointment({ doctorId: doctor.data!.id, startsAt: slot!, reason: details.reason.trim(), patientName: details.name.trim(), patientPhone: details.phone.trim() }),
    onSuccess: (appt) => {
      setBooked(appt)
      qc.invalidateQueries({ queryKey: ['slots'] })
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      go(6)
    },
    onError: (e) => {
      const msg = errorMessage(e)
      toast.error(msg)
      if (/no longer available/i.test(msg)) {
        qc.invalidateQueries({ queryKey: ['slots'] })
        set({ slot: null })
        go(3)
      }
    },
  })

  const validateDetails = () => {
    const errs: Record<string, string> = {}
    if (details.name.trim().length < 2) errs.name = 'Enter the patient’s full name'
    if (details.phone.trim() && !phoneRegex.test(details.phone.trim())) errs.phone = 'Enter a valid phone number'
    if (details.reason.length > 500) errs.reason = 'Keep the reason under 500 characters'
    setDetailErrors(errs)
    return Object.keys(errs).length === 0
  }

  const backBtn = (to: number) => <Button variant="ghost" onClick={() => go(to)} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
  const next = encodeURIComponent(location.pathname + location.search)

  return (
    <div className="container-page max-w-5xl py-12 sm:py-16">
      <PageHeader eyebrow="Appointments" title="Book an appointment" description="Choose a speciality, a doctor and a time that suits you." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Book an appointment' }]} />
      <Stepper step={step} />
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          {step === 1 && (
            <section aria-labelledby="s1">
              <h2 id="s1" className="mb-5 text-xl font-semibold">Which speciality do you need?</h2>
              {departments.isLoading ? <LoadingSkeleton variant="cards" rows={6} /> : departments.error ? <ErrorState error={departments.error} onRetry={() => departments.refetch()} /> : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {departments.data?.map((d) => (
                    <button key={d.id} onClick={() => { set({ department: d.slug, doctor: null, slot: null }); go(2) }} className={cn('card card-hover flex items-center gap-4 p-4 text-left', effectiveDept === d.slug && 'border-mint-500 ring-2 ring-mint-200')}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint-100 text-mint-600"><DeptIcon name={d.icon} className="h-5 w-5" /></span>
                      <span><span className="block font-semibold text-forest">{d.name}</span><span className="block text-[13px] text-muted">{d.doctor_count} doctors</span></span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="s2">
              <h2 id="s2" className="mb-5 text-xl font-semibold">Choose a doctor</h2>
              {doctors.isLoading ? <LoadingSkeleton rows={4} /> : doctors.error ? <ErrorState error={doctors.error} onRetry={() => doctors.refetch()} /> : !doctors.data?.rows.length ? (
                <EmptyState title="No doctors in this department accept online booking" description="Please choose another department or contact us." action={<Button variant="secondary" onClick={() => go(1)}>Choose another department</Button>} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {doctors.data.rows.map((d) => (
                    <button key={d.id} onClick={() => { set({ doctor: d.slug, slot: null }); go(3) }} className={cn('card card-hover flex items-center gap-4 p-4 text-left', doctorSlug === d.slug && 'border-mint-500 ring-2 ring-mint-200')}>
                      <Avatar name={d.full_name} src={d.photo_url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-forest">{d.full_name}</span>
                        <span className="block text-[13px] text-mint-700">{d.speciality}</span>
                        <span className="block text-[12.5px] text-muted">{d.years_experience ?? '—'} yrs · {d.consultation_fee !== null ? formatMoney(d.consultation_fee) : 'Fee on request'}{d.is_sample ? ' · Sample profile' : ''}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-8">{backBtn(1)}</div>
            </section>
          )}

          {step === 3 && (
            <section aria-labelledby="s3" className="grid gap-8 lg:grid-cols-[1fr_300px]">
              <div className="card min-w-0 p-6">
                <h2 id="s3" className="mb-5 text-xl font-semibold">Select a date and time</h2>
                {doctor.data ? <SlotPicker doctorId={doctor.data.id} value={slot} onChange={(s) => set({ slot: s.starts_at })} /> : <LoadingSkeleton rows={2} />}
              </div>
              <div className="space-y-4">
                {doctor.data && <SelectedDoctor name={doctor.data.full_name} speciality={doctor.data.speciality} dept={doctor.data.department_name} />}
                <Button size="lg" className="w-full" disabled={!slot} onClick={() => go(4)} iconRight={<ArrowRight className="h-4 w-4" />}>Continue</Button>
                {backBtn(2)}
              </div>
            </section>
          )}

          {step === 4 && (
            <section aria-labelledby="s4" className="mx-auto max-w-2xl">
              <h2 id="s4" className="mb-5 text-xl font-semibold">Your details</h2>
              {status === 'loading' ? <LoadingSkeleton rows={2} /> : status !== 'signed-in' ? (
                <div className="card p-6 sm:p-8">
                  <p className="text-[15px] text-muted-strong">To keep your medical records safe, appointments are booked from a verified patient account. Your selection is saved — you’ll return here after signing in.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <ButtonLink to={`/signin?next=${next}`} size="lg" icon={<LogIn className="h-4 w-4" />}>Sign in</ButtonLink>
                    <ButtonLink to={`/signup?as=patient`} size="lg" variant="secondary" icon={<UserPlus className="h-4 w-4" />}>Create account</ButtonLink>
                  </div>
                </div>
              ) : !hasRole('patient') ? (
                <FormAlert>Appointments can only be booked from a patient account. You are signed in as {access?.email}.</FormAlert>
              ) : (
                <form className="card space-y-5 p-6 sm:p-8" noValidate onSubmit={(e) => { e.preventDefault(); if (validateDetails()) go(5) }}>
                  <FormField label="Patient name" error={detailErrors.name} required hint="Pre-filled from your profile. Update it if needed."><Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></FormField>
                  <FormField label="Contact phone" error={detailErrors.phone} optional><Input type="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} /></FormField>
                  <FormField label="Email" hint="Confirmation and updates go to your account email."><Input value={access?.email ?? ''} disabled /></FormField>
                  <FormField label="Reason for visit" error={detailErrors.reason} optional hint="A short note helps the doctor prepare. Please don’t include highly sensitive details."><Textarea rows={3} maxLength={500} value={details.reason} onChange={(e) => setDetails({ ...details, reason: e.target.value })} /></FormField>
                  <div className="flex justify-between">{backBtn(3)}<Button type="submit" iconRight={<ArrowRight className="h-4 w-4" />}>Review booking</Button></div>
                </form>
              )}
              {status !== 'signed-in' && <div className="mt-6">{backBtn(3)}</div>}
            </section>
          )}

          {step === 5 && doctor.data && slot && (
            <section aria-labelledby="s5" className="mx-auto max-w-2xl">
              <h2 id="s5" className="mb-5 text-xl font-semibold">Review and confirm</h2>
              <div className="card p-6 sm:p-8">
                <DescriptionList items={[
                  { label: 'Doctor', value: doctor.data.full_name },
                  { label: 'Department', value: doctor.data.department_name },
                  { label: 'Date & time', value: formatDateTime(slot) },
                  { label: 'Duration', value: `${doctor.data.consultation_minutes} minutes` },
                  { label: 'Patient', value: details.name },
                  { label: 'Phone', value: details.phone || '—' },
                  { label: 'Consultation fee', value: doctor.data.consultation_fee !== null ? `${formatMoney(doctor.data.consultation_fee)} (payable at the hospital)` : 'On request' },
                  { label: 'Reason', value: details.reason || '—' },
                ]} />
                <p className="mt-6 rounded-xl bg-mist p-4 text-[13.5px] text-muted-strong">Your request is sent to the care team for confirmation. You can cancel or reschedule online until shortly before the appointment.</p>
              </div>
              <div className="mt-6 flex justify-between">
                {backBtn(4)}
                <Button size="lg" loading={confirm.isPending} onClick={() => confirm.mutate()} icon={<CalendarCheck2 className="h-4.5 w-4.5" />}>Confirm booking</Button>
              </div>
            </section>
          )}

          {step === 6 && booked && (
            <section aria-labelledby="s6" className="mx-auto max-w-2xl text-center" aria-live="polite">
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-100 text-mint-600"><CheckCircle2 className="h-9 w-9" /></motion.span>
              <h2 id="s6" className="mt-5 text-2xl font-semibold">Appointment request received</h2>
              <p className="mt-2 text-muted">We’ve saved your booking. You’ll be notified when the care team confirms it.</p>
              <div className="card mt-8 p-6 text-left sm:p-8">
                <DescriptionList items={[
                  { label: 'Reference', value: <span className="font-mono font-semibold text-forest">{booked.reference}</span> },
                  { label: 'Status', value: <StatusBadge status={booked.status} /> },
                  { label: 'Doctor', value: doctor.data?.full_name },
                  { label: 'Department', value: doctor.data?.department_name },
                  { label: 'Date & time', value: formatDateTime(booked.starts_at) },
                ]} />
              </div>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink to={`/patient/appointments/${booked.id}`} size="lg">View appointment</ButtonLink>
                <ButtonLink to="/patient/dashboard" size="lg" variant="secondary">Go to my dashboard</ButtonLink>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
      {step < 6 && <p className="mt-10 text-center text-[13px] text-muted">For emergencies, do not book online — call emergency services. <Link to="/contact" className="underline">Contact us</Link> for help with bookings.</p>}
    </div>
  )
}

function SelectedDoctor({ name, speciality, dept }: { name: string; speciality: string; dept: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <Avatar name={name} />
      <div className="min-w-0"><p className="truncate font-semibold text-forest">{name}</p><p className="text-[13px] text-muted">{speciality} · {dept}</p></div>
    </div>
  )
}
