import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarPlus, CalendarX2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '@/app/auth'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { AppointmentCard } from '@/components/domain/Cards'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { listAppointments } from '@/services/appointments'

type Scope = 'upcoming' | 'past' | 'cancelled'

export default function PatientAppointments() {
  useDocumentTitle('My appointments')
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const scope = (params.get('tab') as Scope) ?? 'upcoming'
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const appts = useQuery({
    queryKey: ['appointments', scope, session?.userId, q],
    queryFn: () => listAppointments({ scope, patientId: session!.userId, search: q, limit: 100 }),
    placeholderData: keepPreviousData,
  })
  return (
    <>
      <PageHeader title="My appointments" description="View, cancel or reschedule your appointments." actions={<ButtonLink to="/appointments/book" icon={<CalendarPlus className="h-4 w-4" />}>Book appointment</ButtonLink>} />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Segmented label="Appointment filter" value={scope} onChange={(v) => setParams({ tab: v }, { replace: true })} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <SearchBar value={search} onChange={setSearch} placeholder="Search doctor, department or reference" className="sm:w-80" label="Search appointments" />
      </div>
      {appts.isLoading ? <LoadingSkeleton rows={4} /> : appts.error ? <ErrorState error={appts.error} onRetry={() => appts.refetch()} /> : !appts.data?.rows.length ? (
        <EmptyState icon={<CalendarX2 className="h-5 w-5" />} title={q ? 'No matching appointments' : scope === 'upcoming' ? 'No upcoming appointments' : `No ${scope} appointments`} action={scope === 'upcoming' && <ButtonLink to="/appointments/book">Book an appointment</ButtonLink>} />
      ) : (
        <div className="grid gap-3">{appts.data.rows.map((a) => <AppointmentCard key={a.id} appt={a} to={`/patient/appointments/${a.id}`} />)}</div>
      )}
    </>
  )
}
