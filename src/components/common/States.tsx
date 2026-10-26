import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn, errorMessage } from '@/lib/utils'
import { Button } from './Button'

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-mist/60 px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint-100 text-mint-600">{icon ?? <Inbox className="h-5.5 w-5.5" />}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this', className }: { error?: unknown; onRetry?: () => void; title?: string; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-error/20 bg-[#fdf6f5] px-6 py-12 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-error/10 text-error"><AlertTriangle className="h-5.5 w-5.5" /></div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4', className)} aria-hidden />
}

export function LoadingSkeleton({ rows = 3, variant = 'list', className }: { rows?: number; variant?: 'list' | 'cards' | 'detail'; className?: string }) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)} role="status" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="mt-5 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <Skeleton className="mt-5 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    )
  }
  if (variant === 'detail') {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="card space-y-3 p-6">
          {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-4" />)}
        </div>
      </div>
    )
  }
  return (
    <div className={cn('card divide-y divide-line', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </span>
  )
}

/** Renders loading / error / empty / data states for a react-query result. */
export function QueryState<T>({
  query,
  children,
  empty,
  skeleton,
  isEmpty,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown }
  children: (data: T) => ReactNode
  empty?: ReactNode
  skeleton?: ReactNode
  isEmpty?: (data: T) => boolean
}) {
  if (query.isLoading) return <>{skeleton ?? <LoadingSkeleton />}</>
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data === undefined || query.data === null) return <>{empty ?? <EmptyState title="Not found" />}</>
  const data = query.data
  const emptyCheck = isEmpty ?? ((d: T) => Array.isArray(d) && d.length === 0)
  if (empty && emptyCheck(data)) return <>{empty}</>
  return <>{children(data)}</>
}
