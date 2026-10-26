import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, SampleBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { Modal } from '@/components/common/Dialog'
import { DEPARTMENT_ICON_NAMES, DeptIcon } from '@/components/common/DeptIcon'
import { PageHeader } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { Checkbox, FormField, Input, Select, Textarea } from '@/components/forms/Field'
import { FormAlert } from '@/components/layout/AuthShell'
import { db } from '@/lib/backend'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage } from '@/lib/utils'
import type { Department } from '@/types/models'

function Editor({ dept, onClose }: { dept: Partial<Department>; onClose: () => void }) {
  const qc = useQueryClient()
  const [d, setD] = useState({ name: dept.name ?? '', slug: dept.slug ?? '', summary: dept.summary ?? '', description: dept.description ?? '', icon: dept.icon ?? 'stethoscope', image_url: dept.image_url ?? '', services: (dept.services ?? []).join('\n'), phone_extension: dept.phone_extension ?? '', sort_order: dept.sort_order ?? 100, is_active: dept.is_active ?? true })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const slug = d.slug || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      if (d.name.trim().length < 2) throw new Error('Enter a department name.')
      const values = { name: d.name.trim(), slug, summary: d.summary, description: d.description, icon: d.icon, image_url: d.image_url || null, services: d.services.split('\n').map((s) => s.trim()).filter(Boolean), phone_extension: d.phone_extension || null, sort_order: Number(d.sort_order), is_active: d.is_active }
      return dept.id ? db().update('departments', values, [{ col: 'id', op: 'eq', value: dept.id }]) : db().insert('departments', values)
    },
    onSuccess: () => { toast.success('Department saved'); qc.invalidateQueries({ queryKey: ['departments'] }); qc.invalidateQueries({ queryKey: ['department'] }); onClose() },
    onError: (e) => setError(errorMessage(e)),
  })
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} size="lg" title={dept.id ? `Edit ${dept.name}` : 'New department'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => { setError(null); save.mutate() }}>Save</Button></>}>
      {error && <div className="mb-4"><FormAlert>{error}</FormAlert></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></FormField>
        <FormField label="URL slug" hint="Lowercase letters, numbers and dashes"><Input value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} disabled={!!dept.id} /></FormField>
        <FormField label="Icon"><Select value={d.icon} onChange={(e) => setD({ ...d, icon: e.target.value })}>{DEPARTMENT_ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}</Select></FormField>
        <FormField label="Phone extension" optional><Input value={d.phone_extension} onChange={(e) => setD({ ...d, phone_extension: e.target.value })} /></FormField>
        <FormField label="Image path or URL" optional><Input value={d.image_url} onChange={(e) => setD({ ...d, image_url: e.target.value })} /></FormField>
        <FormField label="Sort order"><Input type="number" value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value) })} /></FormField>
      </div>
      <div className="mt-4 space-y-4">
        <FormField label="Summary"><Input value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} /></FormField>
        <FormField label="Description"><Textarea rows={3} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></FormField>
        <FormField label="Services" hint="One per line"><Textarea rows={4} value={d.services} onChange={(e) => setD({ ...d, services: e.target.value })} /></FormField>
        <Checkbox checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} label="Visible on the public website" />
      </div>
    </Modal>
  )
}

export default function AdminDepartments() {
  useDocumentTitle('Departments')
  const depts = useQuery({ queryKey: ['departments', 'admin'], queryFn: async () => (await db().select<Department>('v_departments', { order: [{ col: 'sort_order' }] })).rows })
  const [editing, setEditing] = useState<Partial<Department> | null>(null)
  return (
    <>
      <PageHeader title="Departments" description="Edit the specialities shown across the website and booking flow." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({})}>New department</Button>} />
      {depts.isLoading ? <LoadingSkeleton rows={6} /> : depts.error ? <ErrorState error={depts.error} /> : !depts.data?.length ? <EmptyState title="No departments" /> : (
        <DataTable caption="Departments" rows={depts.data} rowKey={(d) => d.id} columns={[
          { key: 'name', header: 'Department', cell: (d) => <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-100 text-mint-600"><DeptIcon name={d.icon} className="h-4.5 w-4.5" /></span><span><span className="block font-medium text-forest">{d.name}</span><span className="block text-xs text-muted">/{d.slug}</span></span></span> },
          { key: 'doctors', header: 'Doctors', cell: (d) => d.doctor_count },
          { key: 'services', header: 'Services', cell: (d) => d.services.length, hideOnMobile: true },
          { key: 'status', header: 'Status', cell: (d) => <span className="flex gap-1">{d.is_active ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}{d.is_sample && <SampleBadge />}</span> },
          { key: 'act', header: '', cell: (d) => <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(d)}>Edit</Button> },
        ]} />
      )}
      {editing && <Editor dept={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
