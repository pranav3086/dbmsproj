import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileCheck2, PackageSearch, Pill, ShieldCheck, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCart } from '@/app/cart'
import { Badge, SampleBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { PageHeader, Pagination } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { CartButton, CartDrawer } from '@/components/domain/Cart'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/hooks/useSettings'
import { cn, formatMoney } from '@/lib/utils'
import { listMedicineCategories, listMedicines } from '@/services/pharmacy'
import type { Medicine } from '@/types/models'

const PAGE = 12

export function MedicineCard({ m }: { m: Medicine }) {
  const cart = useCart()
  const inPortal = useLocation().pathname.startsWith('/patient')
  const out = m.stock <= 0
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-100 text-mint-600"><Pill className="h-5 w-5" /></span>
        <div className="flex flex-wrap justify-end gap-1">
          {m.requires_prescription ? <Badge tone="warning">Rx required</Badge> : <Badge tone="mint">Over the counter</Badge>}
        </div>
      </div>
      <h3 className="mt-4 font-semibold"><Link to={`/pharmacy/${m.slug}${inPortal ? '?from=portal' : ''}`} className="rounded hover:text-mint-700">{m.name} {m.strength}</Link></h3>
      <p className="text-[13px] text-muted">{m.generic_name ?? m.category} · {m.form} · {m.pack_size}</p>
      <p className="mt-2 line-clamp-2 flex-1 text-[13.5px] text-muted-strong">{m.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <p className="font-display text-lg font-semibold text-forest">{formatMoney(m.price)}</p>
        <p className={cn('text-[12.5px] font-medium', out ? 'text-error' : m.stock < 20 ? 'text-warning' : 'text-success')}>{out ? 'Out of stock' : m.stock < 20 ? `Only ${m.stock} left` : 'In stock'}</p>
      </div>
      <Button className="mt-4 w-full" variant={out ? 'secondary' : 'primary'} size="sm" disabled={out} onClick={() => { cart.add(m); toast.success(`${m.name} added to cart`, { action: { label: 'View cart', onClick: () => cart.setOpen(true) } }) }}>
        {out ? 'Unavailable' : 'Add to cart'}
      </Button>
    </article>
  )
}

export default function Pharmacy() {
  useDocumentTitle('Pharmacy')
  const { data: s } = useSettings()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 250)
  const category = params.get('category') ?? ''
  const page = Number(params.get('page') ?? 1)
  const categories = useQuery({ queryKey: ['med-categories'], queryFn: listMedicineCategories })
  const meds = useQuery({ queryKey: ['medicines', q, category, page], queryFn: () => listMedicines({ search: q, category, limit: PAGE, offset: (page - 1) * PAGE }), placeholderData: keepPreviousData })
  const setCat = (c: string) => setParams(c ? { category: c } : {}, { replace: true })

  return (
    <div className={cn(!useLocation().pathname.startsWith('/patient') && 'container-page py-12 sm:py-16')}>
      <PageHeader eyebrow="Pharmacy" title="Order medication" description="Browse our catalogue and order for home delivery. Prescription-only medicines are dispensed after pharmacist verification." breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Pharmacy' }]} actions={<CartButton />} />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          [Truck, 'Home delivery', `Free over ${formatMoney(s?.pharmacy_free_delivery_over ?? 999)}; otherwise ${formatMoney(s?.pharmacy_delivery_fee ?? 49)}.`],
          [FileCheck2, 'Prescription checks', 'Rx-only items require a current prescription and pharmacist approval.'],
          [ShieldCheck, 'Demo checkout', 'Orders use a demonstration pay-on-delivery flow. No online payment is taken.'],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Truck
          return <div key={title as string} className="flex gap-3 rounded-2xl border border-line bg-mist p-4"><I className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" /><div><p className="text-sm font-semibold text-forest">{title as string}</p><p className="text-[13px] text-muted">{text as string}</p></div></div>
        })}
      </div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <SearchBar value={search} onChange={setSearch} placeholder="Search medicines" className="lg:w-80" label="Search medicines" />
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
          {['', ...(categories.data ?? [])].map((c) => (
            <button key={c || 'all'} onClick={() => setCat(c)} aria-pressed={category === c} className={cn('h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors', category === c ? 'border-forest bg-forest text-white' : 'border-line bg-white text-muted-strong hover:border-mint-400')}>
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>
      {meds.isLoading ? <LoadingSkeleton variant="cards" rows={6} /> : meds.error ? <ErrorState error={meds.error} onRetry={() => meds.refetch()} /> : !meds.data?.rows.length ? (
        <EmptyState icon={<PackageSearch className="h-5 w-5" />} title="No medicines found" description="Try a different search or category." action={<Button variant="secondary" onClick={() => { setSearch(''); setCat('') }}>Clear filters</Button>} />
      ) : (
        <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity', meds.isFetching && 'opacity-70')}>
          {meds.data.rows.map((m) => <MedicineCard key={m.id} m={m} />)}
        </div>
      )}
      {meds.data && <Pagination page={page} pageSize={PAGE} total={meds.data.count ?? 0} onChange={(p) => setParams({ ...(category ? { category } : {}), page: String(p) })} />}
      <div className="mt-8 flex items-center gap-2"><SampleBadge /><p className="text-[13px] text-muted">Catalogue, prices and stock levels are sample data.</p></div>
      <CartDrawer />
    </div>
  )
}
