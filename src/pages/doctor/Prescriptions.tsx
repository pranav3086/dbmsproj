import { useQuery } from '@tanstack/react-query'
import { Plus, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate } from '@/lib/utils'
import { listPrescriptions } from '@/services/clinical'
import type { PrescriptionStatus } from '@/types/models'

export default function DoctorPrescriptions() {
  useDocumentTitle('Prescriptions')
  const { access } = useAuth()
  const [filter, setFilter] = useState<'all' | PrescriptionStatus>('all')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const rx = useQuery({ queryKey: ['prescriptions', 'doctor', access?.doctor_id, filter, q], queryFn: () => listPrescriptions({ doctorId: access!.doctor_id!, statuses: filter === 'all' ? undefined : [filter], search: q }) })
  return (
    <>
      <PageHeader title="Prescriptions" description="Prescriptions you have written. Issued prescriptions can only be changed through an audited amendment." actions={<ButtonLink to="/doctor/prescriptions/new" icon={<Plus className="h-4 w-4" />}>New prescription</ButtonLink>} />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented label="Status" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'draft', label: 'Drafts' }, { value: 'issued', label: 'Issued' }, { value: 'superseded', label: 'Superseded' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <SearchBar value={search} onChange={setSearch} placeholder="Patient, medication or reference" className="md:w-80" label="Search prescriptions" />
      </div>
      {rx.isLoading ? <LoadingSkeleton rows={4} /> : rx.error ? <ErrorState error={rx.error} onRetry={() => rx.refetch()} /> : !rx.data?.length ? <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No prescriptions" /> : (
        <DataTable caption="Prescriptions" rows={rx.data} rowKey={(r) => r.id} rowHref={(r) => `/doctor/prescriptions/${r.id}`} columns={[
          { key: 'patient', header: 'Patient', cell: (r) => <div><p className="font-medium text-forest">{r.patient_name ?? '—'}</p><p className="text-xs text-muted">{r.reference}{r.version > 1 ? ` · v${r.version}` : ''}</p></div> },
          { key: 'meds', header: 'Medications', cell: (r) => <span className="line-clamp-1">{r.medications}</span> },
          { key: 'date', header: 'Date', cell: (r) => formatDate(r.issued_at ?? r.created_at) },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex gap-1.5"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
