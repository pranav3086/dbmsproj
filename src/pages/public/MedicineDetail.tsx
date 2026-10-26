import { useQuery } from '@tanstack/react-query'
import { FileWarning, Pill } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCart } from '@/app/cart'
import { Badge, SampleBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { DescriptionList, PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { CartButton, CartDrawer, QuantityStepper } from '@/components/domain/Cart'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatMoney } from '@/lib/utils'
import { getMedicine } from '@/services/pharmacy'

export default function MedicineDetail() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const back = params.get('from') === 'portal' ? '/patient/pharmacy' : '/pharmacy'
  const cart = useCart()
  const [qty, setQty] = useState(1)
  const med = useQuery({ queryKey: ['medicine', slug], queryFn: () => getMedicine(slug) })
  useDocumentTitle(med.data?.name ?? 'Medicine')
  if (med.isLoading) return <div className="container-page py-16"><LoadingSkeleton variant="detail" /></div>
  if (med.error) return <div className="container-page py-16"><ErrorState error={med.error} /></div>
  const m = med.data
  if (!m) return <div className="container-page py-16"><EmptyState title="Medicine not found" action={<ButtonLink to={back}>Back to pharmacy</ButtonLink>} /></div>
  const out = m.stock <= 0
  return (
    <div className="container-page max-w-5xl py-12 sm:py-16">
      <PageHeader title="" breadcrumbs={[{ label: 'Pharmacy', to: back }, { label: m.name }]} actions={<CartButton />} className="mb-4" />
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <div className="flex aspect-square items-center justify-center rounded-[28px] bg-gradient-to-br from-mint-100 to-mint-50"><Pill className="h-24 w-24 text-mint-500" /></div>
        <div>
          <div className="flex flex-wrap gap-2">{m.requires_prescription ? <Badge tone="warning">Prescription required</Badge> : <Badge tone="mint">Over the counter</Badge>}{m.is_sample && <SampleBadge />}</div>
          <h1 className="mt-3 text-3xl font-semibold">{m.name} {m.strength}</h1>
          <p className="mt-1 text-muted">{m.generic_name}</p>
          <p className="mt-5 font-display text-3xl font-semibold text-forest">{formatMoney(m.price)}</p>
          <p className="mt-4 leading-relaxed text-muted-strong">{m.description}</p>
          <DescriptionList className="mt-6" items={[{ label: 'Category', value: m.category }, { label: 'Form', value: m.form }, { label: 'Pack size', value: m.pack_size }, { label: 'Availability', value: out ? 'Out of stock' : `${m.stock} in stock` }]} />
          {m.requires_prescription && <p className="mt-6 flex gap-2 rounded-xl bg-[#fbf3e4] p-4 text-sm text-[#7a5413]"><FileWarning className="mt-0.5 h-4 w-4 shrink-0" />Dispensed only against a current prescription from your account, after review by a pharmacist.</p>}
          <div className="mt-6 flex items-center gap-3">
            <QuantityStepper value={qty} onChange={setQty} max={Math.min(20, Math.max(1, m.stock))} label={m.name} />
            <Button size="lg" disabled={out} onClick={() => { cart.add(m, qty); toast.success('Added to cart', { action: { label: 'View cart', onClick: () => cart.setOpen(true) } }) }}>Add to cart</Button>
          </div>
          <p className="mt-6 text-[12.5px] text-muted">Information shown is general product information, not medical advice. Always follow your doctor’s or pharmacist’s instructions.</p>
        </div>
      </div>
      <CartDrawer />
    </div>
  )
}
