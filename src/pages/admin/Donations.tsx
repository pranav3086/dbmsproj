import { useQuery } from '@tanstack/react-query'
import { HandHeart } from 'lucide-react'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { PageHeader, StatCard } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { listDonations } from '@/services/account'

export default function AdminDonations() {
  useDocumentTitle('Donations')
  const d = useQuery({ queryKey: ['donations', 'admin'], queryFn: () => listDonations({ limit: 500 }) })
  const rows = d.data ?? []
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount), 0)
  return (
    <>
      <PageHeader title="Donations" description="Records of donations. Only provider-verified donations are marked paid." />
      <FormAlert tone="info">“Simulated” donations were recorded in demonstration mode and represent no real money.</FormAlert>
      <div className="my-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Donations" value={rows.length} icon={<HandHeart className="h-4.5 w-4.5" />} />
        <StatCard label="Simulated total" value={formatMoney(sum('simulated'))} />
        <StatCard label="Verified paid total" value={formatMoney(sum('paid'))} tone="forest" />
      </div>
      {d.isLoading ? <LoadingSkeleton rows={5} /> : d.error ? <ErrorState error={d.error} /> : !rows.length ? <EmptyState title="No donations yet" /> : (
        <DataTable caption="Donations" rows={rows} rowKey={(r) => r.id} columns={[
          { key: 'ref', header: 'Reference', cell: (r) => <span className="font-mono text-forest">{r.reference}</span> },
          { key: 'donor', header: 'Donor', cell: (r) => <div><p>{r.is_anonymous ? 'Anonymous' : r.donor_name ?? '—'}</p><p className="text-xs text-muted">{r.donor_email}</p></div> },
          { key: 'cause', header: 'Cause', cell: (r) => r.cause_title, hideOnMobile: true },
          { key: 'amount', header: 'Amount', cell: (r) => formatMoney(r.amount, r.currency) },
          { key: 'date', header: 'Date', cell: (r) => formatDateTime(r.created_at), hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (r) => <span className="flex gap-1"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</span> },
        ]} />
      )}
    </>
  )
}
