import { useQuery } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useParams } from 'react-router'
import { useAuth } from '@/app/auth'
import { StatusBadge } from '@/components/common/Badge'
import { ButtonLink } from '@/components/common/Button'
import { DescriptionList } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { getDonationReceipt } from '@/services/account'

export default function DonationConfirmation() {
  useDocumentTitle('Thank you')
  const { reference = '' } = useParams()
  const { status } = useAuth()
  const r = useQuery({ queryKey: ['receipt', reference], queryFn: () => getDonationReceipt(reference) })
  return (
    <div className="container-page max-w-2xl py-16 text-center">
      {r.isLoading ? <LoadingSkeleton variant="detail" /> : r.error ? <ErrorState error={r.error} /> : !r.data ? (
        <EmptyState title="Receipt not found" description="This reference doesn’t match a recent donation." action={<ButtonLink to="/donations">Back to donations</ButtonLink>} />
      ) : (
        <>
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-mint-100 text-mint-600"><CheckCircle2 className="h-9 w-9" /></motion.span>
          <h1 className="mt-5 text-3xl font-semibold">Thank you{r.data.donor_name ? `, ${r.data.donor_name.split(' ')[0]}` : ''}</h1>
          {r.data.status === 'simulated' ? (
            <div className="mt-5 text-left"><FormAlert tone="info"><strong>Demonstration only:</strong> this donation was recorded for demo purposes. No money was collected.</FormAlert></div>
          ) : r.data.status === 'pending' ? (
            <p className="mt-3 text-muted">Your donation is recorded and will be marked paid once the payment provider confirms it.</p>
          ) : null}
          <div className="card mt-8 p-6 text-left">
            <DescriptionList items={[
              { label: 'Reference', value: <span className="font-mono font-semibold">{r.data.reference}</span> },
              { label: 'Status', value: <StatusBadge status={r.data.status} /> },
              { label: 'Cause', value: r.data.cause },
              { label: 'Amount', value: formatMoney(r.data.amount, r.data.currency) },
              { label: 'Date', value: formatDateTime(r.data.created_at) },
              { label: 'Donor', value: r.data.is_anonymous ? 'Anonymous' : r.data.donor_name ?? '—' },
            ]} />
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/">Return home</ButtonLink>
            {status === 'signed-in' && <ButtonLink to="/patient/donations" variant="secondary">My donations</ButtonLink>}
          </div>
        </>
      )}
    </div>
  )
}
