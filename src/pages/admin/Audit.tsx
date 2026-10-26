import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { BookOpenCheck } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/common/Badge'
import { PageHeader, Pagination } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { SearchBar, Select } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime, titleCase } from '@/lib/utils'
import { listAuditLogs } from '@/services/account'

const ENTITIES = ['profiles', 'user_roles', 'staff_permissions', 'doctor_applications', 'doctors', 'doctor_availability', 'departments', 'appointments', 'consultations', 'prescriptions', 'prescription_items', 'lab_reports', 'lab_results', 'observation_records', 'medicines', 'medication_orders']

export default function AdminAudit() {
  useDocumentTitle('Audit log')
  const [entity, setEntity] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim())
  const logs = useQuery({ queryKey: ['audit', entity, q, page], queryFn: () => listAuditLogs({ entity, search: q, limit: 50, offset: (page - 1) * 50 }), placeholderData: keepPreviousData })
  return (
    <>
      <PageHeader title="Audit log" description="Who changed or viewed sensitive records, and when. Clinical values are retained for compliance review but summarised here." />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Actor email, action or record id" className="sm:w-80" label="Search audit log" />
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} className="sm:w-60" aria-label="Filter by record type">
          <option value="">All record types</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
        </Select>
      </div>
      {logs.isLoading ? <LoadingSkeleton rows={8} /> : logs.error ? <ErrorState error={logs.error} /> : !logs.data?.rows.length ? <EmptyState icon={<BookOpenCheck className="h-5 w-5" />} title="No audit events" /> : (
        <DataTable caption="Audit events" rows={logs.data.rows} rowKey={(l) => String(l.id)} columns={[
          { key: 'when', header: 'When', cell: (l) => <span className="whitespace-nowrap">{formatDateTime(l.created_at)}</span> },
          { key: 'actor', header: 'Actor', cell: (l) => <div><p>{l.actor_name || (l.actor_email ? '' : 'System')}</p><p className="text-xs text-muted">{l.actor_email}</p></div> },
          { key: 'action', header: 'Action', cell: (l) => <Badge tone={l.action === 'delete' ? 'error' : l.action === 'view_patient_chart' ? 'info' : 'mint'}>{l.action.replace(/_/g, ' ')}</Badge> },
          { key: 'entity', header: 'Record', cell: (l) => <div><p>{titleCase(l.entity)}</p><p className="font-mono text-[11px] text-muted">{l.entity_id?.slice(0, 8)}</p></div> },
          { key: 'changed', header: 'Details', cell: (l) => <span className="line-clamp-2 text-[12.5px] text-muted">{Array.isArray(l.summary?.changed) ? `Changed: ${(l.summary.changed as string[]).join(', ')}` : l.summary?.scope ? `Scope: ${String(l.summary.scope)}` : '—'}</span>, hideOnMobile: true },
        ]} />
      )}
      {logs.data && <Pagination page={page} pageSize={50} total={logs.data.count ?? 0} onChange={setPage} />}
    </>
  )
}
