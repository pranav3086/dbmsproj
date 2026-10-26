import { useQuery } from '@tanstack/react-query'
import { Popover } from 'radix-ui'
import { useState } from 'react'
import { SearchBar } from '@/components/forms/Field'
import { Avatar } from '@/components/common/Layout'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCalendarDate } from '@/lib/utils'
import { searchPatients } from '@/services/clinical'
import type { PatientSearchRow } from '@/types/models'

/** Server-side patient search restricted to patients the current user may access. */
export function PatientPicker({ value, onChange, minChars = 0 }: { value: PatientSearchRow | null; onChange: (p: PatientSearchRow) => void; minChars?: number }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const q = useDebounce(search.trim(), 300)
  const results = useQuery({ queryKey: ['patient-search', 'picker', q], queryFn: () => searchPatients(q, 10), enabled: open && q.length >= minChars })
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-11 w-full items-center gap-3 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-left text-[15px] hover:border-mint-300 focus-visible:shadow-[var(--shadow-ring)] focus-visible:outline-none">
        {value ? <><Avatar name={value.full_name} size="sm" className="h-7 w-7 rounded-lg text-[10px]" /><span className="truncate">{value.full_name} <span className="text-muted">· {value.email}</span></span></> : <span className="text-muted">Select a patient…</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[min(440px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-3 shadow-[var(--shadow-lift)]">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, email or phone" label="Search patients" />
          <ul className="mt-2 max-h-72 overflow-y-auto" role="listbox">
            {q.length < minChars && <li className="p-3 text-sm text-muted">Type at least {minChars} characters.</li>}
            {results.isLoading && <li className="p-3 text-sm text-muted">Searching…</li>}
            {results.data?.length === 0 && <li className="p-3 text-sm text-muted">No patients found.</li>}
            {results.data?.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onChange(p); setOpen(false) }} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-mint-50">
                  <Avatar name={p.full_name} size="sm" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-forest">{p.full_name}</span><span className="block truncate text-xs text-muted">{p.email} · DOB {formatCalendarDate(p.date_of_birth)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
