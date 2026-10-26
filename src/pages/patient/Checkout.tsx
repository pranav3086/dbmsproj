import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning, ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { z } from 'zod'
import { useAuth } from '@/app/auth'
import { useCart } from '@/app/cart'
import { Button, ButtonLink } from '@/components/common/Button'
import { BackLink, PageHeader } from '@/components/common/Layout'
import { EmptyState } from '@/components/common/States'
import { QuantityStepper } from '@/components/domain/Cart'
import { FormField, Input, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useSettings } from '@/hooks/useSettings'
import { errorMessage, formatDate, formatMoney } from '@/lib/utils'
import { checkoutSchema } from '@/schemas'
import { getMyProfile } from '@/services/account'
import { listPrescriptions } from '@/services/clinical'
import { placeOrder } from '@/services/pharmacy'

type Values = z.infer<typeof checkoutSchema>

export default function Checkout() {
  useDocumentTitle('Checkout')
  const cart = useCart()
  const { session } = useAuth()
  const { data: s } = useSettings()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const profile = useQuery({ queryKey: ['profile', session?.userId], queryFn: () => getMyProfile(session!.userId) })
  const prescriptions = useQuery({ queryKey: ['prescriptions', 'issued', session?.userId], queryFn: () => listPrescriptions({ patientId: session!.userId, statuses: ['issued'] }), enabled: cart.needsPrescription })
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<Values>({ resolver: zodResolver(checkoutSchema), defaultValues: { deliveryAddress: '', contactPhone: '', notes: '', prescriptionId: '' } })
  useEffect(() => {
    if (profile.data) {
      if (profile.data.address) setValue('deliveryAddress', profile.data.address)
      if (profile.data.phone) setValue('contactPhone', profile.data.phone)
    }
  }, [profile.data, setValue])

  const fee = cart.subtotal >= Number(s?.pharmacy_free_delivery_over ?? 999) ? 0 : Number(s?.pharmacy_delivery_fee ?? 49)
  const place = useMutation({
    mutationFn: (v: Values) => {
      if (cart.needsPrescription && !v.prescriptionId) throw new Error('Select the prescription that covers your prescription-only items.')
      return placeOrder({ items: cart.lines.map((l) => ({ medicine_id: l.medicine.id, quantity: l.quantity })), deliveryAddress: v.deliveryAddress, contactPhone: v.contactPhone, notes: v.notes, prescriptionId: v.prescriptionId || null })
    },
    onSuccess: (order) => {
      cart.clear()
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['medicines'] })
      toast.success(`Order ${order.reference} placed`)
      navigate(`/patient/orders/${order.id}?placed=1`, { replace: true })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (!cart.lines.length) return (
    <>
      <PageHeader title="Checkout" />
      <EmptyState icon={<ShoppingBag className="h-5 w-5" />} title="Your cart is empty" action={<ButtonLink to="/patient/pharmacy">Browse the pharmacy</ButtonLink>} />
    </>
  )

  return (
    <>
      <BackLink to="/patient/pharmacy">Continue shopping</BackLink>
      <PageHeader title="Checkout" description="Review your order and delivery details." />
      <form onSubmit={handleSubmit((v) => { setError(null); place.mutate(v) })} noValidate className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {error && <FormAlert>{error}</FormAlert>}
          <section className="card p-6">
            <h2 className="text-lg font-semibold">Items</h2>
            <ul className="mt-4 divide-y divide-line">
              {cart.lines.map((l) => (
                <li key={l.medicine.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="font-medium text-forest">{l.medicine.name} {l.medicine.strength}</p><p className="text-[13px] text-muted">{formatMoney(l.medicine.price)} each{l.medicine.requires_prescription && ' · Prescription required'}</p></div>
                  <div className="flex items-center gap-4"><QuantityStepper value={l.quantity} onChange={(n) => cart.setQuantity(l.medicine.id, n)} label={l.medicine.name} /><span className="w-20 text-right font-semibold tabular-nums">{formatMoney(l.medicine.price * l.quantity)}</span></div>
                </li>
              ))}
            </ul>
          </section>
          {cart.needsPrescription && (
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><FileWarning className="h-5 w-5 text-warning" />Prescription</h2>
              <p className="mt-1 text-sm text-muted">Select a current prescription from your account. A pharmacist reviews every prescription-only order before it is dispensed.</p>
              {prescriptions.data?.length ? (
                <FormField label="Prescription" className="mt-4" error={errors.prescriptionId?.message} required>
                  <Select {...register('prescriptionId')}>
                    <option value="">Select a prescription…</option>
                    {prescriptions.data.map((r) => <option key={r.id} value={r.id}>{r.reference} — {r.medications} ({formatDate(r.issued_at)})</option>)}
                  </Select>
                </FormField>
              ) : <FormAlert tone="info">You don’t have a current prescription on your account. Remove prescription-only items, or book an appointment with a doctor.</FormAlert>}
            </section>
          )}
          <section className="card space-y-5 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Truck className="h-5 w-5 text-mint-600" />Delivery</h2>
            <FormField label="Delivery address" error={errors.deliveryAddress?.message} required><Textarea rows={3} autoComplete="street-address" {...register('deliveryAddress')} /></FormField>
            <FormField label="Contact phone" error={errors.contactPhone?.message} required><Input type="tel" autoComplete="tel" className="sm:max-w-xs" {...register('contactPhone')} /></FormField>
            <FormField label="Notes for the pharmacy" optional error={errors.notes?.message}><Textarea rows={2} {...register('notes')} /></FormField>
          </section>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <dl className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatMoney(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="tabular-nums">{fee === 0 ? 'Free' : formatMoney(fee)}</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-forest"><dt>Estimated total</dt><dd className="tabular-nums">{formatMoney(cart.subtotal + fee)}</dd></div>
            </dl>
            <div className="mt-5 rounded-xl bg-mist p-3 text-[13px] text-muted-strong"><strong>Payment:</strong> Demonstration pay-on-delivery order. No card details are collected and no online payment is taken.</div>
            <Button type="submit" size="lg" className="mt-5 w-full" loading={place.isPending} disabled={cart.needsPrescription && !prescriptions.data?.length}>Place order</Button>
            <p className="mt-3 text-[12px] text-muted">Prices, stock and totals are recalculated securely when the order is placed.</p>
          </div>
        </aside>
      </form>
    </>
  )
}
