import { useQuery } from '@tanstack/react-query'
import { FlaskConical, HeartPulse, Plus, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { Avatar, BackLink, DescriptionList, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatCalendarDate, formatDate, formatDateTime } from '@/lib/utils'
import { getPatientChart } from '@/services/clinical'

type Tab = 'appointments' | 'prescriptions' | 'labs' | 'observations' | 'notes'

export default function PatientChart() {
  const { patientId = '' } = useParams()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/doctor') ? '/doctor' : '/staff'
  const chart = useQuery({ queryKey: ['chart', patientId], queryFn: () => getPatientChart(patientId), staleTime: 0 })
  const [tab, setTab] = useState<Tab | null>(null)
  useDocumentTitle(chart.data?.profile.full_name ?? 'Patient record')

  if (chart.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (chart.error) return <><BackLink to={`${base}/patients`}>Patient records</BackLink><ErrorState error={chart.error} title="Access denied or record unavailable" /></>
  const c = chart.data!
  const clinical = c.scope === 'clinical'
  const tabs: { value: Tab; label: string; count?: number }[] = [
    ...(c.scope !== 'laboratory' ? [{ value: 'appointments' as Tab, label: 'Appointments', count: c.appointments.length }] : []),
    ...(clinical ? [{ value: 'prescriptions' as Tab, label: 'Prescriptions', count: c.prescriptions.length }] : []),
    ...(c.scope !== 'administrative' ? [{ value: 'labs' as Tab, label: 'Lab reports', count: c.lab_reports.length }] : []),
    ...(clinical ? [{ value: 'observations' as Tab, label: 'Observations', count: c.observations.length }, { value: 'notes' as Tab, label: 'Consultation notes', count: c.consultations.length }] : []),
  ]
  const active = tab ?? tabs[0]?.value

  return (
    <>
      <BackLink to={`${base}/patients`}>Patient records</BackLink>
      <section className="card mb-6 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={c.profile.full_name || '?'} size="lg" />
            <div>
              <h1 className="text-2xl font-semibold">{c.profile.full_name}</h1>
              <p className="text-sm text-muted">{c.profile.email}{c.profile.is_sample && <SampleBadge className="ml-2" label="Sample patient" />}</p>
            </div>
          </div>
          {clinical && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink to={`/doctor/prescriptions/new?patient=${patientId}`} size="sm" icon={<ScrollText className="h-4 w-4" />}>New prescription</ButtonLink>
              <ButtonLink to={`/doctor/lab-records/new?patient=${patientId}`} size="sm" variant="secondary" icon={<FlaskConical className="h-4 w-4" />}>New lab record</ButtonLink>
              <ButtonLink to={`/doctor/observations?patient=${patientId}`} size="sm" variant="secondary" icon={<HeartPulse className="h-4 w-4" />}>Record observation</ButtonLink>
            </div>
          )}
          {c.scope === 'laboratory' && <ButtonLink to={`/staff/lab-records/new?patient=${patientId}`} size="sm" icon={<Plus className="h-4 w-4" />}>New lab record</ButtonLink>}
        </div>
        <DescriptionList className="mt-6 lg:grid-cols-4" items={[
          { label: 'Date of birth', value: formatCalendarDate(c.profile.date_of_birth) },
          { label: 'Phone', value: c.profile.phone },
          { label: 'Blood group', value: c.profile.blood_group ?? 'Not recorded' },
          { label: 'Emergency contact', value: c.profile.emergency_contact_name ? `${c.profile.emergency_contact_name} (${c.profile.emergency_contact_phone ?? '—'})` : '—' },
        ]} />
      </section>
      <FormAlert tone="info">Access scope: <strong>{c.scope}</strong>. {clinical ? 'You can see this patient because they have an appointment with you.' : 'Clinical details are hidden for your role.'} This view has been recorded in the audit log.</FormAlert>
      <Segmented className="my-6" label="Record sections" value={active} onChange={setTab} options={tabs} />
      {active === 'appointments' && (c.appointments.length ? (
        <ul className="card divide-y divide-line">{c.appointments.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-forest">{formatDateTime(a.starts_at)}</p><p className="text-[13px] text-muted">{a.doctor_name} · {a.department_name} · {a.reference}</p>{a.reason && <p className="text-[13px] text-muted-strong">{a.reason}</p>}</div><StatusBadge status={a.status} /></li>)}</ul>
      ) : <EmptyState title="No appointments" />)}
      {active === 'prescriptions' && (c.prescriptions.length ? (
        <ul className="card divide-y divide-line">{c.prescriptions.map((r) => <li key={r.id}><Link to={`/doctor/prescriptions/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-mint-50/60"><div><p className="font-medium text-forest">{r.items.join(', ')}</p><p className="text-[13px] text-muted">{r.reference} · v{r.version} · {r.doctor_name} · {formatDate(r.issued_at ?? r.created_at)}</p></div><StatusBadge status={r.status} /></Link></li>)}</ul>
      ) : <EmptyState title="No prescriptions" />)}
      {active === 'labs' && (c.lab_reports.length ? (
        <ul className="card divide-y divide-line">{c.lab_reports.map((l) => <li key={l.id}><Link to={`${base}/lab-records/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-mint-50/60"><div><p className="font-medium text-forest">{l.test_name}</p><p className="text-[13px] text-muted">{l.reference} · collected {formatDate(l.collected_at)} · resulted {formatDate(l.resulted_at)}</p></div><span className="flex gap-1.5"><StatusBadge status={l.status} />{l.is_sample && <SampleBadge />}</span></Link></li>)}</ul>
      ) : <EmptyState title="No lab reports" />)}
      {active === 'observations' && (c.observations.length ? (
        <ul className="card divide-y divide-line">{c.observations.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium text-forest">{o.observation_type}: {o.value} {o.unit}</p>{o.context && <p className="text-[13px] text-muted">{o.context}</p>}</div><span className="text-sm text-muted">{formatDateTime(o.observed_at)}</span></li>)}</ul>
      ) : <EmptyState title="No observations recorded" />)}
      {active === 'notes' && (c.consultations.length ? (
        <ul className="space-y-3">{c.consultations.map((n) => <li key={n.id} className="card p-5"><p className="text-xs text-muted">Updated {formatDateTime(n.updated_at)}</p><p className="mt-2 whitespace-pre-line text-[15px] text-ink">{n.notes || '—'}</p></li>)}</ul>
      ) : <EmptyState title="No consultation notes" description="Add notes from the appointment panel." />)}
    </>
  )
}
