import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Drawer } from '@/components/common/Dialog'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDateTime } from '@/lib/utils'
import { listContactMessages, updateContactStatus } from '@/services/account'

type Msg = Awaited<ReturnType<typeof listContactMessages>>[number]

export default function AdminMessages() {
  useDocumentTitle('Messages')
  const qc = useQueryClient()
  const msgs = useQuery({ queryKey: ['contact-messages'], queryFn: listContactMessages })
  const [open, setOpen] = useState<Msg | null>(null)
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateContactStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['contact-messages'] }); setOpen(null) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <>
      <PageHeader title="Contact messages" description="Enquiries submitted through the website contact form." />
      {msgs.isLoading ? <LoadingSkeleton rows={5} /> : msgs.error ? <ErrorState error={msgs.error} /> : !msgs.data?.length ? <EmptyState icon={<Inbox className="h-5 w-5" />} title="No messages" /> : (
        <DataTable caption="Messages" rows={msgs.data} rowKey={(m) => m.id} onRowClick={setOpen} columns={[
          { key: 'from', header: 'From', cell: (m) => <div><p className="font-medium text-forest">{m.name}</p><p className="text-xs text-muted">{m.email}</p></div> },
          { key: 'subject', header: 'Subject', cell: (m) => <span className="line-clamp-1">{m.subject}</span> },
          { key: 'date', header: 'Received', cell: (m) => formatDateTime(m.created_at), hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (m) => <StatusBadge status={m.status} /> },
        ]} />
      )}
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.subject ?? 'Message'} footer={open && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => set.mutate({ id: open.id, status: 'in_progress' })}>Mark in progress</Button>
          <Button size="sm" onClick={() => set.mutate({ id: open.id, status: 'closed' })}>Close</Button>
          <a href={`mailto:${open.email}?subject=${encodeURIComponent('Re: ' + open.subject)}`} className="ml-auto self-center text-sm font-medium text-mint-700 underline">Reply by email</a>
        </div>
      )}>
        {open && <div className="space-y-3 p-5"><p className="text-sm text-muted">{open.name} · {open.email} · {formatDateTime(open.created_at)}</p><StatusBadge status={open.status} /><p className="whitespace-pre-line text-[15px] text-ink">{open.message}</p></div>}
      </Drawer>
    </>
  )
}
