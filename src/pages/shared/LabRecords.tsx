import { useQuery } from '@tanstack/react-query'
import { FlaskConical, Plus } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar, Select } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate } from '@/lib/utils'
import { listLabReports } from '@/services/clinical'
import type { LabStatus } from '@/types/models'

export default function LabRecords() {
  useDocumentTitle('Lab records')
  const base = useLocation().pathname.startsWith('/doctor') ? '/doctor' : '/staff'
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const reports = useQuery({ queryKey: ['lab-reports', 'manage', base, status, q], queryFn: () => listLabReports({ statuses: status ? [status as LabStatus] : undefined, search: q }) })
  return (
    <>
      <PageHeader title="Lab records" description={base === '/doctor' ? 'Laboratory reports for patients under your care.' : 'Laboratory reports you are authorised to manage.'} actions={<ButtonLink to={`${base}/lab-records/new`} icon={<Plus className="h-4 w-4" />}>New lab record</ButtonLink>} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={search} onChange={setSearch} placeholder="Test, patient or reference" className="sm:w-80" label="Search lab records" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          {['ordered', 'collected', 'in_progress', 'final', 'amended', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </Select>
      </div>
      {reports.isLoading ? <LoadingSkeleton rows={5} /> : reports.error ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : !reports.data?.length ? <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="No lab records" /> : (
        <DataTable caption="Lab records" rows={reports.data} rowKey={(r) => r.id} rowHref={(r) => `${base}/lab-records/${r.id}`} columns={[
          { key: 'test', header: 'Test', cell: (r) => <div><p className="font-medium text-forest">{r.test_name}</p><p className="text-xs text-muted">{r.reference}</p></div> },
          { key: 'patient', header: 'Patient', cell: (r) => r.patient_name ?? '—' },
          { key: 'collected', header: 'Collected', cell: (r) => formatDate(r.collected_at), hideOnMobile: true },
          { key: 'updated', header: 'Updated', cell: (r) => formatDate(r.updated_at) },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex gap-1.5"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
