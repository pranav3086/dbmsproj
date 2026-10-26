import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { PageHeader, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatMoney } from '@/lib/utils'
import { listOrders } from '@/services/pharmacy'
import type { OrderStatus } from '@/types/models'

const GROUPS: Record<string, OrderStatus[] | undefined> = {
  open: ['placed', 'pending_review', 'approved', 'processing', 'dispatched'],
  review: ['pending_review'],
  closed: ['delivered', 'cancelled', 'rejected'],
  all: undefined,
}

export default function OrdersManager() {
  useDocumentTitle('Medication orders')
  const base = useLocation().pathname.startsWith('/admin') ? '/admin' : '/staff'
  const [group, setGroup] = useState<keyof typeof GROUPS>('open')
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim())
  const orders = useQuery({ queryKey: ['orders', 'manage', group, q], queryFn: () => listOrders({ statuses: GROUPS[group], search: q }) })
  return (
    <>
      <PageHeader title="Medication orders" description="Review prescriptions and move orders through fulfilment. Every change notifies the patient." />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Segmented label="Order group" value={group} onChange={setGroup} options={[{ value: 'open', label: 'Open' }, { value: 'review', label: 'Needs Rx review' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
        <SearchBar value={search} onChange={setSearch} placeholder="Reference or patient" className="md:w-72" label="Search orders" />
      </div>
      {orders.isLoading ? <LoadingSkeleton rows={5} /> : orders.error ? <ErrorState error={orders.error} /> : !orders.data?.length ? <EmptyState icon={<Package className="h-5 w-5" />} title="No orders here" /> : (
        <DataTable caption="Orders" rows={orders.data} rowKey={(o) => o.id} rowHref={(o) => `${base}/orders/${o.id}`} columns={[
          { key: 'ref', header: 'Order', cell: (o) => <div><p className="font-mono font-medium text-forest">{o.reference}</p><p className="text-xs text-muted">{formatDate(o.created_at)}</p></div> },
          { key: 'patient', header: 'Patient', cell: (o) => o.patient_name ?? '—' },
          { key: 'rx', header: 'Prescription', cell: (o) => o.prescription_reference ?? '—', hideOnMobile: true },
          { key: 'total', header: 'Total', cell: (o) => formatMoney(o.total) },
          { key: 'status', header: 'Status', cell: (o) => <span className="flex gap-1.5"><StatusBadge status={o.status} />{o.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
