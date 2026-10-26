import { useQuery } from '@tanstack/react-query'
import { HandHeart } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDate, formatMoney } from '@/lib/utils'
import { listDonations } from '@/services/account'

export default function PatientDonations() {
  useDocumentTitle('My donations')
  const { session } = useAuth()
  const d = useQuery({ queryKey: ['donations', session?.userId], queryFn: () => listDonations({ donorId: session!.userId }) })
  return (
    <>
      <PageHeader title="My donations" description="Donations made while signed in to your account." actions={<ButtonLink to="/donations" icon={<HandHeart className="h-4 w-4" />}>Make a donation</ButtonLink>} />
      {d.isLoading ? <LoadingSkeleton rows={3} /> : d.error ? <ErrorState error={d.error} /> : !d.data?.length ? <EmptyState icon={<HandHeart className="h-5 w-5" />} title="No donations yet" /> : (
        <DataTable caption="Your donations" rows={d.data} rowKey={(r) => r.id} rowHref={(r) => `/donations/confirmation/${r.reference}`} columns={[
          { key: 'ref', header: 'Reference', cell: (r) => <span className="font-mono text-forest">{r.reference}</span> },
          { key: 'cause', header: 'Cause', cell: (r) => r.cause_title },
          { key: 'date', header: 'Date', cell: (r) => formatDate(r.created_at) },
          { key: 'amount', header: 'Amount', cell: (r) => formatMoney(r.amount, r.currency) },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex flex-wrap gap-1.5"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
      <p className="mt-6 text-[13px] text-muted">“Simulated” donations were recorded in demonstration mode — no money was collected.</p>
    </>
  )
}
