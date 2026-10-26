import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog, Drawer } from '@/components/common/Dialog'
import { DescriptionList, PageHeader, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar, Select, Textarea } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { addDaysKey, cn, errorMessage, formatDate, formatDateTime, formatTime, hospitalDateKey, hospitalDayStartIso } from '@/lib/utils'
import { getAppointmentEvents, getConsultation, listAppointments, saveConsultationNotes, updateAppointmentStatus } from '@/services/appointments'
import type { Appointment, AppointmentStatus } from '@/types/models'
import { Timeline } from '@/pages/patient/AppointmentDetail'

type Range = 'today' | 'upcoming' | 'past' | 'all'

const dayStartIso = hospitalDayStartIso

function transitions(a: Appointment, isDoctor: boolean): AppointmentStatus[] {
  const started = new Date(a.starts_at).getTime() <= Date.now()
  if (a.status === 'requested') return ['confirmed', 'cancelled']
  if (a.status === 'confirmed') return [...(isDoctor && started ? (['completed'] as const) : []), ...(started ? (['no_show'] as const) : []), 'cancelled']
  return []
}

function ApptPanel({ appt, isDoctor, onClose }: { appt: Appointment; isDoctor: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const events = useQuery({ queryKey: ['appointment-events', appt.id], queryFn: () => getAppointmentEvents(appt.id) })
  const consult = useQuery({ queryKey: ['consultation', appt.id], queryFn: () => getConsultation(appt.id), enabled: isDoctor })
  const [notes, setNotes] = useState<string | null>(null)
  const [pending, setPending] = useState<AppointmentStatus | null>(null)
  const save = useMutation({
    mutationFn: () => saveConsultationNotes(appt.id, notes ?? ''),
    onSuccess: () => { toast.success('Consultation notes saved'); qc.invalidateQueries({ queryKey: ['consultation', appt.id] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const notesValue = notes ?? consult.data?.notes ?? ''
  const { pathname } = useLocation()
  const base = pathname.startsWith('/doctor') ? '/doctor' : pathname.startsWith('/staff') ? '/staff' : null
  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap gap-2"><StatusBadge status={appt.status} />{appt.is_sample && <SampleBadge />}</div>
      <DescriptionList className="sm:grid-cols-1" items={[
        { label: 'Reference', value: appt.reference },
        { label: 'When', value: formatDateTime(appt.starts_at) },
        { label: 'Patient', value: base ? <Link to={`${base}/patients/${appt.patient_id}`} className="font-medium text-mint-700 underline">{appt.patient_name}</Link> : appt.patient_name },
        { label: 'Contact', value: [appt.patient_phone, appt.patient_email].filter(Boolean).join(' · ') || '—' },
        { label: 'Doctor', value: `${appt.doctor_name} · ${appt.department_name}` },
        { label: 'Reason', value: appt.reason },
        ...(appt.cancel_reason ? [{ label: 'Cancellation note', value: appt.cancel_reason }] : []),
      ]} />
      {transitions(appt, isDoctor).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transitions(appt, isDoctor).map((s) => (
            <Button key={s} size="sm" variant={s === 'cancelled' || s === 'no_show' ? 'danger-outline' : 'primary'} onClick={() => setPending(s)}>
              {s === 'confirmed' ? 'Confirm' : s === 'completed' ? 'Mark completed' : s === 'no_show' ? 'Mark no-show' : 'Cancel'}
            </Button>
          ))}
        </div>
      )}
      {isDoctor && ['confirmed', 'completed'].includes(appt.status) && (
        <div>
          <label className="text-sm font-semibold text-forest" htmlFor="consult-notes">Consultation notes</label>
          <p className="text-xs text-muted">Visible to treating clinicians only. Changes are audited.</p>
          <Textarea id="consult-notes" className="mt-2" rows={5} value={notesValue} onChange={(e) => setNotes(e.target.value)} maxLength={8000} />
          <Button size="sm" className="mt-2" loading={save.isPending} disabled={notes === null} onClick={() => save.mutate()}>Save notes</Button>
        </div>
      )}
      <div>
        <h3 className="mb-4 text-sm font-semibold text-forest">History</h3>
        {events.data ? <Timeline events={events.data} /> : <LoadingSkeleton rows={2} />}
      </div>
      <ConfirmationDialog open={!!pending} onOpenChange={(v) => !v && setPending(null)} tone={pending === 'cancelled' || pending === 'no_show' ? 'danger' : 'primary'}
        title={`${pending === 'confirmed' ? 'Confirm' : pending === 'completed' ? 'Complete' : pending === 'no_show' ? 'Mark no-show for' : 'Cancel'} ${appt.reference}?`}
        description="The patient will see this status change in their portal." noteLabel={pending === 'cancelled' ? 'Reason (shared with the patient)' : 'Note'} confirmLabel="Confirm"
        onConfirm={async (note) => {
          try {
            await updateAppointmentStatus(appt.id, pending!, note)
            toast.success('Appointment updated')
            qc.invalidateQueries({ queryKey: ['appointments'] })
            qc.invalidateQueries({ queryKey: ['appointment-events', appt.id] })
            onClose()
          } catch (e) { toast.error(errorMessage(e)); throw e }
        }} />
    </div>
  )
}

function WeekCalendar({ rows, weekStart, onSelect }: { rows: Appointment[]; weekStart: string; onSelect: (a: Appointment) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i))
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => {
        const items = rows.filter((a) => hospitalDateKey(a.starts_at) === d)
        const today = d === hospitalDateKey()
        return (
          <div key={d} className={cn('min-h-36 rounded-2xl border bg-white p-3', today ? 'border-mint-400' : 'border-line')}>
            <p className={cn('text-xs font-semibold uppercase tracking-wide', today ? 'text-mint-700' : 'text-muted')}>{formatDate(dayStartIso(d), { weekday: 'short', day: 'numeric', month: 'short', year: undefined })}</p>
            <ul className="mt-2 space-y-1.5">
              {items.map((a) => (
                <li key={a.id}>
                  <button onClick={() => onSelect(a)} className={cn('w-full rounded-lg px-2 py-1.5 text-left text-[12.5px] transition-colors', a.status === 'cancelled' ? 'bg-mist text-muted line-through' : a.status === 'requested' ? 'bg-[#fbf3e4] text-[#7a5413] hover:bg-[#f7e9cd]' : 'bg-mint-100 text-forest hover:bg-mint-200')}>
                    <span className="font-semibold">{formatTime(a.starts_at)}</span> {a.patient_name}
                  </button>
                </li>
              ))}
              {!items.length && <li className="text-xs text-muted/70">—</li>}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default function AppointmentsManager() {
  useDocumentTitle('Appointments')
  const { access, hasRole } = useAuth()
  const { pathname } = useLocation()
  const isDoctor = hasRole('doctor') && pathname.startsWith('/doctor')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [range, setRange] = useState<Range>('upcoming')
  const [status, setStatus] = useState<string>('')
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const [weekStart, setWeekStart] = useState(() => {
    const k = hospitalDateKey()
    const dow = new Date(`${k}T00:00:00Z`).getUTCDay()
    return addDaysKey(k, -((dow + 6) % 7))
  })
  const [selected, setSelected] = useState<Appointment | null>(null)

  const query = useMemo(() => {
    const today = hospitalDateKey()
    if (view === 'calendar') return { from: dayStartIso(weekStart), to: dayStartIso(addDaysKey(weekStart, 7)) }
    if (date) return { from: dayStartIso(date), to: dayStartIso(addDaysKey(date, 1)) }
    if (range === 'today') return { from: dayStartIso(today), to: dayStartIso(addDaysKey(today, 1)) }
    if (range === 'upcoming') return { from: new Date().toISOString() }
    if (range === 'past') return { to: new Date().toISOString() }
    return {}
  }, [view, weekStart, date, range])

  const appts = useQuery({
    queryKey: ['appointments', 'manage', isDoctor ? access?.doctor_id : 'all', query, status, q],
    queryFn: () => listAppointments({
      ...query,
      scope: range === 'past' && view === 'list' && !date ? 'all' : undefined,
      doctorId: isDoctor ? access!.doctor_id! : undefined,
      statuses: status ? [status as AppointmentStatus] : undefined,
      search: q,
      limit: 200,
    }),
    placeholderData: keepPreviousData,
  })
  const rows = useMemo(() => {
    const r = appts.data?.rows ?? []
    return range === 'past' && view === 'list' && !date ? [...r].sort((a, b) => b.starts_at.localeCompare(a.starts_at)) : r
  }, [appts.data, range, view, date])

  return (
    <>
      <PageHeader title={isDoctor ? 'My appointments' : 'Appointment schedule'} description={isDoctor ? 'Review requests, confirm visits and record outcomes.' : 'Manage appointments across departments within your permissions.'}
        actions={<Segmented label="View" value={view} onChange={setView} options={[{ value: 'list', label: <span className="flex items-center gap-1.5"><List className="h-4 w-4" />List</span> }, { value: 'calendar', label: <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Week</span> }]} />} />
      {view === 'list' ? (
        <div className="card mb-6 grid gap-3 p-4 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
          <Segmented label="Date range" value={range} onChange={(v) => { setRange(v); setDate('') }} options={[{ value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'all', label: 'All' }]} />
          <SearchBar value={search} onChange={setSearch} placeholder="Search patient, reference, doctor" label="Search appointments" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date" className="h-11 rounded-[var(--radius-control)] border border-line-strong px-3 text-sm" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="md:w-44">
            <option value="">All statuses</option>
            {['requested', 'confirmed', 'completed', 'cancelled', 'no_show'].map((s) => <option key={s} value={s}>{s.replace('_', '-')}</option>)}
          </Select>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDaysKey(weekStart, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDaysKey(weekStart, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
          <p className="ml-2 font-medium text-forest">Week of {formatDate(dayStartIso(weekStart))}</p>
        </div>
      )}
      {appts.isLoading ? <LoadingSkeleton rows={5} /> : appts.error ? <ErrorState error={appts.error} onRetry={() => appts.refetch()} /> : view === 'calendar' ? (
        <WeekCalendar rows={rows} weekStart={weekStart} onSelect={setSelected} />
      ) : !rows.length ? <EmptyState icon={<CalendarX2 className="h-5 w-5" />} title="No appointments match these filters" /> : (
        <DataTable caption="Appointments" rows={rows} rowKey={(a) => a.id} onRowClick={setSelected} columns={[
          { key: 'when', header: 'When', cell: (a) => <div><p className="font-medium text-forest">{formatDate(a.starts_at, { weekday: 'short' })}</p><p className="text-xs text-muted">{formatTime(a.starts_at)}</p></div> },
          { key: 'patient', header: 'Patient', cell: (a) => <div><p className="font-medium">{a.patient_name}</p><p className="text-xs text-muted">{a.reference}</p></div> },
          ...(!isDoctor ? [{ key: 'doctor', header: 'Doctor', cell: (a: Appointment) => <div><p>{a.doctor_name}</p><p className="text-xs text-muted">{a.department_name}</p></div>, hideOnMobile: true }] : []),
          { key: 'reason', header: 'Reason', cell: (a) => <span className="line-clamp-1 text-muted-strong">{a.reason ?? '—'}</span>, hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (a) => <span className="flex flex-wrap gap-1.5"><StatusBadge status={a.status} />{a.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)} title={selected ? `Appointment ${selected.reference}` : 'Appointment'}>
        {selected && <ApptPanel appt={selected} isDoctor={isDoctor} onClose={() => setSelected(null)} />}
      </Drawer>
    </>
  )
}
