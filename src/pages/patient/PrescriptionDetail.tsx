import { useQuery } from '@tanstack/react-query'
import { Info, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button, ButtonLink } from '@/components/common/Button'
import { LogoMark } from '@/components/common/Logo'
import { BackLink, DescriptionList } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime } from '@/lib/utils'
import { getPrescription } from '@/services/clinical'

export default function PrescriptionDetail() {
  const { prescriptionId = '' } = useParams()
  const rx = useQuery({ queryKey: ['prescription', prescriptionId], queryFn: () => getPrescription(prescriptionId) })
  useDocumentTitle(rx.data ? `Prescription ${rx.data.reference}` : 'Prescription')
  if (rx.isLoading) return <LoadingSkeleton variant="detail" rows={6} />
  if (rx.error) return <ErrorState error={rx.error} onRetry={() => rx.refetch()} />
  const r = rx.data
  if (!r) return <EmptyState title="Prescription not found" action={<ButtonLink to="/patient/prescriptions">All prescriptions</ButtonLink>} />
  return (
    <>
      <div className="no-print flex items-center justify-between">
        <BackLink to="/patient/prescriptions">Prescriptions</BackLink>
        <Button variant="secondary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / save PDF</Button>
      </div>
      <article className="card p-6 sm:p-10">
        <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3"><LogoMark /><div><p className="font-display text-lg font-bold text-forest">A10 Hospital</p><p className="text-xs text-muted">Prescription</p></div></div>
          <div className="sm:text-right">
            <p className="font-mono font-semibold text-forest">{r.reference}</p>
            <div className="mt-1 flex gap-1.5 sm:justify-end"><StatusBadge status={r.status} />{r.is_sample && <SampleBadge />}</div>
          </div>
        </header>
        {r.status === 'superseded' && <p className="mt-6 flex gap-2 rounded-xl bg-[#eaf1f8] p-4 text-sm text-info"><Info className="mt-0.5 h-4 w-4 shrink-0" />This prescription has been replaced by an amended version. Check your prescriptions list for the current one.</p>}
        {r.supersedes_id && <p className="mt-6 rounded-xl bg-mist p-4 text-sm text-muted-strong">Amended version {r.version}. Reason: {r.amendment_reason}. <Link to={`/patient/prescriptions/${r.supersedes_id}`} className="font-medium text-mint-700 underline">View previous version</Link></p>}
        <DescriptionList className="mt-6" items={[
          { label: 'Prescribed by', value: r.doctor_name },
          { label: 'Department', value: r.department_name },
          { label: 'Issued', value: formatDateTime(r.issued_at) },
          { label: 'Consultation', value: r.appointment_reference ?? '—' },
        ]} />
        <h2 className="mt-8 text-lg font-semibold">Medications</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line">
          {r.items.map((i, idx) => (
            <div key={i.id} className={`grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr] ${idx > 0 ? 'border-t border-line' : ''}`}>
              <div><p className="font-semibold text-forest">{i.medication_name}</p>{i.instructions && <p className="mt-0.5 text-[13px] text-muted">{i.instructions}</p>}</div>
              <Cell label="Dosage" value={i.dosage} />
              <Cell label="Frequency" value={i.frequency} />
              <Cell label="Duration" value={`${i.duration}${i.quantity ? ` · Qty ${i.quantity}` : ''}`} />
            </div>
          ))}
        </div>
        {r.notes && <><h2 className="mt-8 text-lg font-semibold">Doctor’s notes</h2><p className="mt-2 whitespace-pre-line text-muted-strong">{r.notes}</p></>}
        <p className="mt-10 border-t border-line pt-5 text-[12.5px] text-muted">Take medicines only as directed by your doctor. Contact the hospital if you have questions about this prescription. {r.is_sample && 'This is a synthetic sample prescription for demonstration and is not medical advice.'}</p>
      </article>
      {r.status === 'issued' && <div className="no-print mt-6"><ButtonLink to="/patient/pharmacy" variant="soft">Order from the A10 pharmacy</ButtonLink></div>}
    </>
  )
}

function Cell({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</p><p className="text-[15px]">{value}</p></div>
}
