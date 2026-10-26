import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarX2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { ConfirmationDialog, Modal } from '@/components/common/Dialog'
import { BackLink, DescriptionList, PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { SlotPicker } from '@/components/domain/SlotPicker'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/hooks/useSettings'
import { errorMessage, formatDateTime, titleCase } from '@/lib/utils'
import { getAppointment, getAppointmentEvents, rescheduleAppointment, updateAppointmentStatus } from '@/services/appointments'
import type { Appointment } from '@/types/models'

export function Timeline({ events }: { events: { id: number | string; to_status: string; note: string | null; created_at: string }[] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {events.map((e, i) => (
        <li key={e.id} className="relative">
          <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${i === events.length - 1 ? 'bg-mint-500' : 'bg-mint-200'}`} aria-hidden />
          <p className="text-sm font-medium text-forest">{titleCase(e.to_status)}</p>
          <p className="text-xs text-muted">{formatDateTime(e.created_at)}</p>
          {e.note && <p className="mt-1 text-[13px] text-muted-strong">{e.note}</p>}
        </li>
      ))}
    </ol>
  )
}

export default function AppointmentDetail() {
  const { appointmentId = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: settings } = useSettings()
  const appt = useQuery({ queryKey: ['appointment', appointmentId], queryFn: () => getAppointment(appointmentId) })
  const events = useQuery({ queryKey: ['appointment-events', appointmentId], queryFn: () => getAppointmentEvents(appointmentId), enabled: !!appt.data })
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reOpen, setReOpen] = useState(false)
  const [newSlot, setNewSlot] = useState<string | null>(null)
  useDocumentTitle(appt.data ? `Appointment ${appt.data.reference}` : 'Appointment')

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['appointment'] })
    qc.invalidateQueries({ queryKey: ['appointment-events'] })
    qc.invalidateQueries({ queryKey: ['slots'] })
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }
  const reschedule = useMutation({
    mutationFn: () => rescheduleAppointment(appointmentId, newSlot!),
    onSuccess: (a: Appointment) => { toast.success(`Rescheduled — new reference ${a.reference}`); setReOpen(false); refresh(); navigate(`/patient/appointments/${a.id}`) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (appt.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (appt.error) return <ErrorState error={appt.error} onRetry={() => appt.refetch()} />
  const a = appt.data
  if (!a) return <EmptyState title="Appointment not found" description="It may not exist or may belong to another account." action={<ButtonLink to="/patient/appointments">My appointments</ButtonLink>} />

  const cutoffHours = Number(settings?.cancellation_cutoff_hours ?? 2)
  const changeable = ['requested', 'confirmed'].includes(a.status) && new Date(a.starts_at).getTime() > Date.now() + cutoffHours * 3600_000

  return (
    <>
      <BackLink to="/patient/appointments">My appointments</BackLink>
      <PageHeader title={`Appointment ${a.reference}`} description={`${a.doctor_name} · ${a.department_name}`} actions={changeable && (
        <>
          <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setReOpen(true)}>Reschedule</Button>
          <Button variant="danger-outline" icon={<CalendarX2 className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>Cancel</Button>
        </>
      )} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap gap-2"><StatusBadge status={a.status} />{a.is_sample && <SampleBadge />}</div>
          <DescriptionList items={[
            { label: 'Date & time', value: formatDateTime(a.starts_at) },
            { label: 'Doctor', value: a.doctor_name },
            { label: 'Department', value: a.department_name },
            { label: 'Speciality', value: a.doctor_speciality },
            { label: 'Patient', value: a.patient_name },
            { label: 'Contact phone', value: a.patient_phone },
            { label: 'Reason', value: a.reason },
            ...(a.cancel_reason ? [{ label: 'Cancellation note', value: a.cancel_reason }] : []),
          ]} />
          {!changeable && ['requested', 'confirmed'].includes(a.status) && <p className="mt-6 rounded-xl bg-mist p-4 text-sm text-muted-strong">Online changes close {cutoffHours} hours before the appointment. Please contact the hospital to make changes.</p>}
        </section>
        <aside className="card p-6">
          <h2 className="mb-5 text-base font-semibold">Status history</h2>
          {events.data?.length ? <Timeline events={events.data} /> : <p className="text-sm text-muted">No history yet.</p>}
        </aside>
      </div>
      <ConfirmationDialog open={cancelOpen} onOpenChange={setCancelOpen} tone="danger" title="Cancel this appointment?" description={`Your appointment with ${a.doctor_name} on ${formatDateTime(a.starts_at)} will be cancelled and the time released.`} confirmLabel="Cancel appointment" noteLabel="Reason for cancelling"
        onConfirm={async (note) => {
          try { await updateAppointmentStatus(a.id, 'cancelled', note); toast.success('Appointment cancelled'); refresh() } catch (e) { toast.error(errorMessage(e)); throw e }
        }} />
      <Modal open={reOpen} onOpenChange={setReOpen} size="lg" title="Choose a new time" description={`With ${a.doctor_name}. Your current slot is released once the new one is confirmed.`}
        footer={<><Button variant="secondary" onClick={() => setReOpen(false)}>Keep current time</Button><Button disabled={!newSlot} loading={reschedule.isPending} onClick={() => reschedule.mutate()}>Confirm new time</Button></>}>
        {reOpen && <SlotPicker doctorId={a.doctor_id} value={newSlot} onChange={(s) => setNewSlot(s.starts_at)} />}
      </Modal>
    </>
  )
}
