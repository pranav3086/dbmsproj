import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CalendarPlus, Clock, GraduationCap, Info, Languages, Wallet } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { SampleBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { Avatar, PageHeader, Reveal } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { SlotPicker } from '@/components/domain/SlotPicker'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMoney } from '@/lib/utils'
import { getAvailability, getDoctor } from '@/services/directory'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const t = (s: string) => s.slice(0, 5)

export default function DoctorProfile() {
  const { doctorId = '' } = useParams()
  const navigate = useNavigate()
  const doctor = useQuery({ queryKey: ['doctor', doctorId], queryFn: () => getDoctor(doctorId) })
  const availability = useQuery({ queryKey: ['availability', doctor.data?.id], queryFn: () => getAvailability(doctor.data!.id), enabled: !!doctor.data })
  useDocumentTitle(doctor.data?.full_name ?? 'Doctor')

  if (doctor.isLoading) return <div className="container-page py-16"><LoadingSkeleton variant="detail" rows={6} /></div>
  if (doctor.error) return <div className="container-page py-16"><ErrorState error={doctor.error} onRetry={() => doctor.refetch()} /></div>
  const d = doctor.data
  if (!d) return <div className="container-page py-16"><EmptyState title="Doctor not found" description="This profile may have been removed." action={<ButtonLink to="/doctors">Browse doctors</ButtonLink>} /></div>

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title="" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Doctors', to: '/doctors' }, { label: d.full_name }]} className="mb-4" />
      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-6">
          <Reveal className="card overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-mint-100 via-mint-50 to-white" />
            <div className="-mt-12 px-6 pb-6 sm:px-8">
              <Avatar name={d.full_name} src={d.photo_url} size="xl" className="ring-4 ring-white" />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {d.is_sample && <SampleBadge label="Sample profile — fictional" />}
                {d.licence_verified ? <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-success"><BadgeCheck className="h-4 w-4" />Licence verified</span> : <span className="text-[13px] text-muted">Credentials not yet verified</span>}
              </div>
              <h1 className="mt-2 text-3xl font-semibold">{d.full_name}</h1>
              <p className="mt-1 text-lg text-mint-700">{d.speciality}</p>
              <p className="text-muted">{d.department_name}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {d.qualifications.length > 0 && <Fact icon={GraduationCap} label={d.qualifications_verified ? 'Verified qualifications' : 'Qualifications (unverified)'} value={d.qualifications.join(', ')} />}
                {d.years_experience !== null && <Fact icon={Clock} label="Experience" value={`${d.years_experience} years`} />}
                <Fact icon={Wallet} label="Consultation" value={`${d.consultation_fee !== null ? formatMoney(d.consultation_fee) : 'Fee on request'} · ${d.consultation_minutes} minutes`} />
                {d.languages.length > 0 && <Fact icon={Languages} label="Languages" value={d.languages.join(', ')} />}
              </div>
            </div>
          </Reveal>
          <Reveal className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold">About</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-strong">{d.bio || 'Biography coming soon.'}</p>
          </Reveal>
          <Reveal className="card p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Weekly clinic hours</h2>
            {availability.data?.length ? (
              <ul className="mt-4 divide-y divide-line">
                {availability.data.map((a) => (
                  <li key={a.id} className="flex justify-between py-2.5 text-[15px]"><span className="font-medium text-forest">{WEEKDAYS[a.weekday]}</span><span className="text-muted-strong">{t(a.start_time)} – {t(a.end_time)} · {a.slot_minutes}-min slots</span></li>
                ))}
              </ul>
            ) : <p className="mt-3 text-muted">This doctor does not currently offer online booking.</p>}
            {d.is_sample && <p className="mt-4 flex items-start gap-2 text-[13px] text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />This is a fictional profile used for demonstration. Replace with verified information before launch.</p>}
          </Reveal>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Availability</h2>
            <p className="mt-1 text-sm text-muted">Choose a time to continue to booking.</p>
            <div className="mt-5">
              <SlotPicker doctorId={d.id} value={null} onChange={(s) => navigate(`/appointments/book?doctor=${d.slug}&slot=${encodeURIComponent(s.starts_at)}`)} />
            </div>
            <Button className="mt-6 w-full" size="lg" onClick={() => navigate(`/appointments/book?doctor=${d.slug}`)} icon={<CalendarPlus className="h-4 w-4" />}>Book an appointment</Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-mist p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
      <div><p className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</p><p className="mt-0.5 text-[15px] text-ink">{value}</p></div>
    </div>
  )
}
