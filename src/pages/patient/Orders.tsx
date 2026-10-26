import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatMoney } from '@/lib/utils'
import { listOrders } from '@/services/pharmacy'

export default function PatientOrders() {
  useDocumentTitle('My orders')
  const { session } = useAuth()
  const orders = useQuery({ queryKey: ['orders', session?.userId], queryFn: () => listOrders({ patientId: session!.userId }) })
  return (
    <>
      <PageHeader title="My orders" description="Track your medication orders." actions={<ButtonLink to="/patient/pharmacy">Order medication</ButtonLink>} />
      {orders.isLoading ? <LoadingSkeleton rows={4} /> : orders.error ? <ErrorState error={orders.error} onRetry={() => orders.refetch()} /> : !orders.data?.length ? (
        <EmptyState icon={<Package className="h-5 w-5" />} title="No orders yet" action={<ButtonLink to="/patient/pharmacy">Browse the pharmacy</ButtonLink>} />
      ) : (
        <DataTable caption="Your orders" rows={orders.data} rowKey={(o) => o.id} rowHref={(o) => `/patient/orders/${o.id}`} columns={[
          { key: 'ref', header: 'Order', cell: (o) => <span className="font-mono font-medium text-forest">{o.reference}</span> },
          { key: 'date', header: 'Placed', cell: (o) => formatDate(o.created_at) },
          { key: 'items', header: 'Items', cell: (o) => o.item_count },
          { key: 'total', header: 'Total', cell: (o) => <span className="tabular-nums">{formatMoney(o.total)}</span> },
          { key: 'status', header: 'Status', cell: (o) => <span className="flex flex-wrap gap-1.5"><StatusBadge status={o.status} />{o.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
