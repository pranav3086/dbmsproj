import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  /** Hide on the stacked mobile layout. */
  hideOnMobile?: boolean
}

/**
 * Accessible table on wider screens, stacked cards on mobile (no horizontal overflow).
 * Rows with `rowHref` are keyboard-focusable and navigate on Enter.
 */
export function DataTable<T>({ columns, rows, rowKey, rowHref, onRowClick, caption, className }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  caption?: string
  className?: string
}) {
  const navigate = useNavigate()
  const activate = (row: T) => (onRowClick ? onRowClick(row) : rowHref ? navigate(rowHref(row)) : undefined)
  const interactive = !!(rowHref || onRowClick)
  return (
    <div className={cn('card overflow-hidden', className)}>
      <table className="hidden w-full text-left text-sm md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line bg-mist/70">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted', c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => activate(row) : undefined}
              onKeyDown={interactive ? (e) => e.key === 'Enter' && activate(row) : undefined}
              className={cn('transition-colors', interactive && 'cursor-pointer hover:bg-mint-50/60 focus-visible:bg-mint-50')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.className)}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => activate(row) : undefined}
              onKeyDown={interactive ? (e) => e.key === 'Enter' && activate(row) : undefined}
              className={cn('grid gap-2 p-4', interactive && 'cursor-pointer active:bg-mint-50')}
            >
              {columns.filter((c) => !c.hideOnMobile).map((c, i) => (
                <div key={c.key} className={cn('flex items-start justify-between gap-4 text-sm', i === 0 && 'font-medium')}>
                  {i > 0 && <span className="shrink-0 text-[12px] uppercase tracking-wide text-muted">{c.header}</span>}
                  <div className={cn('min-w-0', i > 0 && 'text-right')}>{c.cell(row)}</div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
