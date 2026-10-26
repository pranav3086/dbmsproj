import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, SearchX, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/common/Button'
import { PageHeader, Pagination } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DoctorCard } from '@/components/domain/Cards'
import { Checkbox, SearchBar, Select } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'
import { getNextSlots, listDepartments, listDoctors } from '@/services/directory'

const PAGE_SIZE = 12

export default function Doctors() {
  useDocumentTitle('Find a doctor')
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const debounced = useDebounce(search.trim(), 300)
  const department = params.get('department') ?? ''
  const minExperience = Number(params.get('exp') ?? 0)
  const availableOnly = params.get('available') === '1'
  const sort = (params.get('sort') as 'name' | 'experience' | 'fee') ?? 'name'
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const view = params.get('view') === 'list' ? 'list' : 'grid'
  const [filtersOpen, setFiltersOpen] = useState(false)

  const update = (patch: Record<string, string | null>, resetPage = true) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k) }
      if (resetPage) next.delete('page')
      return next
    }, { replace: true })

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced) update({ q: debounced || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const departments = useQuery({ queryKey: ['departments', ''], queryFn: () => listDepartments() })
  const doctors = useQuery({
    queryKey: ['doctors', { debounced, department, minExperience, availableOnly, sort, page }],
    queryFn: () => listDoctors({ search: debounced, department, minExperience, availableOnly, sort, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const ids = doctors.data?.rows.map((d) => d.id) ?? []
  const slots = useQuery({ queryKey: ['next-slots', ids], queryFn: () => getNextSlots(ids), enabled: ids.length > 0 })
  const filtersActive = !!(debounced || department || minExperience || availableOnly)
  const clear = () => { setSearch(''); setParams({}, { replace: true }) }

  const filters = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <label className="text-sm font-medium text-ink">Speciality / department
        <Select className="mt-1.5" value={department} onChange={(e) => update({ department: e.target.value || null })}>
          <option value="">All departments</option>
          {departments.data?.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}
        </Select>
      </label>
      <label className="text-sm font-medium text-ink">Experience
        <Select className="mt-1.5" value={String(minExperience)} onChange={(e) => update({ exp: e.target.value === '0' ? null : e.target.value })}>
          <option value="0">Any experience</option>
          <option value="5">5+ years</option>
          <option value="10">10+ years</option>
          <option value="15">15+ years</option>
        </Select>
      </label>
      <label className="text-sm font-medium text-ink">Sort by
        <Select className="mt-1.5" value={sort} onChange={(e) => update({ sort: e.target.value === 'name' ? null : e.target.value })}>
          <option value="name">Name (A–Z)</option>
          <option value="experience">Most experience</option>
          <option value="fee">Consultation fee (low to high)</option>
        </Select>
      </label>
      <div className="flex h-11 items-center">
        <Checkbox label="Accepting online bookings" checked={availableOnly} onChange={(e) => update({ available: e.target.checked ? '1' : null })} />
      </div>
    </div>
  )

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader eyebrow="Find a doctor" title="Our doctors" description="Search by name or speciality, then view a profile or book directly." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Doctors' }]} />
      <div className="card mb-8 p-4 sm:p-5">
        <div className="flex gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search doctors by name or speciality" className="flex-1" label="Search doctors" />
          <Button variant="secondary" className="lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} icon={<SlidersHorizontal className="h-4 w-4" />}>Filters</Button>
        </div>
        <div className={cn('mt-4 border-t border-line pt-4', !filtersOpen && 'hidden lg:block')}>{filters}</div>
      </div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-muted" aria-live="polite">
          {doctors.data ? <><span className="font-semibold text-ink">{doctors.data.count}</span> {doctors.data.count === 1 ? 'doctor' : 'doctors'} found</> : 'Searching…'}
          {filtersActive && <button onClick={clear} className="ml-3 font-medium text-mint-700 hover:underline">Clear filters</button>}
        </p>
        <div className="flex rounded-xl border border-line bg-white p-1" role="group" aria-label="Layout">
          {(['grid', 'list'] as const).map((v) => (
            <button key={v} onClick={() => update({ view: v === 'grid' ? null : v }, false)} aria-pressed={view === v} aria-label={`${v} view`} className={cn('flex h-8 w-8 items-center justify-center rounded-lg transition-colors', view === v ? 'bg-mint-100 text-forest' : 'text-muted hover:text-forest')}>
              {v === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
      {doctors.isLoading ? <LoadingSkeleton variant="cards" rows={6} /> : doctors.error ? <ErrorState error={doctors.error} onRetry={() => doctors.refetch()} /> : doctors.data!.rows.length === 0 ? (
        <EmptyState icon={<SearchX className="h-5 w-5" />} title="No doctors match your search" description="Try a different name or speciality, or clear the filters." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
      ) : (
        <div className={cn('grid gap-5 transition-opacity', doctors.isFetching && 'opacity-70', view === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1')}>
          {doctors.data!.rows.map((d) => <DoctorCard key={d.id} doctor={d} layout={view} nextSlot={slots.data ? slots.data[d.id] ?? null : undefined} />)}
        </div>
      )}
      {doctors.data && <Pagination page={page} pageSize={PAGE_SIZE} total={doctors.data.count ?? 0} onChange={(p) => { update({ page: String(p) }, false); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
    </div>
  )
}
