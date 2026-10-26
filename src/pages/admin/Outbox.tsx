import { useQuery } from '@tanstack/react-query'
import { Mail } from 'lucide-react'
import { StatusBadge } from '@/components/common/Badge'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime } from '@/lib/utils'
import { listOutbox } from '@/services/account'

export default function AdminOutbox() {
  useDocumentTitle('Email outbox')
  const out = useQuery({ queryKey: ['outbox'], queryFn: listOutbox })
  return (
    <>
      <PageHeader title="Email outbox" description="Notification emails queued by the platform." />
      <FormAlert tone="info">Emails are queued here in the same transaction as the change that caused them. A separate delivery worker would send them once an email provider is configured; until then they remain <strong>queued</strong> in the MySQL <code>email_outbox</code> table and nothing is delivered.</FormAlert>
      <div className="mt-6">
        {out.isLoading ? <LoadingSkeleton rows={5} /> : out.error ? <ErrorState error={out.error} /> : !out.data?.length ? <EmptyState icon={<Mail className="h-5 w-5" />} title="Outbox is empty" /> : (
          <DataTable caption="Outbox" rows={out.data} rowKey={(m) => m.id} columns={[
            { key: 'to', header: 'To', cell: (m) => <span className="text-forest">{m.to_email}</span> },
            { key: 'subject', header: 'Subject', cell: (m) => <div><p className="font-medium">{m.subject}</p><p className="line-clamp-1 text-xs text-muted">{m.body}</p></div> },
            { key: 'date', header: 'Queued', cell: (m) => formatDateTime(m.created_at), hideOnMobile: true },
            { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
          ]} />
        )}
      </div>
    </>
  )
}
