import { useQuery } from '@tanstack/react-query'
import { CalendarX2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, Skeleton } from '@/components/common/States'
import { cn, formatDate, formatTime, hospitalDateKey } from '@/lib/utils'
import { config } from '@/lib/config'
import { getSlots } from '@/services/directory'
import type { Slot } from '@/types/models'

/**
 * Shows only server-generated, currently-free slots (past times and booked slots are excluded by
 * public.get_available_slots). The server re-validates the chosen slot when booking.
 */
export function SlotPicker({ doctorId, value, onChange, days = 21 }: { doctorId: string; value: string | null; onChange: (slot: Slot) => void; days?: number }) {
  const q = useQuery({ queryKey: ['slots', doctorId, days], queryFn: () => getSlots(doctorId, hospitalDateKey(), days), staleTime: 15_000 })
  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>()
    for (const s of q.data ?? []) {
      const k = hospitalDateKey(s.starts_at)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return m
  }, [q.data])
  const dayKeys = [...byDay.keys()]
  const [picked, setPicked] = useState<string | null>(null)
  const day = picked && byDay.has(picked) ? picked : value ? hospitalDateKey(value) : dayKeys[0]

  if (q.isLoading) return <div className="space-y-4"><div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-16 rounded-2xl" />)}</div><Skeleton className="h-24 rounded-2xl" /></div>
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!dayKeys.length) return <EmptyState icon={<CalendarX2 className="h-5 w-5" />} title="No online appointments available" description="This doctor has no open slots in the next few weeks. Please choose another doctor or contact the hospital." />

  const groups = (byDay.get(day!) ?? []).reduce<Record<string, Slot[]>>((acc, s) => {
    const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: config.hospitalTimeZone }).format(new Date(s.starts_at)))
    const label = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
    ;(acc[label] ??= []).push(s)
    return acc
  }, {})

  return (
    <div>
      <div role="listbox" aria-label="Available dates" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {dayKeys.map((k) => {
          const active = k === day
          const date = byDay.get(k)![0].starts_at
          return (
            <button
              key={k}
              role="option"
              aria-selected={active}
              onClick={() => setPicked(k)}
              className={cn('flex w-[68px] shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 transition-all duration-200', active ? 'border-forest bg-forest text-white shadow-[var(--shadow-lift)]' : 'border-line bg-white text-forest hover:border-mint-400')}
            >
              <span className={cn('text-[11px] font-semibold uppercase', active ? 'text-mint-300' : 'text-muted')}>{formatDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined })}</span>
              <span className="font-display text-xl font-bold">{formatDate(date, { day: 'numeric', month: undefined, year: undefined })}</span>
              <span className={cn('text-[11px]', active ? 'text-white/70' : 'text-muted')}>{formatDate(date, { month: 'short', day: undefined, year: undefined })}</span>
            </button>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={day} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-4 space-y-4">
          {Object.entries(groups).map(([label, slots]) => (
            <div key={label}>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{label}</p>
              <div role="radiogroup" aria-label={`${label} times`} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {slots.map((s) => {
                  const selected = value === s.starts_at
                  return (
                    <button
                      key={s.starts_at}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(s)}
                      className={cn('h-11 rounded-xl border text-sm font-medium transition-all duration-150', selected ? 'border-forest bg-forest text-white' : 'border-line bg-white text-forest hover:border-mint-400 hover:bg-mint-50')}
                    >
                      {formatTime(s.starts_at)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </motion.div>
      </AnimatePresence>
      <p className="mt-4 text-[12.5px] text-muted">Times shown in hospital time ({config.hospitalTimeZone.replace('_', ' ')}).</p>
    </div>
  )
}
