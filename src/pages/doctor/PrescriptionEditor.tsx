import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FilePen, Plus, Save, Send, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/Dialog'
import { BackLink, DescriptionList, PageHeader } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { PatientPicker } from '@/components/domain/PatientPicker'
import { FormField, Input, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDateTime } from '@/lib/utils'
import { rxItemSchema } from '@/schemas'
import { listAppointments } from '@/services/appointments'
import { amendPrescription, cancelPrescription, getPatientChart, getPrescription, savePrescription, type RxItemInput } from '@/services/clinical'
import { listMedicines } from '@/services/pharmacy'
import type { PatientSearchRow } from '@/types/models'

const emptyItem = (): RxItemInput => ({ medicine_id: null, medication_name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: null })

export default function PrescriptionEditor() {
  const { prescriptionId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { access } = useAuth()
  const existing = useQuery({ queryKey: ['prescription', prescriptionId], queryFn: () => getPrescription(prescriptionId!), enabled: !!prescriptionId })
  const [patient, setPatient] = useState<PatientSearchRow | null>(null)
  const [appointmentId, setAppointmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<RxItemInput[]>([emptyItem()])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [amending, setAmending] = useState(false)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState<'issue' | 'amend' | 'cancel' | null>(null)
  const meds = useQuery({ queryKey: ['medicines', 'all'], queryFn: () => listMedicines({ limit: 200 }) })

  const preselect = params.get('patient')
  const pre = useQuery({ queryKey: ['chart', preselect], queryFn: () => getPatientChart(preselect!), enabled: !!preselect && !prescriptionId })
  useEffect(() => {
    if (pre.data) setPatient({ id: pre.data.profile.id, full_name: pre.data.profile.full_name, email: pre.data.profile.email, phone: pre.data.profile.phone, date_of_birth: pre.data.profile.date_of_birth, last_appointment_at: null, appointment_count: 0 })
  }, [pre.data])
  useEffect(() => {
    const r = existing.data
    if (!r) return
    setPatient({ id: r.patient_id, full_name: r.patient_name ?? '', email: '', phone: null, date_of_birth: null, last_appointment_at: null, appointment_count: 0 })
    setAppointmentId(r.appointment_id ?? '')
    setNotes(r.notes ?? '')
    setItems(r.items.map((i) => ({ medicine_id: i.medicine_id, medication_name: i.medication_name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions ?? '', quantity: i.quantity })))
  }, [existing.data])

  const appts = useQuery({ queryKey: ['appointments', 'rx', patient?.id], queryFn: () => listAppointments({ patientId: patient!.id, doctorId: access!.doctor_id!, statuses: ['confirmed', 'completed'], limit: 20 }), enabled: !!patient })
  const r = existing.data
  const status = r?.status ?? 'new'
  const editable = status === 'new' || status === 'draft' || amending
  useDocumentTitle(r ? `Prescription ${r.reference}` : 'New prescription')

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!patient) errs.patient = 'Select a patient'
    items.forEach((it, i) => {
      const res = rxItemSchema.safeParse({ ...it, quantity: it.quantity || null })
      if (!res.success) errs[`item${i}`] = res.error.issues[0].message
    })
    if (amending && reason.trim().length < 5) errs.reason = 'Record a reason for the amendment (at least 5 characters)'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }
  const done = (msg: string, id?: string) => {
    toast.success(msg)
    qc.invalidateQueries({ queryKey: ['prescriptions'] })
    qc.invalidateQueries({ queryKey: ['prescription'] })
    qc.invalidateQueries({ queryKey: ['chart'] })
    if (id) navigate(`/doctor/prescriptions/${id}`, { replace: true })
  }
  const clean = () => items.map((i) => ({ ...i, instructions: i.instructions || null, quantity: i.quantity ? Number(i.quantity) : null }))
  const save = useMutation({
    mutationFn: (issue: boolean) => savePrescription({ id: r?.id, patientId: patient!.id, appointmentId: appointmentId || null, notes, items: clean(), issue }),
    onSuccess: (res, issue) => done(issue ? `Prescription ${res.reference} issued` : 'Draft saved', res.id),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const amend = useMutation({
    mutationFn: () => amendPrescription(r!.id, reason, notes, clean()),
    onSuccess: (res) => { setAmending(false); done(`Amended — new version ${res.reference}`, res.id) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (prescriptionId && existing.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (prescriptionId && (existing.error || !r)) return <ErrorState error={existing.error ?? 'Prescription not found or not accessible.'} />

  const setItem = (i: number, patch: Partial<RxItemInput>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <>
      <BackLink to="/doctor/prescriptions">Prescriptions</BackLink>
      <PageHeader title={r ? `Prescription ${r.reference}` : 'New prescription'} description={r ? `Version ${r.version} · created ${formatDateTime(r.created_at)}` : 'Prescribe for a patient under your care. You make every clinical decision; nothing is auto-selected.'}
        actions={r && r.status === 'issued' && !amending && r.doctor_id === access?.doctor_id && (
          <>
            <Button variant="secondary" icon={<FilePen className="h-4 w-4" />} onClick={() => setAmending(true)}>Amend</Button>
            <Button variant="danger-outline" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm('cancel')}>Cancel prescription</Button>
          </>
        )} />
      {r && <div className="mb-6 flex flex-wrap items-center gap-2"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}{r.supersedes_id && <Link to={`/doctor/prescriptions/${r.supersedes_id}`} className="text-sm text-mint-700 underline">Previous version</Link>}{r.amendment_reason && <span className="text-sm text-muted">Reason: {r.amendment_reason}</span>}</div>}
      {r?.status === 'superseded' && <div className="mb-6"><FormAlert tone="info">This version has been superseded by an amendment and is kept for the clinical record.</FormAlert></div>}

      <div className="space-y-6">
        <section className="card grid gap-5 p-6 md:grid-cols-2">
          <FormField label="Patient" error={errors.patient} required>
            {r ? <Input value={r.patient_name ?? ''} disabled /> : <div><PatientPicker value={patient} onChange={setPatient} /></div>}
          </FormField>
          <FormField label="Linked consultation" optional>
            <Select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} disabled={!editable || !patient}>
              <option value="">None</option>
              {appts.data?.rows.map((a) => <option key={a.id} value={a.id}>{a.reference} — {formatDateTime(a.starts_at)}</option>)}
            </Select>
          </FormField>
        </section>

        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Medications</h2>{editable && items.length < 20 && <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setItems([...items, emptyItem()])}>Add item</Button>}</div>
          <datalist id="med-list">{meds.data?.rows.map((m) => <option key={m.id} value={`${m.name} ${m.strength ?? ''}`.trim()} />)}</datalist>
          <div className="space-y-4">
            {items.map((it, i) => (
              <fieldset key={i} className="rounded-2xl border border-line p-4" disabled={!editable}>
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">Item {i + 1}</legend>
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_90px]">
                  <Input list="med-list" placeholder="Medication and strength" aria-label="Medication" value={it.medication_name} onChange={(e) => {
                    const match = meds.data?.rows.find((m) => `${m.name} ${m.strength ?? ''}`.trim() === e.target.value)
                    setItem(i, { medication_name: e.target.value, medicine_id: match?.id ?? null })
                  }} />
                  <Input placeholder="Dosage" aria-label="Dosage" value={it.dosage} onChange={(e) => setItem(i, { dosage: e.target.value })} />
                  <Input placeholder="Frequency" aria-label="Frequency" value={it.frequency} onChange={(e) => setItem(i, { frequency: e.target.value })} />
                  <Input placeholder="Duration" aria-label="Duration" value={it.duration} onChange={(e) => setItem(i, { duration: e.target.value })} />
                  <Input placeholder="Qty" aria-label="Quantity" inputMode="numeric" value={it.quantity ?? ''} onChange={(e) => setItem(i, { quantity: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} />
                </div>
                <div className="mt-3 flex gap-3">
                  <Input placeholder="Instructions (optional)" aria-label="Instructions" value={it.instructions ?? ''} onChange={(e) => setItem(i, { instructions: e.target.value })} />
                  {editable && items.length > 1 && <Button variant="ghost" size="icon" aria-label={`Remove item ${i + 1}`} onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-error" /></Button>}
                </div>
                {errors[`item${i}`] && <p role="alert" className="mt-2 text-[12.5px] font-medium text-error">{errors[`item${i}`]}</p>}
              </fieldset>
            ))}
          </div>
        </section>

        <section className="card space-y-5 p-6">
          <FormField label="Notes for the patient" optional><Textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} /></FormField>
          {amending && <FormField label="Reason for amendment" error={errors.reason} required hint="Stored with the new version and in the audit log."><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormField>}
        </section>

        {!editable && r && <DescriptionList items={[{ label: 'Issued', value: formatDateTime(r.issued_at) }, { label: 'Linked consultation', value: r.appointment_reference ?? '—' }]} />}

        {editable && (
          <div className="sticky bottom-4 z-10 flex flex-wrap justify-end gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
            {amending ? (
              <>
                <Button variant="secondary" onClick={() => { setAmending(false); existing.refetch() }}>Discard amendment</Button>
                <Button icon={<Send className="h-4 w-4" />} onClick={() => validate() && setConfirm('amend')}>Issue amended version</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" icon={<Save className="h-4 w-4" />} loading={save.isPending && save.variables === false} onClick={() => validate() && save.mutate(false)}>Save draft</Button>
                <Button icon={<Send className="h-4 w-4" />} onClick={() => validate() && setConfirm('issue')}>Issue prescription</Button>
              </>
            )}
          </div>
        )}
      </div>
      <ConfirmationDialog open={confirm === 'issue' || confirm === 'amend'} onOpenChange={(o) => !o && setConfirm(null)} title={confirm === 'amend' ? 'Issue amended prescription?' : 'Issue this prescription?'}
        description={<>Please check the patient, medications, dosages and durations. Once issued, the prescription is visible to <strong>{patient?.full_name}</strong> and can only be changed through an audited amendment.</>}
        confirmLabel={confirm === 'amend' ? 'Issue amendment' : 'Issue prescription'} onConfirm={() => (confirm === 'amend' ? amend.mutateAsync() : save.mutateAsync(true))} />
      <ConfirmationDialog open={confirm === 'cancel'} onOpenChange={(o) => !o && setConfirm(null)} tone="danger" title="Cancel this prescription?" description="The patient will no longer be able to use it for pharmacy orders." noteLabel="Reason" noteRequired confirmLabel="Cancel prescription"
        onConfirm={async (note) => { try { await cancelPrescription(r!.id, note); done('Prescription cancelled'); existing.refetch() } catch (e) { toast.error(errorMessage(e)); throw e } }} />
    </>
  )
}
