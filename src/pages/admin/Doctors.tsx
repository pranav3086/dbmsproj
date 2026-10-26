import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, FileDown, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Dialog'
import { DescriptionList, PageHeader, Pagination, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { Checkbox, FormField, Input, SearchBar, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { db } from '@/lib/backend'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDate, formatMoney } from '@/lib/utils'
import { credentialUrl, listApplications, reviewApplication } from '@/services/account'
import { listDepartments, listDoctors } from '@/services/directory'
import type { Doctor, DoctorApplication } from '@/types/models'

function ReviewModal({ app, onClose }: { app: DoctorApplication; onClose: () => void }) {
  const qc = useQueryClient()
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const [dept, setDept] = useState(app.department_id ?? '')
  const [notes, setNotes] = useState('')
  const [checked, setChecked] = useState(false)
  const review = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => reviewApplication(app.id, decision, notes, dept || null),
    onSuccess: (_, d) => { toast.success(d === 'approved' ? 'Doctor approved and added to the directory' : 'Application rejected'); qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['doctors'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); onClose() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const openDoc = useMutation({ mutationFn: () => credentialUrl(app.credential_path!), onSuccess: (u) => window.open(u, '_blank', 'noopener'), onError: (e) => toast.error(errorMessage(e)) })
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} size="lg" title={`Review: ${app.full_name}`} description={`Submitted ${formatDate(app.created_at)}`}
      footer={app.status === 'pending' ? <>
        <Button variant="danger-outline" disabled={notes.trim().length < 5} loading={review.isPending && review.variables === 'rejected'} onClick={() => review.mutate('rejected')}>Reject</Button>
        <Button disabled={!checked || !dept} loading={review.isPending && review.variables === 'approved'} onClick={() => review.mutate('approved')} icon={<ShieldCheck className="h-4 w-4" />}>Approve doctor</Button>
      </> : <Button onClick={onClose}>Close</Button>}>
      <DescriptionList items={[
        { label: 'Email', value: app.email },
        { label: 'Phone', value: app.phone },
        { label: 'Licence / registration no.', value: <span className="font-mono">{app.licence_number}</span> },
        { label: 'Speciality', value: app.speciality },
        { label: 'Qualifications', value: app.qualifications.join(', ') },
        { label: 'Experience', value: app.years_experience !== null ? `${app.years_experience} years` : '—' },
        { label: 'Status', value: <StatusBadge status={app.status} /> },
        { label: 'Supporting document', value: app.credential_path ? <Button size="sm" variant="secondary" icon={<FileDown className="h-3.5 w-3.5" />} loading={openDoc.isPending} onClick={() => openDoc.mutate()}>Open privately</Button> : 'Not uploaded' },
      ]} />
      {app.status === 'pending' ? (
        <div className="mt-6 space-y-4 border-t border-line pt-6">
          <FormField label="Department" required>
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">Select…</option>
              {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Reviewer notes" hint="Required when rejecting. Shown to the applicant."><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></FormField>
          <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} label="I have verified the registration/licence number with the issuing authority and reviewed the supporting credentials." />
        </div>
      ) : app.review_notes && <p className="mt-6 text-sm text-muted-strong">Reviewer notes: {app.review_notes}</p>}
    </Modal>
  )
}

function DoctorEditor({ doctor, onClose }: { doctor: Partial<Doctor>; onClose: () => void }) {
  const qc = useQueryClient()
  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const [d, setD] = useState({
    full_name: doctor.full_name ?? '', department_id: doctor.department_id ?? '', speciality: doctor.speciality ?? '', qualifications: (doctor.qualifications ?? []).join(', '),
    years_experience: doctor.years_experience?.toString() ?? '', consultation_fee: doctor.consultation_fee?.toString() ?? '', qualifications_verified: !!doctor.qualifications_verified,
    licence_verified: !!doctor.licence_verified, is_active: doctor.is_active ?? true,
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      if (d.full_name.trim().length < 2 || !d.department_id || !d.speciality.trim()) throw new Error('Name, department and speciality are required.')
      const values = {
        full_name: d.full_name.trim(), department_id: d.department_id, speciality: d.speciality.trim(),
        qualifications: d.qualifications.split(',').map((x) => x.trim()).filter(Boolean),
        years_experience: d.years_experience ? Number(d.years_experience) : null, consultation_fee: d.consultation_fee ? Number(d.consultation_fee) : null,
        qualifications_verified: d.qualifications_verified, licence_verified: d.licence_verified, is_active: d.is_active,
      }
      if (doctor.id) return db().update('doctors', values, [{ col: 'id', op: 'eq', value: doctor.id }])
      const slug = `${values.full_name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`
      return db().insert('doctors', { ...values, slug })
    },
    onSuccess: () => { toast.success('Directory updated'); qc.invalidateQueries({ queryKey: ['doctors'] }); qc.invalidateQueries({ queryKey: ['doctor'] }); onClose() },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} size="lg" title={doctor.id ? `Edit ${doctor.full_name}` : 'Add directory entry'} description="Changes are audited. Verification flags must reflect checks you have actually performed."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => { setError(null); save.mutate() }}>Save</Button></>}>
      {error && <div className="mb-4"><FormAlert>{error}</FormAlert></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" required><Input value={d.full_name} onChange={(e) => setD({ ...d, full_name: e.target.value })} /></FormField>
        <FormField label="Department" required><Select value={d.department_id} onChange={(e) => setD({ ...d, department_id: e.target.value })}><option value="">Select…</option>{departments.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></FormField>
        <FormField label="Speciality" required><Input value={d.speciality} onChange={(e) => setD({ ...d, speciality: e.target.value })} /></FormField>
        <FormField label="Qualifications" hint="Comma-separated"><Input value={d.qualifications} onChange={(e) => setD({ ...d, qualifications: e.target.value })} /></FormField>
        <FormField label="Years of experience"><Input inputMode="numeric" value={d.years_experience} onChange={(e) => setD({ ...d, years_experience: e.target.value.replace(/\D/g, '') })} /></FormField>
        <FormField label="Consultation fee (₹)"><Input inputMode="decimal" value={d.consultation_fee} onChange={(e) => setD({ ...d, consultation_fee: e.target.value })} /></FormField>
      </div>
      <div className="mt-5 grid gap-3">
        <Checkbox checked={d.qualifications_verified} onChange={(e) => setD({ ...d, qualifications_verified: e.target.checked })} label="Qualifications verified" />
        <Checkbox checked={d.licence_verified} onChange={(e) => setD({ ...d, licence_verified: e.target.checked })} label="Licence verified" />
        <Checkbox checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} label="Listed in the public directory" />
      </div>
    </Modal>
  )
}

export default function AdminDoctors() {
  useDocumentTitle('Doctors & verification')
  const [tab, setTab] = useState<'pending' | 'reviewed' | 'directory'>('pending')
  const apps = useQuery({ queryKey: ['applications', tab], queryFn: () => listApplications(tab === 'pending' ? 'pending' : undefined), enabled: tab !== 'directory' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim())
  const doctors = useQuery({ queryKey: ['doctors', 'admin', q, page], queryFn: () => listDoctors({ search: q, page, pageSize: 20 }), enabled: tab === 'directory' })
  const [reviewing, setReviewing] = useState<DoctorApplication | null>(null)
  const [editing, setEditing] = useState<Partial<Doctor> | null>(null)
  const rows = tab === 'reviewed' ? apps.data?.filter((a) => a.status !== 'pending') : apps.data
  return (
    <>
      <PageHeader title="Doctors & verification" description="Approve professional registrations and maintain the public directory." actions={tab === 'directory' && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>Add directory entry</Button>} />
      <Segmented className="mb-6" label="Section" value={tab} onChange={setTab} options={[{ value: 'pending', label: 'Pending verification', count: tab === 'pending' ? apps.data?.length : undefined }, { value: 'reviewed', label: 'Reviewed' }, { value: 'directory', label: 'Directory' }]} />
      {tab !== 'directory' ? (
        apps.isLoading ? <LoadingSkeleton rows={4} /> : apps.error ? <ErrorState error={apps.error} /> : !rows?.length ? <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title={tab === 'pending' ? 'No applications awaiting review' : 'No reviewed applications'} /> : (
          <DataTable caption="Doctor applications" rows={rows} rowKey={(a) => a.id} onRowClick={setReviewing} columns={[
            { key: 'name', header: 'Applicant', cell: (a) => <div><p className="font-medium text-forest">{a.full_name}</p><p className="text-xs text-muted">{a.email}</p></div> },
            { key: 'spec', header: 'Speciality', cell: (a) => <div><p>{a.speciality}</p><p className="text-xs text-muted">{a.department_name ?? 'No department'}</p></div> },
            { key: 'lic', header: 'Licence', cell: (a) => <span className="font-mono text-[13px]">{a.licence_number}</span>, hideOnMobile: true },
            { key: 'doc', header: 'Document', cell: (a) => a.credential_path ? <Badge tone="mint">Uploaded</Badge> : <Badge>None</Badge>, hideOnMobile: true },
            { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
            { key: 'act', header: '', cell: () => <Button size="sm" variant="secondary">Review</Button> },
          ]} />
        )
      ) : (
        <>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search doctors" className="mb-5 max-w-md" label="Search doctors" />
          {doctors.isLoading ? <LoadingSkeleton rows={6} /> : !doctors.data?.rows.length ? <EmptyState title="No doctors" /> : (
            <DataTable caption="Directory" rows={doctors.data.rows} rowKey={(d) => d.id} columns={[
              { key: 'name', header: 'Doctor', cell: (d) => <div><p className="font-medium text-forest">{d.full_name}</p><p className="text-xs text-muted">{d.speciality}</p></div> },
              { key: 'dept', header: 'Department', cell: (d) => d.department_name },
              { key: 'fee', header: 'Fee', cell: (d) => d.consultation_fee !== null ? formatMoney(d.consultation_fee) : '—', hideOnMobile: true },
              { key: 'flags', header: 'Verification', cell: (d) => <span className="flex flex-wrap gap-1">{d.licence_verified ? <Badge tone="success">Licence</Badge> : <Badge>Unverified</Badge>}{d.user_id && <Badge tone="mint">Has account</Badge>}{d.is_sample && <SampleBadge />}</span> },
              { key: 'act', header: '', cell: (d) => <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(d)}>Edit</Button> },
            ]} />
          )}
          {doctors.data && <Pagination page={page} pageSize={20} total={doctors.data.count ?? 0} onChange={setPage} />}
        </>
      )}
      {reviewing && <ReviewModal app={reviewing} onClose={() => setReviewing(null)} />}
      {editing && <DoctorEditor doctor={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
