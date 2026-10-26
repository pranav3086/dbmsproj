import { FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn, titleCase } from '@/lib/utils'

type Tone = 'neutral' | 'mint' | 'success' | 'warning' | 'error' | 'info' | 'forest'

const tones: Record<Tone, string> = {
  neutral: 'bg-[#f0f4f2] text-muted-strong ring-line',
  mint: 'bg-mint-100 text-mint-700 ring-mint-200',
  success: 'bg-[#e6f4ec] text-success ring-[#c9e7d6]',
  warning: 'bg-[#fbf3e4] text-warning ring-[#f0dfbd]',
  error: 'bg-[#fbeceb] text-error ring-[#f2d0cf]',
  info: 'bg-[#eaf1f8] text-info ring-[#d2e1ef]',
  forest: 'bg-forest text-white ring-forest',
}

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const statusTone: Record<string, Tone> = {
  requested: 'warning', confirmed: 'mint', completed: 'success', cancelled: 'neutral', no_show: 'error',
  draft: 'neutral', issued: 'success', superseded: 'info',
  ordered: 'neutral', collected: 'info', in_progress: 'warning', final: 'success', amended: 'info',
  placed: 'info', pending_review: 'warning', approved: 'mint', processing: 'info', dispatched: 'mint', delivered: 'success', rejected: 'error',
  pending: 'warning', simulated: 'info', paid: 'success', failed: 'error', refunded: 'neutral',
  new: 'warning', closed: 'neutral', queued: 'warning', sent: 'success', skipped: 'neutral',
}

const statusLabel: Record<string, string> = {
  no_show: 'No-show', pending_review: 'Pending review', in_progress: 'In progress', simulated: 'Simulated (demo)', final: 'Final',
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone[status] ?? 'neutral'} dot className={className}>
      {statusLabel[status] ?? titleCase(status)}
    </Badge>
  )
}

/** Marks synthetic demonstration content so it is never mistaken for real records. */
export function SampleBadge({ className, label = 'Sample data' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border border-dashed border-warning/50 bg-[#fdf8ee] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning', className)} title="Synthetic demonstration content — not a real record">
      <FlaskConical className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
