import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarCheck2, CalendarClock, ClipboardList, FlaskConical, HeartPulse, ScrollText, UserCog, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader, StatCard } from '@/components/common/Layout'
import { EmptyState, LoadingSkeleton } from '@/components/common/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { addDaysKey, formatDate, formatDateTime, formatTime, hospitalDateKey, hospitalDayStartIso } from '@/lib/utils'
import { listAppointments } from '@/services/appointments'
import { listLabReports, listPrescriptions } from '@/services/clinical'

export default function DoctorDashboard() {
  useDocumentTitle('Clinical dashboard')
  const { access } = useAuth()
  const doctorId = access!.doctor_id!
  const today = hospitalDateKey()
  const todays = useQuery({ queryKey: ['appointments', 'doctor-today', doctorId, today], queryFn: () => listAppointments({ doctorId, from: hospitalDayStartIso(today), to: hospitalDayStartIso(addDaysKey(today, 1)), limit: 50 }) })
  const upcoming = useQuery({ queryKey: ['appointments', 'doctor-upcoming', doctorId], queryFn: () => listAppointments({ doctorId, scope: 'upcoming', limit: 8 }) })
  const requests = useQuery({ queryKey: ['appointments', 'doctor-requests', doctorId], queryFn: () => listAppointments({ doctorId, scope: 'upcoming', statuses: ['requested'], limit: 20 }) })
  const drafts = useQuery({ queryKey: ['prescriptions', 'doctor', doctorId, 'draft'], queryFn: () => listPrescriptions({ doctorId, statuses: ['draft'] }) })
  const labs = useQuery({ queryKey: ['lab-reports', 'doctor-dash'], queryFn: () => listLabReports({ statuses: ['ordered', 'collected', 'in_progress'], limit: 5 }) })

  return (
    <>
      <PageHeader eyebrow={formatDate(new Date(), { weekday: 'long' })} title={`Welcome, ${access?.full_name || 'Doctor'}`} description="Your schedule, pending requests and clinical tasks." actions={<ButtonLink to="/doctor/appointments" icon={<CalendarClock className="h-4 w-4" />}>Open schedule</ButtonLink>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today" value={todays.data?.rows.filter((a) => a.status !== 'cancelled').length ?? '–'} icon={<CalendarCheck2 className="h-4.5 w-4.5" />} to="/doctor/appointments" tone="forest" />
        <StatCard label="Pending requests" value={requests.data?.count ?? '–'} icon={<ClipboardList className="h-4.5 w-4.5" />} to="/doctor/appointments" tone="warning" />
        <StatCard label="Upcoming" value={upcoming.data?.count ?? '–'} icon={<CalendarClock className="h-4.5 w-4.5" />} to="/doctor/appointments" />
        <StatCard label="Draft prescriptions" value={drafts.data?.length ?? '–'} icon={<ScrollText className="h-4.5 w-4.5" />} to="/doctor/prescriptions" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Today’s appointments</h2>
          {todays.isLoading ? <LoadingSkeleton rows={3} /> : !todays.data?.rows.length ? <EmptyState icon={<CalendarCheck2 className="h-5 w-5" />} title="No appointments today" /> : (
            <ol className="card divide-y divide-line">
              {todays.data.rows.map((a) => (
                <li key={a.id} className="flex items-center gap-4 p-4">
                  <span className="w-20 shrink-0 font-display text-lg font-semibold text-forest">{formatTime(a.starts_at)}</span>
                  <div className="min-w-0 flex-1"><Link to={`/doctor/patients/${a.patient_id}`} className="font-medium text-forest hover:underline">{a.patient_name}</Link><p className="truncate text-[13px] text-muted">{a.reason ?? 'No reason given'} · {a.reference}</p></div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ol>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pending requests</h2>
          {requests.isLoading ? <LoadingSkeleton rows={2} /> : !requests.data?.rows.length ? <EmptyState title="No pending requests" /> : (
            <ul className="card divide-y divide-line">
              {requests.data.rows.slice(0, 6).map((a) => (
                <li key={a.id} className="p-4">
                  <div className="flex items-center justify-between gap-2"><p className="font-medium text-forest">{a.patient_name}</p>{a.is_sample && <SampleBadge />}</div>
                  <p className="text-[13px] text-muted">{formatDateTime(a.starts_at)}</p>
                </li>
              ))}
              <li className="p-3"><Link to="/doctor/appointments" className="flex items-center gap-1 text-sm font-medium text-mint-700">Review requests <ArrowRight className="h-4 w-4" /></Link></li>
            </ul>
          )}
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Lab records in progress</h2>
          {labs.isLoading ? <LoadingSkeleton rows={2} /> : !labs.data?.length ? <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="Nothing in progress" /> : (
            <ul className="card divide-y divide-line">
              {labs.data.map((l) => <li key={l.id}><Link to={`/doctor/lab-records/${l.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mint-50/60"><div><p className="font-medium text-forest">{l.test_name}</p><p className="text-[13px] text-muted">{l.patient_name} · {l.reference}</p></div><StatusBadge status={l.status} /></Link></li>)}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Quick links</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['/doctor/patients', 'Patient records', Users],
              ['/doctor/prescriptions/new', 'New prescription', ScrollText],
              ['/doctor/lab-records/new', 'New lab record', FlaskConical],
              ['/doctor/observations', 'Observations', HeartPulse],
              ['/doctor/profile', 'Availability', UserCog],
            ].map(([to, label, Icon]) => {
              const I = Icon as typeof Users
              return <Link key={to as string} to={to as string} className="card card-hover flex items-center gap-3 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-100 text-mint-600"><I className="h-4.5 w-4.5" /></span><span className="text-sm font-medium text-forest">{label as string}</span></Link>
            })}
          </div>
        </section>
      </div>
    </>
  )
}
