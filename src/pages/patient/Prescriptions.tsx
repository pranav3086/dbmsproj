import { useQuery } from '@tanstack/react-query'
import { ScrollText } from 'lucide-react'
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
import { listPrescriptions } from '@/services/clinical'

export default function PatientPrescriptions() {
  useDocumentTitle('Prescriptions')
  const { session } = useAuth()
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const rx = useQuery({ queryKey: ['prescriptions', session?.userId, q], queryFn: () => listPrescriptions({ patientId: session!.userId, search: q }) })
  return (
    <>
      <PageHeader title="Prescriptions" description="Prescriptions issued to you by A10 doctors. Only your prescribing doctor can change them." />
      <SearchBar value={search} onChange={setSearch} placeholder="Search medication, doctor or reference" className="mb-6 max-w-md" label="Search prescriptions" />
      {rx.isLoading ? <LoadingSkeleton rows={4} /> : rx.error ? <ErrorState error={rx.error} onRetry={() => rx.refetch()} /> : !rx.data?.length ? (
        <EmptyState icon={<ScrollText className="h-5 w-5" />} title={q ? 'No matching prescriptions' : 'No prescriptions yet'} description="Prescriptions appear here once your doctor issues them." />
      ) : (
        <DataTable caption="Your prescriptions" rows={rx.data} rowKey={(r) => r.id} rowHref={(r) => `/patient/prescriptions/${r.id}`} columns={[
          { key: 'med', header: 'Medication', cell: (r) => <div><p className="font-medium text-forest">{r.medications}</p><p className="text-xs text-muted">{r.reference}{r.version > 1 ? ` · v${r.version}` : ''}</p></div> },
          { key: 'doc', header: 'Prescribed by', cell: (r) => <div><p>{r.doctor_name}</p><p className="text-xs text-muted">{r.department_name}</p></div> },
          { key: 'date', header: 'Date', cell: (r) => formatDate(r.issued_at ?? r.created_at) },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex flex-wrap gap-1.5"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
