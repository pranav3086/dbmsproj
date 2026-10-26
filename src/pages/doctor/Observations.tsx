import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HeartPulse, Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { SampleBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Dialog'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { PatientPicker } from '@/components/domain/PatientPicker'
import { FormField, Input, SearchBar, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDateTime } from '@/lib/utils'
import { createObservation, getPatientChart, listObservations, updateObservation } from '@/services/clinical'
import type { Observation, PatientSearchRow } from '@/types/models'

const COMMON = ['Blood pressure', 'Heart rate', 'Temperature', 'Respiratory rate', 'Oxygen saturation', 'Weight', 'Height', 'Pain score', 'Clinical note']
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function ObservationForm({ initial, onDone }: { initial?: Observation; onDone: () => void }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [patient, setPatient] = useState<PatientSearchRow | null>(null)
  const pre = useQuery({ queryKey: ['chart', params.get('patient')], queryFn: () => getPatientChart(params.get('patient')!), enabled: !initial && !!params.get('patient') })
  useEffect(() => { if (pre.data) setPatient({ id: pre.data.profile.id, full_name: pre.data.profile.full_name, email: pre.data.profile.email, phone: null, date_of_birth: null, last_appointment_at: null, appointment_count: 0 }) }, [pre.data])
  const [v, setV] = useState({
    observation_type: initial?.observation_type ?? '', value: initial?.value ?? '', unit: initial?.unit ?? '', context: initial?.context ?? '',
    observed_at: initial ? new Date(new Date(initial.observed_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : nowLocal(),
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (!initial && !patient) throw new Error('Select a patient.')
      if (v.observation_type.trim().length < 2 || !v.value.trim()) throw new Error('Enter the observation type and value.')
      const payload = { observation_type: v.observation_type.trim(), value: v.value.trim(), unit: v.unit.trim() || null, context: v.context.trim() || null, observed_at: new Date(v.observed_at).toISOString() }
      if (initial) await updateObservation(initial.id, payload)
      else await createObservation({ ...payload, patient_id: patient!.id, observer_id: session!.userId })
    },
    onSuccess: () => { toast.success('Observation saved'); qc.invalidateQueries({ queryKey: ['observations'] }); qc.invalidateQueries({ queryKey: ['chart'] }); onDone() },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <div className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      {!initial && <FormField label="Patient" required><div><PatientPicker value={patient} onChange={setPatient} /></div></FormField>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Observation type" required><Input list="obs-types" value={v.observation_type} onChange={(e) => setV({ ...v, observation_type: e.target.value })} /></FormField>
        <datalist id="obs-types">{COMMON.map((c) => <option key={c} value={c} />)}</datalist>
        <FormField label="Observed at" required><Input type="datetime-local" value={v.observed_at} onChange={(e) => setV({ ...v, observed_at: e.target.value })} /></FormField>
        <FormField label="Value" required><Input value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></FormField>
        <FormField label="Unit" optional><Input value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} /></FormField>
      </div>
      <FormField label="Clinical context" optional><Textarea rows={2} value={v.context} onChange={(e) => setV({ ...v, context: e.target.value })} /></FormField>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button loading={save.isPending} onClick={() => { setError(null); save.mutate() }}>Save observation</Button></div>
    </div>
  )
}

export default function Observations() {
  useDocumentTitle('Observations')
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(!!params.get('patient'))
  const [editing, setEditing] = useState<Observation | null>(null)
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const obs = useQuery({ queryKey: ['observations', q], queryFn: () => listObservations({ search: q }) })
  return (
    <>
      <PageHeader title="Observation records" description="Vital signs and clinical observations for patients under your care. Edits are audited." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Record observation</Button>} />
      <SearchBar value={search} onChange={setSearch} placeholder="Patient or observation type" className="mb-6 max-w-md" label="Search observations" />
      {obs.isLoading ? <LoadingSkeleton rows={5} /> : obs.error ? <ErrorState error={obs.error} /> : !obs.data?.length ? <EmptyState icon={<HeartPulse className="h-5 w-5" />} title="No observations recorded" /> : (
        <DataTable caption="Observations" rows={obs.data} rowKey={(o) => o.id} columns={[
          { key: 'when', header: 'Observed', cell: (o) => formatDateTime(o.observed_at) },
          { key: 'patient', header: 'Patient', cell: (o) => <span className="font-medium text-forest">{o.patient_name}</span> },
          { key: 'type', header: 'Observation', cell: (o) => <div><p>{o.observation_type}: <strong>{o.value}</strong> {o.unit}</p>{o.context && <p className="text-xs text-muted">{o.context}</p>}</div> },
          { key: 'by', header: 'Recorded by', cell: (o) => <span className="flex items-center gap-1.5">{o.observer_name}{o.is_sample && <SampleBadge />}</span>, hideOnMobile: true },
          { key: 'edit', header: '', cell: (o) => o.observer_id === session?.userId ? <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(o)}>Edit</Button> : null },
        ]} />
      )}
      <Modal open={open || !!editing} onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null) } }} title={editing ? 'Edit observation' : 'Record observation'} size="lg">
        {(open || editing) && <ObservationForm initial={editing ?? undefined} onDone={() => { setOpen(false); setEditing(null) }} />}
      </Modal>
    </>
  )
}
