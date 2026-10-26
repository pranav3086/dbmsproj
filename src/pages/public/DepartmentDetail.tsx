import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarPlus, Check } from 'lucide-react'
import { useParams } from 'react-router'
import { SampleBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { DeptIcon } from '@/components/common/DeptIcon'
import { PageHeader, Reveal, Stagger, StaggerItem } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DoctorCard } from '@/components/domain/Cards'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getDepartment, getNextSlots, listDoctors } from '@/services/directory'

export default function DepartmentDetail() {
  const { departmentId = '' } = useParams()
  const dept = useQuery({ queryKey: ['department', departmentId], queryFn: () => getDepartment(departmentId) })
  const doctors = useQuery({ queryKey: ['doctors', { department: departmentId }], queryFn: () => listDoctors({ department: departmentId, pageSize: 6 }), enabled: !!dept.data })
  const ids = doctors.data?.rows.map((d) => d.id) ?? []
  const slots = useQuery({ queryKey: ['next-slots', ids], queryFn: () => getNextSlots(ids), enabled: ids.length > 0 })
  useDocumentTitle(dept.data?.name ?? 'Department')

  if (dept.isLoading) return <div className="container-page py-16"><LoadingSkeleton variant="detail" rows={6} /></div>
  if (dept.error) return <div className="container-page py-16"><ErrorState error={dept.error} onRetry={() => dept.refetch()} /></div>
  const d = dept.data
  if (!d) return <div className="container-page py-16"><EmptyState title="Department not found" action={<ButtonLink to="/departments">All departments</ButtonLink>} /></div>

  return (
    <>
      <section className="relative overflow-hidden border-b border-line bg-mist/70">
        <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <PageHeader title="" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Specialities', to: '/departments' }, { label: d.name }]} className="mb-2" />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-mint-300"><DeptIcon name={d.icon} className="h-7 w-7" /></span>
            <h1 className="display-lg mt-5">{d.name}</h1>
            <p className="mt-2 text-lg text-mint-700">{d.summary}</p>
            <p className="lead mt-4 max-w-2xl">{d.description}</p>
            {d.is_sample && <SampleBadge className="mt-5" label="Sample department content" />}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={`/appointments/book?department=${d.slug}`} size="lg" icon={<CalendarPlus className="h-4.5 w-4.5" />}>Book in {d.name}</ButtonLink>
              <ButtonLink to={`/doctors?department=${d.slug}`} size="lg" variant="secondary" iconRight={<ArrowRight className="h-4 w-4" />}>All {d.doctor_count} doctors</ButtonLink>
            </div>
          </div>
          {d.image_url && <Reveal><img src={d.image_url} alt="" className="h-[340px] w-full rounded-[28px] object-cover shadow-[var(--shadow-lift)]" /></Reveal>}
        </div>
      </section>
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <Reveal className="card h-fit p-6">
            <h2 className="text-lg font-semibold">Services offered</h2>
            <ul className="mt-4 space-y-3">
              {d.services.map((s) => <li key={s} className="flex gap-3 text-[15px] text-muted-strong"><Check className="mt-0.5 h-4.5 w-4.5 shrink-0 text-mint-600" />{s}</li>)}
            </ul>
          </Reveal>
          <div>
            <h2 className="mb-5 text-2xl font-semibold">Doctors in {d.name}</h2>
            {doctors.isLoading ? <LoadingSkeleton variant="cards" rows={2} className="lg:grid-cols-2" /> : !doctors.data?.rows.length ? <EmptyState title="No doctors listed yet" /> : (
              <Stagger className="grid gap-5 md:grid-cols-2">
                {doctors.data.rows.map((doc) => <StaggerItem key={doc.id}><DoctorCard doctor={doc} nextSlot={slots.data ? slots.data[doc.id] ?? null : undefined} /></StaggerItem>)}
              </Stagger>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
