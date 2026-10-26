import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, UserSearch } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '@/app/auth'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatCalendarDate, formatDate } from '@/lib/utils'
import { searchPatients } from '@/services/clinical'

/** Patient lookup. Results come from an authorised server-side search — never a bulk download. */
export default function PatientRecords() {
  useDocumentTitle('Patient records')
  const { pathname } = useLocation()
  const { hasRole } = useAuth()
  const isDoctor = pathname.startsWith('/doctor') && hasRole('doctor')
  const base = isDoctor ? '/doctor' : '/staff'
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 350)
  const enabled = isDoctor || q.length >= 2
  const results = useQuery({ queryKey: ['patient-search', base, q], queryFn: () => searchPatients(q), enabled })
  return (
    <>
      <PageHeader title="Patient records" description={isDoctor ? 'Patients who have booked with you. Search by name, email or phone.' : 'Search for a patient by name, email or phone (at least 2 characters).'} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Name, email or phone" className="sm:w-96" label="Search patients" />
        <p className="flex items-center gap-1.5 text-[13px] text-muted"><ShieldCheck className="h-4 w-4 text-mint-600" />Access is limited by your role and every chart view is logged.</p>
      </div>
      {!enabled ? <EmptyState icon={<UserSearch className="h-5 w-5" />} title="Search to find a patient" description="Enter at least two characters." /> :
        results.isLoading ? <LoadingSkeleton rows={4} /> : results.error ? <ErrorState error={results.error} onRetry={() => results.refetch()} /> : !results.data?.length ? (
          <EmptyState icon={<UserSearch className="h-5 w-5" />} title="No patients found" description={isDoctor ? 'Only patients with appointments under your care are listed.' : 'Check the spelling or try another identifier.'} />
        ) : (
          <DataTable caption="Patients" rows={results.data} rowKey={(p) => p.id} rowHref={(p) => `${base}/patients/${p.id}`} columns={[
            { key: 'name', header: 'Patient', cell: (p) => <div><p className="font-medium text-forest">{p.full_name || '—'}</p><p className="text-xs text-muted">{p.email}</p></div> },
            { key: 'dob', header: 'Date of birth', cell: (p) => formatCalendarDate(p.date_of_birth) },
            { key: 'phone', header: 'Phone', cell: (p) => p.phone ?? '—', hideOnMobile: true },
            { key: 'last', header: isDoctor ? 'Last visit with you' : 'Last appointment', cell: (p) => p.last_appointment_at ? formatDate(p.last_appointment_at) : '—' },
            { key: 'count', header: 'Visits', cell: (p) => p.appointment_count },
          ]} />
        )}
    </>
  )
}
