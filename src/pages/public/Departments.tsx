import { useQuery } from '@tanstack/react-query'
import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { PageHeader, Stagger, StaggerItem } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DepartmentCard } from '@/components/domain/Cards'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { listDepartments } from '@/services/directory'

export default function Departments() {
  useDocumentTitle('Specialities')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 250)
  const departments = useQuery({ queryKey: ['departments', q], queryFn: () => listDepartments(q) })
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader eyebrow="Specialities & departments" title="Find the right specialist team" description="Each department lists its services and the doctors available for appointments." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Specialities' }]} />
      <SearchBar value={search} onChange={setSearch} placeholder="Search departments" className="mb-8 max-w-md" label="Search departments" />
      {departments.isLoading ? <LoadingSkeleton variant="cards" rows={6} /> : departments.error ? <ErrorState error={departments.error} onRetry={() => departments.refetch()} /> : !departments.data?.length ? (
        <EmptyState icon={<SearchX className="h-5 w-5" />} title="No departments found" description="Try another search term." action={<Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>} />
      ) : (
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {departments.data.map((d) => <StaggerItem key={d.id}><DepartmentCard department={d} /></StaggerItem>)}
        </Stagger>
      )}
      <p className="mt-8 text-[13px] text-muted">Department names and descriptions are editable sample content managed by administrators.</p>
    </div>
  )
}
