import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, SampleBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Dialog'
import { PageHeader, Pagination } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { Checkbox, FormField, Input, SearchBar, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn, errorMessage, formatMoney } from '@/lib/utils'
import { adjustStock, listMedicines, saveMedicine } from '@/services/pharmacy'
import type { Medicine } from '@/types/models'

const blank: Partial<Medicine> = { name: '', slug: '', generic_name: '', category: '', form: 'Tablet', strength: '', pack_size: '', description: '', price: 0, requires_prescription: false, is_active: true, stock: 0 }
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function MedicineForm({ initial, onDone }: { initial: Partial<Medicine>; onDone: () => void }) {
  const qc = useQueryClient()
  const [m, setM] = useState<Partial<Medicine>>(initial)
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => {
      if (!m.name?.trim() || !m.category?.trim()) throw new Error('Name and category are required.')
      if (!(Number(m.price) >= 0)) throw new Error('Enter a valid price.')
      const { id, name, generic_name, category, form, strength, pack_size, description, price, requires_prescription, is_active, stock } = m
      return saveMedicine({ id, name: name!.trim(), slug: m.slug || slugify(`${name} ${strength ?? ''}`), generic_name: generic_name || null, category: category!.trim(), form, strength: strength || null, pack_size: pack_size || null, description: description ?? '', price: Number(price), requires_prescription, is_active, stock: id ? undefined : Number(stock ?? 0) })
    },
    onSuccess: () => { toast.success('Medicine saved'); qc.invalidateQueries({ queryKey: ['medicines'] }); onDone() },
    onError: (e) => setError(errorMessage(e)),
  })
  const f = (k: keyof Medicine) => ({ value: (m[k] as string | number | undefined) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setM({ ...m, [k]: e.target.value }) })
  return (
    <div className="space-y-4">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required><Input {...f('name')} /></FormField>
        <FormField label="Generic name" optional><Input {...f('generic_name')} /></FormField>
        <FormField label="Category" required><Input {...f('category')} /></FormField>
        <FormField label="Form"><Input {...f('form')} /></FormField>
        <FormField label="Strength" optional><Input {...f('strength')} /></FormField>
        <FormField label="Pack size" optional><Input {...f('pack_size')} /></FormField>
        <FormField label="Price (₹)" required><Input type="number" min={0} step="0.01" {...f('price')} /></FormField>
        {!m.id && <FormField label="Opening stock"><Input type="number" min={0} {...f('stock')} /></FormField>}
      </div>
      <FormField label="Description"><Textarea rows={3} {...f('description')} /></FormField>
      <div className="flex flex-wrap gap-6">
        <Checkbox label="Prescription required" checked={!!m.requires_prescription} onChange={(e) => setM({ ...m, requires_prescription: e.target.checked })} />
        <Checkbox label="Active (visible in catalogue)" checked={!!m.is_active} onChange={(e) => setM({ ...m, is_active: e.target.checked })} />
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button loading={save.isPending} onClick={() => { setError(null); save.mutate() }}>Save</Button></div>
    </div>
  )
}

function StockForm({ med, onDone }: { med: Medicine; onDone: () => void }) {
  const qc = useQueryClient()
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const adj = useMutation({
    mutationFn: () => adjustStock(med.id, Number(change), reason),
    onSuccess: () => { toast.success('Stock adjusted'); qc.invalidateQueries({ queryKey: ['medicines'] }); onDone() },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-strong">Current stock: <strong>{med.stock}</strong>. Use a positive number for deliveries and a negative number for write-offs. Every adjustment is recorded.</p>
      <FormField label="Change (+/-)" required><Input type="number" value={change} onChange={(e) => setChange(e.target.value)} /></FormField>
      <FormField label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Supplier delivery #123" /></FormField>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onDone}>Cancel</Button><Button loading={adj.isPending} disabled={!Number(change) || reason.trim().length < 3} onClick={() => adj.mutate()}>Apply adjustment</Button></div>
    </div>
  )
}

export default function MedicinesManager() {
  useDocumentTitle('Medicines')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim())
  const meds = useQuery({ queryKey: ['medicines', 'manage', q, page], queryFn: () => listMedicines({ search: q, includeInactive: true, limit: 20, offset: (page - 1) * 20 }) })
  const [editing, setEditing] = useState<Partial<Medicine> | null>(null)
  const [stocking, setStocking] = useState<Medicine | null>(null)
  return (
    <>
      <PageHeader title="Medication catalogue" description="Manage products, prices and recorded stock adjustments." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(blank)}>Add medicine</Button>} />
      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search medicines" className="mb-6 max-w-md" label="Search medicines" />
      {meds.isLoading ? <LoadingSkeleton rows={6} /> : meds.error ? <ErrorState error={meds.error} /> : !meds.data?.rows.length ? <EmptyState title="No medicines" /> : (
        <DataTable caption="Medicines" rows={meds.data.rows} rowKey={(m) => m.id} columns={[
          { key: 'name', header: 'Medicine', cell: (m) => <div><p className="font-medium text-forest">{m.name} {m.strength}</p><p className="text-xs text-muted">{m.category} · {m.pack_size}</p></div> },
          { key: 'price', header: 'Price', cell: (m) => formatMoney(m.price) },
          { key: 'stock', header: 'Stock', cell: (m) => <span className={cn('font-semibold tabular-nums', m.stock < 20 ? 'text-warning' : 'text-forest')}>{m.stock}</span> },
          { key: 'flags', header: 'Flags', cell: (m) => <span className="flex flex-wrap gap-1">{m.requires_prescription && <Badge tone="warning">Rx</Badge>}{!m.is_active && <Badge>Inactive</Badge>}{m.is_sample && <SampleBadge />}</span>, hideOnMobile: true },
          { key: 'actions', header: '', cell: (m) => <span className="flex justify-end gap-1"><Button size="sm" variant="ghost" icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={() => setStocking(m)}>Stock</Button><Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(m)}>Edit</Button></span> },
        ]} />
      )}
      {meds.data && <Pagination page={page} pageSize={20} total={meds.data.count ?? 0} onChange={setPage} />}
      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing?.id ? 'Edit medicine' : 'Add medicine'} size="lg">{editing && <MedicineForm initial={editing} onDone={() => setEditing(null)} />}</Modal>
      <Modal open={!!stocking} onOpenChange={(o) => !o && setStocking(null)} title={`Adjust stock — ${stocking?.name ?? ''}`}>{stocking && <StockForm med={stocking} onDone={() => setStocking(null)} />}</Modal>
    </>
  )
}
