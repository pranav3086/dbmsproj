import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Inbox, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Badge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/Dialog'
import { PageHeader, Segmented } from '@/components/common/Layout'
import { EmptyState, LoadingSkeleton } from '@/components/common/States'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { isDemo } from '@/lib/config'
import { relativeTime } from '@/lib/utils'

/** DEMO-ONLY developer tool: shows messages that would have been emailed. Nothing is delivered. */
export default function DevMailbox() {
  useDocumentTitle('Demo mailbox')
  const [tab, setTab] = useState<'auth' | 'outbox'>('auth')
  const [resetOpen, setResetOpen] = useState(false)
  const mail = useQuery({ queryKey: ['demo-mailbox'], queryFn: async () => (await import('@/lib/backend/dev-tools')).listDemoMailbox(), enabled: isDemo, refetchInterval: 5000 })

  if (!isDemo) return <div className="container-page py-16"><EmptyState title="Not available" description="The demo mailbox is turned off in this build. In production, emails are delivered by the configured provider." /></div>

  const rows = tab === 'auth' ? mail.data?.auth ?? [] : mail.data?.outbox ?? []
  return (
    <div className="container-page max-w-4xl py-12 sm:py-16">
      <PageHeader eyebrow="Developer tool · development build" title="Demo mailbox" description="Account emails (verification, password reset) and queued notification emails are recorded here instead of being sent." actions={<Button variant="danger-outline" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setResetOpen(true)}>Reset demo data</Button>} />
      <FormAlert tone="info">Nothing on this page was delivered to a real inbox. Messages are stored in MySQL (<code>dev_mailbox</code> and <code>email_outbox</code> tables); a production deployment would hand them to an email provider.</FormAlert>
      <Segmented className="my-6" label="Mailbox" value={tab} onChange={setTab} options={[{ value: 'auth', label: 'Account emails', count: mail.data?.auth.length }, { value: 'outbox', label: 'Notification outbox', count: mail.data?.outbox.length }]} />
      {mail.isLoading ? <LoadingSkeleton rows={4} /> : rows.length === 0 ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="No messages yet" /> : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={String(m.id)} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-forest">{m.subject}</p>
                <span className="text-xs text-muted">{relativeTime(m.created_at)}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-muted">To: {m.to_email} {'status' in m && <StatusBadge status={m.status} className="ml-2" />}</p>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-strong">{m.body}</p>
              {'link' in m && m.link && (
                <a href={m.link} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-medium text-white">Open link <ExternalLink className="h-3.5 w-3.5" /></a>
              )}
              {'status' in m && <Badge className="mt-3" tone="neutral">Not delivered — demo</Badge>}
            </li>
          ))}
        </ul>
      )}
      <ConfirmationDialog open={resetOpen} onOpenChange={setResetOpen} tone="danger" title="Reset demo data?" description="This rebuilds the MySQL database from the SQL files: every account, booking and order is replaced with the original sample data." confirmLabel="Reset and reload"
        onConfirm={async () => { const m = await import('@/lib/backend/dev-tools'); await m.resetDemoDatabase(); window.location.href = '/' }} />
    </div>
  )
}
