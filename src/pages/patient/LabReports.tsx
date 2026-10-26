import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate } from '@/lib/utils'
import { listLabReports } from '@/services/clinical'

export default function PatientLabReports() {
  useDocumentTitle('Lab reports')
  const { session } = useAuth()
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const reports = useQuery({ queryKey: ['lab-reports', session?.userId, q], queryFn: () => listLabReports({ patientId: session!.userId, search: q }) })
  return (
    <>
      <PageHeader title="Lab reports" description="Reports appear here once the laboratory has finalised them. Discuss results with your doctor." />
      <SearchBar value={search} onChange={setSearch} placeholder="Search test or reference" className="mb-6 max-w-md" label="Search lab reports" />
      {reports.isLoading ? <LoadingSkeleton rows={4} /> : reports.error ? <ErrorState error={reports.error} onRetry={() => reports.refetch()} /> : !reports.data?.length ? (
        <EmptyState icon={<FlaskConical className="h-5 w-5" />} title={q ? 'No matching reports' : 'No reports released yet'} description="Tests that are still being processed are not shown until they are finalised." />
      ) : (
        <DataTable caption="Your lab reports" rows={reports.data} rowKey={(r) => r.id} rowHref={(r) => `/patient/lab-reports/${r.id}`} columns={[
          { key: 'test', header: 'Test', cell: (r) => <div><p className="font-medium text-forest">{r.test_name}</p><p className="text-xs text-muted">{r.reference}</p></div> },
          { key: 'collected', header: 'Collected', cell: (r) => formatDate(r.collected_at), hideOnMobile: true },
          { key: 'resulted', header: 'Result date', cell: (r) => formatDate(r.resulted_at) },
          { key: 'lab', header: 'Laboratory', cell: (r) => <div><p>{r.laboratory}</p>{r.doctor_name && <p className="text-xs text-muted">{r.doctor_name}</p>}</div>, hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex flex-wrap gap-1.5"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
