import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarClock, CalendarPlus, FlaskConical, Package, Pill, ScrollText, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader, StatCard, Stagger, StaggerItem } from '@/components/common/Layout'
import { EmptyState, LoadingSkeleton } from '@/components/common/States'
import { AppointmentCard } from '@/components/domain/Cards'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatDateTime, formatMoney, relativeTime } from '@/lib/utils'
import { getMyProfile, listNotifications } from '@/services/account'
import { listAppointments } from '@/services/appointments'
import { listLabReports, listPrescriptions } from '@/services/clinical'
import { listOrders } from '@/services/pharmacy'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function PatientDashboard() {
  useDocumentTitle('My dashboard')
  const { access, session } = useAuth()
  const uid = session!.userId
  const upcoming = useQuery({ queryKey: ['appointments', 'upcoming', uid], queryFn: () => listAppointments({ scope: 'upcoming', patientId: uid, limit: 5 }) })
  const rx = useQuery({ queryKey: ['prescriptions', uid], queryFn: () => listPrescriptions({ patientId: uid, limit: 3 }) })
  const labs = useQuery({ queryKey: ['lab-reports', uid], queryFn: () => listLabReports({ patientId: uid, limit: 3 }) })
  const orders = useQuery({ queryKey: ['orders', uid], queryFn: () => listOrders({ patientId: uid, limit: 3 }) })
  const profile = useQuery({ queryKey: ['profile', uid], queryFn: () => getMyProfile(uid) })
  const activity = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications() })

  const p = profile.data
  const fields = p ? [p.full_name, p.phone, p.date_of_birth, p.address, p.emergency_contact_name, p.emergency_contact_phone] : []
  const completion = fields.length ? Math.round((fields.filter(Boolean).length / fields.length) * 100) : 0
  const next = upcoming.data?.rows[0]
  const firstName = (access?.full_name || '').split(' ')[0]

  const actions = [
    { to: '/appointments/book', label: 'Book an appointment', icon: CalendarPlus },
    { to: '/patient/appointments', label: 'View appointments', icon: CalendarClock },
    { to: '/patient/prescriptions', label: 'Prescriptions', icon: ScrollText },
    { to: '/patient/lab-reports', label: 'Lab reports', icon: FlaskConical },
    { to: '/patient/pharmacy', label: 'Order medication', icon: Pill },
    { to: '/patient/profile', label: 'Update profile', icon: UserRound },
  ]

  return (
    <>
      <PageHeader eyebrow={formatDate(new Date(), { weekday: 'long' })} title={`${greeting()}${firstName ? `, ${firstName}` : ''}`} description="Here’s an overview of your care at A10 Hospital." actions={<ButtonLink to="/appointments/book" icon={<CalendarPlus className="h-4 w-4" />}>Book appointment</ButtonLink>} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card relative overflow-hidden p-6" aria-labelledby="next-appt">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-mint-100" />
          <h2 id="next-appt" className="relative text-sm font-semibold uppercase tracking-wide text-muted">Next appointment</h2>
          {upcoming.isLoading ? <LoadingSkeleton rows={1} className="mt-4 border-0 shadow-none" /> : next ? (
            <div className="relative mt-4">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={next.status} />{next.is_sample && <SampleBadge />}</div>
              <p className="mt-3 font-display text-2xl font-semibold text-forest">{formatDateTime(next.starts_at)}</p>
              <p className="mt-1 text-muted-strong">{next.doctor_name} · {next.department_name}</p>
              <p className="text-sm text-muted">Reference {next.reference}</p>
              <ButtonLink to={`/patient/appointments/${next.id}`} variant="secondary" size="sm" className="mt-5" iconRight={<ArrowRight className="h-4 w-4" />}>View details</ButtonLink>
            </div>
          ) : (
            <div className="relative mt-4">
              <p className="text-muted-strong">You have no upcoming appointments.</p>
              <ButtonLink to="/appointments/book" size="sm" className="mt-4">Book now</ButtonLink>
            </div>
          )}
        </section>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Upcoming" value={upcoming.data?.count ?? '–'} icon={<CalendarClock className="h-4.5 w-4.5" />} to="/patient/appointments" />
          <StatCard label="Prescriptions" value={rx.data?.length ?? '–'} icon={<ScrollText className="h-4.5 w-4.5" />} to="/patient/prescriptions" />
          <StatCard label="Lab reports" value={labs.data?.length ?? '–'} icon={<FlaskConical className="h-4.5 w-4.5" />} to="/patient/lab-reports" />
          <div className="card p-5">
            <p className="text-[13px] font-medium text-muted">Profile complete</p>
            <p className="mt-3 font-display text-[1.9rem] font-semibold leading-none text-forest">{completion}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mint-100" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full rounded-full bg-mint-500 transition-[width] duration-700" style={{ width: `${completion}%` }} /></div>
            {completion < 100 && <Link to="/patient/profile" className="mt-2 inline-block text-[12.5px] font-medium text-mint-700 hover:underline">Complete profile</Link>}
          </div>
        </div>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Quick actions</h2>
      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((a) => (
          <StaggerItem key={a.to}>
            <Link to={a.to} className="card card-hover flex h-full flex-col items-start gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-600"><a.icon className="h-5 w-5" /></span>
              <span className="text-sm font-medium text-forest">{a.label}</span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming appointments" to="/patient/appointments">
          {upcoming.isLoading ? <LoadingSkeleton rows={2} /> : !upcoming.data?.rows.length ? <EmptyState title="Nothing scheduled" /> : (
            <div className="space-y-3">{upcoming.data.rows.slice(0, 3).map((a) => <AppointmentCard key={a.id} appt={a} to={`/patient/appointments/${a.id}`} />)}</div>
          )}
        </Panel>
        <Panel title="Recent prescriptions" to="/patient/prescriptions">
          {rx.isLoading ? <LoadingSkeleton rows={2} /> : !rx.data?.length ? <EmptyState title="No prescriptions yet" /> : (
            <ul className="card divide-y divide-line">
              {rx.data.map((r) => (
                <li key={r.id}><Link to={`/patient/prescriptions/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mint-50/60">
                  <div className="min-w-0"><p className="truncate font-medium text-forest">{r.medications || r.reference}</p><p className="text-[13px] text-muted">{r.doctor_name} · {formatDate(r.issued_at ?? r.created_at)}</p></div>
                  <StatusBadge status={r.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent lab reports" to="/patient/lab-reports">
          {labs.isLoading ? <LoadingSkeleton rows={2} /> : !labs.data?.length ? <EmptyState title="No reports released yet" /> : (
            <ul className="card divide-y divide-line">
              {labs.data.map((r) => (
                <li key={r.id}><Link to={`/patient/lab-reports/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mint-50/60">
                  <div className="min-w-0"><p className="truncate font-medium text-forest">{r.test_name}</p><p className="text-[13px] text-muted">Resulted {formatDate(r.resulted_at)}</p></div>
                  <StatusBadge status={r.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Medication orders" to="/patient/orders">
          {orders.isLoading ? <LoadingSkeleton rows={2} /> : !orders.data?.length ? <EmptyState icon={<Package className="h-5 w-5" />} title="No orders yet" /> : (
            <ul className="card divide-y divide-line">
              {orders.data.map((o) => (
                <li key={o.id}><Link to={`/patient/orders/${o.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-mint-50/60">
                  <div><p className="font-medium text-forest">{o.reference}</p><p className="text-[13px] text-muted">{o.item_count} items · {formatMoney(o.total)}</p></div>
                  <StatusBadge status={o.status} />
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent activity" className="mt-6">
        {!activity.data?.length ? <EmptyState title="No recent activity" /> : (
          <ol className="card divide-y divide-line">
            {activity.data.slice(0, 6).map((n) => (
              <li key={n.id} className="flex gap-3 p-4">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint-400" />
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-forest">{n.title}</p><p className="text-[13px] text-muted">{n.body}</p></div>
                <span className="shrink-0 text-xs text-muted">{relativeTime(n.created_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  )
}

function Panel({ title, to, children, className }: { title: string; to?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {to && <Link to={to} className="rounded text-sm font-medium text-mint-700 hover:underline">View all</Link>}
      </div>
      {children}
    </section>
  )
}
