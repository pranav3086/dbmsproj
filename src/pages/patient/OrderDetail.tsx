import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, PackageX } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/Dialog'
import { BackLink, DescriptionList, PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn, errorMessage, formatDateTime, formatMoney, titleCase } from '@/lib/utils'
import { getOrder, ORDER_NEXT, updateOrderStatus } from '@/services/pharmacy'
import type { OrderStatus } from '@/types/models'

const HAPPY_PATH: OrderStatus[] = ['placed', 'pending_review', 'approved', 'processing', 'dispatched', 'delivered']

/** Order detail. Patients can cancel early orders; pharmacy staff and admins move orders through the workflow. */
export default function OrderDetail() {
  const { orderId = '' } = useParams()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const { session, can, hasRole } = useAuth()
  const qc = useQueryClient()
  const staffView = !pathname.startsWith('/patient')
  const base = pathname.startsWith('/admin') ? '/admin/orders' : pathname.startsWith('/staff') ? '/staff/orders' : '/patient/orders'
  const isPharmacy = can('pharmacy') || hasRole('admin')
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId) })
  const [pending, setPending] = useState<OrderStatus | null>(null)
  useDocumentTitle(order.data ? `Order ${order.data.reference}` : 'Order')

  const update = useMutation({
    mutationFn: ({ status, note }: { status: OrderStatus; note: string }) => updateOrderStatus(orderId, status, note),
    onSuccess: () => { toast.success('Order updated'); qc.invalidateQueries({ queryKey: ['order', orderId] }); qc.invalidateQueries({ queryKey: ['orders'] }) },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (order.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (order.error) return <ErrorState error={order.error} onRetry={() => order.refetch()} />
  const o = order.data
  if (!o) return <EmptyState title="Order not found" action={<ButtonLink to={base}>Back to orders</ButtonLink>} />

  const isOwner = o.patient_id === session?.userId
  const patientCanCancel = isOwner && ['placed', 'pending_review', 'approved'].includes(o.status)
  const staffNext = staffView && isPharmacy ? ORDER_NEXT[o.status] : []
  const path = HAPPY_PATH.filter((s) => s !== 'pending_review' || o.prescription_id || o.status === 'pending_review').filter((s) => s !== 'approved' || o.prescription_id)
  const reached = new Set(o.events.map((e) => e.to_status))
  const ended = o.status === 'cancelled' || o.status === 'rejected'

  return (
    <>
      <BackLink to={base}>Orders</BackLink>
      {params.get('placed') && <div className="mb-6"><FormAlert tone="success">Thank you — your order has been placed. {o.status === 'pending_review' ? 'A pharmacist will review your prescription before it is processed.' : 'We’ll update you as it progresses.'}</FormAlert></div>}
      <PageHeader title={`Order ${o.reference}`} description={`Placed ${formatDateTime(o.created_at)}${staffView && o.patient_name ? ` · ${o.patient_name}` : ''}`} actions={
        <>
          {patientCanCancel && !staffView && <Button variant="danger-outline" icon={<PackageX className="h-4 w-4" />} onClick={() => setPending('cancelled')}>Cancel order</Button>}
          {staffNext.map((s) => (
            <Button key={s} variant={s === 'cancelled' || s === 'rejected' ? 'danger-outline' : 'primary'} onClick={() => setPending(s)}>{s === 'approved' ? 'Approve prescription' : `Mark ${titleCase(s).toLowerCase()}`}</Button>
          ))}
        </>
      } />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="mb-5 flex flex-wrap gap-2"><StatusBadge status={o.status} />{o.is_sample && <SampleBadge />}</div>
            {!ended ? (
              <ol className="flex flex-wrap gap-y-4" aria-label="Order progress">
                {path.map((s, i) => {
                  const done = reached.has(s) || HAPPY_PATH.indexOf(o.status) > HAPPY_PATH.indexOf(s)
                  return (
                    <li key={s} className="flex min-w-[96px] flex-1 items-center gap-2">
                      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs', done ? 'bg-mint-500 text-white' : 'bg-mint-50 text-muted ring-1 ring-line')}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                      <span className={cn('text-[13px]', done ? 'font-medium text-forest' : 'text-muted')}>{titleCase(s)}</span>
                      {i < path.length - 1 && <span className={cn('mx-1 hidden h-px flex-1 sm:block', done ? 'bg-mint-400' : 'bg-line')} />}
                    </li>
                  )
                })}
              </ol>
            ) : <p className="text-sm text-muted-strong">This order was {o.status}.{o.review_note && <> Note: <em>{o.review_note}</em></>}</p>}
          </section>
          <section className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Order items</caption>
              <thead className="border-b border-line bg-mist text-[12px] uppercase tracking-wide text-muted"><tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Qty</th><th className="px-5 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-line">
                {o.items.map((i) => <tr key={i.id}><td className="px-5 py-3"><p className="font-medium text-forest">{i.name}</p><p className="text-xs text-muted">{formatMoney(i.unit_price)} each{i.requires_prescription && ' · Rx'}</p></td><td className="px-5 py-3">{i.quantity}</td><td className="px-5 py-3 text-right tabular-nums">{formatMoney(i.line_total)}</td></tr>)}
              </tbody>
              <tfoot className="border-t border-line text-[15px]">
                <tr><td colSpan={2} className="px-5 pt-3 text-muted">Subtotal</td><td className="px-5 pt-3 text-right tabular-nums">{formatMoney(o.subtotal)}</td></tr>
                <tr><td colSpan={2} className="px-5 py-1 text-muted">Delivery</td><td className="px-5 py-1 text-right tabular-nums">{o.delivery_fee ? formatMoney(o.delivery_fee) : 'Free'}</td></tr>
                <tr className="font-semibold text-forest"><td colSpan={2} className="px-5 pb-4 pt-1">Total</td><td className="px-5 pb-4 pt-1 text-right tabular-nums">{formatMoney(o.total)}</td></tr>
              </tfoot>
            </table>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card p-6">
            <DescriptionList className="sm:grid-cols-1" items={[
              { label: 'Delivery address', value: o.delivery_address },
              { label: 'Contact phone', value: o.contact_phone },
              { label: 'Payment', value: 'Pay on delivery (demonstration — no online payment)' },
              { label: 'Prescription', value: o.prescription_reference ? (staffView ? o.prescription_reference : <Link className="text-mint-700 underline" to={`/patient/prescriptions/${o.prescription_id}`}>{o.prescription_reference}</Link>) : 'Not required' },
              ...(o.notes ? [{ label: 'Notes', value: o.notes }] : []),
            ]} />
          </section>
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold">Status history</h2>
            <ol className="space-y-3">
              {o.events.map((e) => <li key={e.id} className="text-sm"><p className="font-medium text-forest">{titleCase(e.to_status)}</p><p className="text-xs text-muted">{formatDateTime(e.created_at)}</p>{e.note && <p className="text-[13px] text-muted-strong">{e.note}</p>}</li>)}
            </ol>
          </section>
        </aside>
      </div>
      <ConfirmationDialog open={!!pending} onOpenChange={(v) => !v && setPending(null)} tone={pending === 'cancelled' || pending === 'rejected' ? 'danger' : 'primary'}
        title={pending === 'cancelled' ? 'Cancel this order?' : pending === 'rejected' ? 'Reject this order?' : `Update order to “${titleCase(pending ?? '')}”?`}
        description={pending === 'approved' ? 'Confirm you have verified the linked prescription is valid for the prescription-only items.' : pending === 'cancelled' ? 'Reserved stock will be released.' : 'The patient will be notified of this update.'}
        noteLabel={pending === 'rejected' ? 'Reason for rejection' : 'Note'} noteRequired={pending === 'rejected'} confirmLabel="Confirm"
        onConfirm={(note) => update.mutateAsync({ status: pending!, note })} />
    </>
  )
}
