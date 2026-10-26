import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** The A10 mark: an open ring (continuity of care) around a soft cross, with a mint "pulse" dot. */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-9 w-9 shrink-0', className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill={inverted ? '#ffffff' : '#163D30'} />
      <path d="M20 8.5a11.5 11.5 0 1 0 11.5 11.5" fill="none" stroke="#79C9A5" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M20 14.5v11M14.5 20h11" stroke={inverted ? '#163D30' : '#ffffff'} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="30" cy="10.5" r="2.6" fill="#79C9A5" />
    </svg>
  )
}

export function Logo({ className, inverted = false, to = '/', compact = false }: { className?: string; inverted?: boolean; to?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="A10 Hospital — home">
      <LogoMark inverted={inverted} className="transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:rotate-[8deg]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={cn('font-display text-[19px] font-bold tracking-[-0.03em]', inverted ? 'text-white' : 'text-forest')}>
            A10<span className="font-semibold text-mint-500"> Hospital</span>
          </span>
          <span className={cn('mt-1 hidden text-[10.5px] font-medium tracking-[0.08em] sm:block', inverted ? 'text-white/60' : 'text-muted')}>
            EXCEPTIONAL CARE
          </span>
        </span>
      )}
    </Link>
  )
}
