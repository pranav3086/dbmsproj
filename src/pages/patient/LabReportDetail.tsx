import { useMutation, useQuery } from '@tanstack/react-query'
import { FileDown, Info, Printer } from 'lucide-react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { BackLink, DescriptionList } from '@/components/common/Layout'
import { LogoMark } from '@/components/common/Logo'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDateTime } from '@/lib/utils'
import { getLabReport, labDocumentUrl } from '@/services/clinical'
import type { LabReport, LabResult } from '@/types/models'

export function LabReportView({ r }: { r: LabReport & { results: LabResult[] } }) {
  const open = useMutation({
    mutationFn: () => labDocumentUrl(r.document_path!),
    onSuccess: (url) => window.open(url, '_blank', 'noopener'),
    onError: (e) => toast.error(errorMessage(e, 'This document is not available right now.')),
  })
  return (
    <article className="card p-6 sm:p-10">
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3"><LogoMark /><div><p className="font-display text-lg font-bold text-forest">{r.laboratory}</p><p className="text-xs text-muted">Laboratory report</p></div></div>
        <div className="sm:text-right">
          <p className="font-mono font-semibold text-forest">{r.reference}</p>
          <div className="mt-1 flex gap-1.5 sm:justify-end"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</div>
        </div>
      </header>
      <h1 className="mt-6 text-2xl font-semibold">{r.test_name}</h1>
      <DescriptionList className="mt-5" items={[
        { label: 'Collected', value: formatDateTime(r.collected_at) },
        { label: 'Result date', value: formatDateTime(r.resulted_at) },
        { label: 'Requesting doctor', value: r.doctor_name ?? '—' },
        { label: 'Department', value: r.department_name ?? '—' },
      ]} />
      <h2 className="mt-8 text-lg font-semibold">Results</h2>
      {r.results.length ? (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-mist text-[12px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5">Test</th><th className="px-4 py-2.5">Result</th><th className="px-4 py-2.5">Unit</th><th className="px-4 py-2.5">Lab reference range</th></tr></thead>
            <tbody className="divide-y divide-line">
              {r.results.map((x) => <tr key={x.id}><td className="px-4 py-3 font-medium text-forest">{x.analyte}</td><td className="px-4 py-3 tabular-nums">{x.value}</td><td className="px-4 py-3 text-muted">{x.unit ?? '—'}</td><td className="px-4 py-3 text-muted">{x.reference_range ?? 'Not provided'}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-2 text-sm text-muted">Structured results are not available for this report{r.document_path ? ' — see the attached document.' : '.'}</p>}
      {r.summary && <><h2 className="mt-8 text-lg font-semibold">Report notes</h2><p className="mt-2 whitespace-pre-line text-muted-strong">{r.summary}</p></>}
      <div className="no-print mt-8 flex flex-wrap gap-2">
        {r.document_path ? (
          <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} loading={open.isPending} onClick={() => open.mutate()}>View report document</Button>
        ) : <p className="text-sm text-muted">No document is attached to this report.</p>}
      </div>
      <p className="mt-8 flex gap-2 border-t border-line pt-5 text-[12.5px] text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />Results are shown as reported by the laboratory without interpretation. Please discuss them with your doctor.</p>
    </article>
  )
}

export default function LabReportDetail() {
  const { reportId = '' } = useParams()
  const report = useQuery({ queryKey: ['lab-report', reportId], queryFn: () => getLabReport(reportId) })
  useDocumentTitle(report.data?.test_name ?? 'Lab report')
  if (report.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (report.error) return <ErrorState error={report.error} onRetry={() => report.refetch()} />
  if (!report.data) return <EmptyState title="Report not available" description="It may still be in progress, or it isn’t linked to your account." action={<ButtonLink to="/patient/lab-reports">All reports</ButtonLink>} />
  return (
    <>
      <div className="no-print flex items-center justify-between">
        <BackLink to="/patient/lab-reports">Lab reports</BackLink>
        <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
      </div>
      <LabReportView r={report.data} />
    </>
  )
}
