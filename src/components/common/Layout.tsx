import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn, initials } from '@/lib/utils'

export function PageHeader({ title, description, eyebrow, actions, breadcrumbs, className }: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  breadcrumbs?: { label: string; to?: string }[]
  className?: string
}) {
  return (
    <div className={cn('mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-3" />}
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        {title && <h1 className="text-2xl font-semibold sm:text-[1.9rem]">{title}</h1>}
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Breadcrumbs({ items, className }: { items: { label: string; to?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((item, i) => (
          <Fragment key={item.label + i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
            <li>
              {item.to ? (
                <Link to={item.to} className="rounded transition-colors hover:text-forest">{item.label}</Link>
              ) : (
                <span aria-current="page" className="font-medium text-ink">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="mb-5 inline-flex items-center gap-1 rounded text-sm font-medium text-muted transition-colors hover:text-forest">
      <ChevronLeft className="h-4 w-4" /> {children}
    </Link>
  )
}

export function Avatar({ name, src, size = 'md', className }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = { sm: 'h-9 w-9 text-xs rounded-xl', md: 'h-12 w-12 text-sm rounded-2xl', lg: 'h-16 w-16 text-lg rounded-2xl', xl: 'h-28 w-28 text-3xl rounded-[28px]' }
  if (src) return <img src={src} alt="" className={cn('shrink-0 object-cover', sizes[size], className)} loading="lazy" />
  return (
    <span className={cn('flex shrink-0 items-center justify-center bg-gradient-to-br from-mint-100 to-mint-200 font-display font-semibold text-forest ring-1 ring-inset ring-mint-300/60', sizes[size], className)} aria-hidden>
      {initials(name)}
    </span>
  )
}

/** Scroll-triggered fade-up. Respects reduced-motion preferences. */
export function Reveal({ children, delay = 0, className, as = 'div', y = 18 }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li'; y?: number }) {
  const reduce = useReducedMotion()
  const Comp = motion[as]
  if (reduce) return <Comp className={className}>{children}</Comp>
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  )
}

export const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={staggerParent} initial={reduce ? false : 'hidden'} whileInView="show" viewport={{ once: true, margin: '-40px' }}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={staggerChild}>{children}</motion.div>
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span> of <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-forest transition-colors hover:bg-mint-50 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n, i) => (
          <Fragment key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
            <button
              onClick={() => onChange(n)}
              aria-current={n === page ? 'page' : undefined}
              className={cn('hidden h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition-colors sm:block', n === page ? 'bg-forest text-white' : 'text-forest hover:bg-mint-50')}
            >
              {n}
            </button>
          </Fragment>
        ))}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-forest transition-colors hover:bg-mint-50 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}

/** Pill-style tab switcher with an animated active indicator. */
export function Segmented<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-[14px] border border-line bg-mist p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn('relative flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-medium transition-colors', active ? 'text-forest' : 'text-muted hover:text-forest')}
          >
            {active && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-[10px] bg-white shadow-[var(--shadow-soft)] ring-1 ring-line" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && <span className="relative rounded-full bg-mint-100 px-1.5 text-[11px] text-mint-700">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function StatCard({ label, value, icon, hint, to, tone = 'mint' }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; to?: string; tone?: 'mint' | 'forest' | 'warning' }) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {icon && <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone === 'forest' ? 'bg-forest text-mint-300' : tone === 'warning' ? 'bg-[#fbf3e4] text-warning' : 'bg-mint-100 text-mint-600')}>{icon}</span>}
      </div>
      <p className="mt-3 font-display text-[1.9rem] font-semibold leading-none text-forest">{value}</p>
      {hint && <p className="mt-2 text-[12.5px] text-muted">{hint}</p>}
    </>
  )
  return to ? <Link to={to} className="card card-hover block p-5">{body}</Link> : <div className="card p-5">{body}</div>
}

export function DescriptionList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[12.5px] font-medium uppercase tracking-wide text-muted">{i.label}</dt>
          <dd className="mt-1 break-words text-[15px] text-ink">{i.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
