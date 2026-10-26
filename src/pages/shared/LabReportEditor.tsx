import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, FileUp, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/Dialog'
import { BackLink, PageHeader } from '@/components/common/Layout'
import { ErrorState, LoadingSkeleton } from '@/components/common/States'
import { PatientPicker } from '@/components/domain/PatientPicker'
import { FormField, Input, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDateTime, titleCase } from '@/lib/utils'
import { attachLabDocument, getLabReport, getPatientChart, labDocumentUrl, saveLabReport } from '@/services/clinical'
import type { LabStatus, PatientSearchRow } from '@/types/models'

const NEXT: Record<LabStatus | 'new', LabStatus[]> = {
  new: ['ordered', 'collected', 'in_progress', 'final'],
  ordered: ['ordered', 'collected', 'in_progress', 'final', 'cancelled'],
  collected: ['collected', 'in_progress', 'final', 'cancelled'],
  in_progress: ['in_progress', 'final', 'cancelled'],
  final: ['amended'],
  amended: ['amended'],
  cancelled: [],
}
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

type Row = { analyte: string; value: string; unit: string; reference_range: string }

export default function LabReportEditor() {
  const { reportId } = useParams()
  const [params] = useSearchParams()
  const base = useLocation().pathname.startsWith('/doctor') ? '/doctor' : '/staff'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const existing = useQuery({ queryKey: ['lab-report', reportId], queryFn: () => getLabReport(reportId!), enabled: !!reportId })
  const pre = useQuery({ queryKey: ['chart', params.get('patient')], queryFn: () => getPatientChart(params.get('patient')!), enabled: !!params.get('patient') && !reportId })
  const [patient, setPatient] = useState<PatientSearchRow | null>(null)
  const [form, setForm] = useState({ test_name: '', laboratory: 'A10 Diagnostics Laboratory', collected_at: '', resulted_at: '', status: 'ordered' as LabStatus, summary: '' })
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [confirmFinal, setConfirmFinal] = useState(false)

  useEffect(() => {
    if (pre.data) setPatient({ id: pre.data.profile.id, full_name: pre.data.profile.full_name, email: pre.data.profile.email, phone: null, date_of_birth: null, last_appointment_at: null, appointment_count: 0 })
  }, [pre.data])
  useEffect(() => {
    const r = existing.data
    if (!r) return
    setForm({ test_name: r.test_name, laboratory: r.laboratory, collected_at: toLocalInput(r.collected_at), resulted_at: toLocalInput(r.resulted_at), status: r.status === 'final' ? 'amended' : r.status, summary: r.summary ?? '' })
    setRows(r.results.map((x) => ({ analyte: x.analyte, value: x.value, unit: x.unit ?? '', reference_range: x.reference_range ?? '' })))
  }, [existing.data])
  const r = existing.data
  useDocumentTitle(r ? r.test_name : 'New lab record')
  const current: LabStatus | 'new' = r?.status ?? 'new'
  const options = NEXT[current]
  const locked = current === 'cancelled'

  const save = useMutation({
    mutationFn: () => saveLabReport({
      id: r?.id, patient_id: patient?.id ?? r?.patient_id, test_name: form.test_name, laboratory: form.laboratory,
      collected_at: fromLocalInput(form.collected_at), resulted_at: fromLocalInput(form.resulted_at), status: form.status, summary: form.summary || null,
      results: rows.filter((x) => x.analyte.trim()).map((x) => ({ analyte: x.analyte, value: x.value, unit: x.unit || null, reference_range: x.reference_range || null })),
    }),
    onSuccess: (res) => {
      toast.success(`Lab record ${res.reference} saved`)
      qc.invalidateQueries({ queryKey: ['lab-reports'] })
      qc.invalidateQueries({ queryKey: ['lab-report'] })
      if (!r) navigate(`${base}/lab-records/${res.id}`, { replace: true })
    },
    onError: (e) => setError(errorMessage(e)),
  })
  const upload = useMutation({
    mutationFn: (file: File) => attachLabDocument(r!, file),
    onSuccess: () => { toast.success('Document attached'); existing.refetch() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const openDoc = useMutation({ mutationFn: () => labDocumentUrl(r!.document_path!), onSuccess: (u) => window.open(u, '_blank', 'noopener'), onError: (e) => toast.error(errorMessage(e)) })

  const submit = () => {
    setError(null)
    if (!r && !patient) return setError('Select a patient.')
    if (form.test_name.trim().length < 2) return setError('Enter the test name.')
    if ((form.status === 'final' || form.status === 'amended') && !confirmFinal) return setConfirmFinal(true)
    save.mutate()
  }

  if (reportId && existing.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (reportId && (existing.error || !r)) return <ErrorState error={existing.error ?? 'Lab record not found or not accessible.'} />

  return (
    <>
      <BackLink to={`${base}/lab-records`}>Lab records</BackLink>
      <PageHeader title={r ? r.test_name : 'New lab record'} description={r ? `${r.reference} · ${r.patient_name ?? ''} · updated ${formatDateTime(r.updated_at)}` : 'Record a laboratory test for a patient. Results are released to the patient when marked final.'} />
      {r && <div className="mb-6 flex gap-2"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</div>}
      {r?.status === 'final' && <div className="mb-6"><FormAlert tone="info">This report is final. Any change will be saved as an <strong>amended</strong> report and recorded in the audit log.</FormAlert></div>}
      {error && <div className="mb-6"><FormAlert>{error}</FormAlert></div>}
      <fieldset disabled={locked} className="space-y-6">
        <section className="card grid gap-5 p-6 md:grid-cols-2">
          <FormField label="Patient" required>{r ? <Input value={r.patient_name ?? ''} disabled /> : <div><PatientPicker value={patient} onChange={setPatient} minChars={base === '/staff' ? 2 : 0} /></div>}</FormField>
          <FormField label="Test name" required><Input value={form.test_name} onChange={(e) => setForm({ ...form, test_name: e.target.value })} /></FormField>
          <FormField label="Reporting laboratory"><Input value={form.laboratory} onChange={(e) => setForm({ ...form, laboratory: e.target.value })} /></FormField>
          <FormField label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LabStatus })}>
              {options.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
            </Select>
          </FormField>
          <FormField label="Collected at" optional><Input type="datetime-local" value={form.collected_at} onChange={(e) => setForm({ ...form, collected_at: e.target.value })} /></FormField>
          <FormField label="Resulted at" optional hint="Defaults to now when finalised."><Input type="datetime-local" value={form.resulted_at} onChange={(e) => setForm({ ...form, resulted_at: e.target.value })} /></FormField>
        </section>
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Results</h2><Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => setRows([...rows, { analyte: '', value: '', unit: '', reference_range: '' }])}>Add result</Button></div>
          {!rows.length && <p className="text-sm text-muted">No structured results yet.</p>}
          <div className="space-y-3">
            {rows.map((x, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1.4fr_auto]">
                <Input placeholder="Analyte" aria-label="Analyte" value={x.analyte} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, analyte: e.target.value } : y)))} />
                <Input placeholder="Value" aria-label="Value" value={x.value} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} />
                <Input placeholder="Unit" aria-label="Unit" value={x.unit} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)))} />
                <Input placeholder="Lab’s reference range (if documented)" aria-label="Reference range" value={x.reference_range} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, reference_range: e.target.value } : y)))} />
                <Button variant="ghost" size="icon" aria-label="Remove result" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-error" /></Button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] text-muted">Only enter reference ranges published by the reporting laboratory. Do not add interpretations here.</p>
        </section>
        <section className="card p-6">
          <FormField label="Report notes" optional><Textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></FormField>
          {r && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
              <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>{r.document_path ? 'Replace document' : 'Attach report document'}</Button>
              {r.document_path && <Button variant="ghost" icon={<FileDown className="h-4 w-4" />} loading={openDoc.isPending} onClick={() => openDoc.mutate()}>View document</Button>}
              <span className="text-xs text-muted">Stored privately. PDF/PNG/JPG up to 10 MB.</span>
            </div>
          )}
          {!r && <p className="mt-4 text-xs text-muted">You can attach a document after the record is created.</p>}
        </section>
        <div className="flex justify-end"><Button size="lg" icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={submit}>{r ? 'Save changes' : 'Create lab record'}</Button></div>
      </fieldset>
      <ConfirmationDialog open={confirmFinal} onOpenChange={setConfirmFinal} title={form.status === 'amended' ? 'Save amended report?' : 'Release final report?'} description="The patient will be able to see this report and its results in their portal, and will be notified." confirmLabel="Release report" onConfirm={() => save.mutateAsync()} />
    </>
  )
}
