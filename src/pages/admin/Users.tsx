import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MailPlus, ShieldBan, ShieldCheck, UserCog } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/app/auth'
import { Badge, SampleBadge, StatusBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog, Modal } from '@/components/common/Dialog'
import { PageHeader, Pagination, Segmented } from '@/components/common/Layout'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/States'
import { DataTable } from '@/components/dashboards/DataTable'
import { Checkbox, FormField, Input, SearchBar } from '@/components/forms/Field'
import { useDebounce } from '@/hooks/useDebounce'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { errorMessage, formatDate, titleCase } from '@/lib/utils'
import { createInvitation, listInvitations, listUsers, revokeInvitation, setStaffPermissions, setUserActive } from '@/services/account'
import type { StaffPermission, UserRow } from '@/types/models'

const PERMS: { value: StaffPermission; label: string; desc: string }[] = [
  { value: 'appointments', label: 'Appointments', desc: 'View and manage appointment schedules' },
  { value: 'patient_admin', label: 'Patient administration', desc: 'Look up patient contact and appointment records (no clinical data)' },
  { value: 'lab_records', label: 'Lab records', desc: 'Create and update laboratory reports' },
  { value: 'pharmacy', label: 'Pharmacy', desc: 'Review prescriptions, process orders and manage stock' },
]

function PermissionPicker({ value, onChange }: { value: StaffPermission[]; onChange: (v: StaffPermission[]) => void }) {
  return (
    <div className="space-y-3">
      {PERMS.map((p) => (
        <Checkbox key={p.value} checked={value.includes(p.value)} onChange={(e) => onChange(e.target.checked ? [...value, p.value] : value.filter((x) => x !== p.value))}
          label={<><span className="font-medium">{p.label}</span><span className="block text-[13px] text-muted">{p.desc}</span></>} />
      ))}
    </div>
  )
}

export default function AdminUsers() {
  useDocumentTitle('Users & staff')
  const qc = useQueryClient()
  const { session } = useAuth()
  const [tab, setTab] = useState<'users' | 'invites'>('users')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim())
  const users = useQuery({ queryKey: ['admin-users', q, page], queryFn: () => listUsers({ search: q, offset: (page - 1) * 25, limit: 25 }) })
  const invites = useQuery({ queryKey: ['invites'], queryFn: listInvitations, enabled: tab === 'invites' })
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [perms, setPerms] = useState<StaffPermission[]>([])
  const [toggle, setToggle] = useState<UserRow | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState<{ email: string; perms: StaffPermission[] }>({ email: '', perms: [] })
  const [link, setLink] = useState<string | null>(null)

  const savePerms = useMutation({
    mutationFn: () => setStaffPermissions(editing!.id, perms),
    onSuccess: () => { toast.success('Staff access updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }); setEditing(null) },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const sendInvite = useMutation({
    mutationFn: () => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invite.email)) throw new Error('Enter a valid email address.')
      return createInvitation(invite.email.trim(), invite.perms)
    },
    onSuccess: (r) => { setLink(`${window.location.origin}/signup?invite=${r.token}`); qc.invalidateQueries({ queryKey: ['invites'] }); toast.success('Invitation created and queued for email') },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <>
      <PageHeader title="Users & staff" description="Grant staff permissions, invite employees and manage account status. Administrator roles are provisioned securely outside the app." actions={<Button icon={<MailPlus className="h-4 w-4" />} onClick={() => { setInvite({ email: '', perms: [] }); setLink(null); setInviteOpen(true) }}>Invite staff</Button>} />
      <Segmented className="mb-6" label="Section" value={tab} onChange={setTab} options={[{ value: 'users', label: 'Accounts' }, { value: 'invites', label: 'Invitations' }]} />
      {tab === 'users' ? (
        <>
          <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search name or email" className="mb-5 max-w-md" label="Search users" />
          {users.isLoading ? <LoadingSkeleton rows={6} /> : users.error ? <ErrorState error={users.error} /> : !users.data?.rows.length ? <EmptyState title="No users found" /> : (
            <DataTable caption="Users" rows={users.data.rows} rowKey={(u) => u.id} columns={[
              { key: 'user', header: 'User', cell: (u) => <div><p className="font-medium text-forest">{u.full_name || '—'}</p><p className="text-xs text-muted">{u.email}</p></div> },
              { key: 'roles', header: 'Roles', cell: (u) => <span className="flex flex-wrap gap-1">{u.roles.length ? u.roles.map((r) => <Badge key={r} tone={r === 'admin' ? 'forest' : 'mint'}>{r}</Badge>) : <Badge tone="warning">none</Badge>}{u.is_sample && <SampleBadge label="Demo" />}</span> },
              { key: 'perms', header: 'Staff permissions', cell: (u) => u.permissions.length ? <span className="text-[13px] text-muted-strong">{u.permissions.map(titleCase).join(', ')}</span> : '—', hideOnMobile: true },
              { key: 'status', header: 'Status', cell: (u) => <Badge tone={u.is_active ? 'success' : 'error'} dot>{u.is_active ? 'Active' : 'Inactive'}</Badge> },
              { key: 'joined', header: 'Joined', cell: (u) => formatDate(u.created_at), hideOnMobile: true },
              { key: 'act', header: '', cell: (u) => u.id === session?.userId ? <span className="text-xs text-muted">You</span> : (
                <span className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" icon={<UserCog className="h-3.5 w-3.5" />} onClick={() => { setEditing(u); setPerms(u.permissions) }}>Staff access</Button>
                  <Button size="sm" variant="ghost" icon={u.is_active ? <ShieldBan className="h-3.5 w-3.5 text-error" /> : <ShieldCheck className="h-3.5 w-3.5" />} onClick={() => setToggle(u)}>{u.is_active ? 'Deactivate' : 'Reactivate'}</Button>
                </span>
              ) },
            ]} />
          )}
          {users.data && <Pagination page={page} pageSize={25} total={users.data.count ?? 0} onChange={setPage} />}
        </>
      ) : invites.isLoading ? <LoadingSkeleton rows={3} /> : !invites.data?.length ? <EmptyState title="No invitations yet" /> : (
        <DataTable caption="Invitations" rows={invites.data} rowKey={(i) => i.id} columns={[
          { key: 'email', header: 'Email', cell: (i) => <span className="font-medium text-forest">{i.email}</span> },
          { key: 'perms', header: 'Permissions', cell: (i) => i.permissions.map(titleCase).join(', ') },
          { key: 'status', header: 'Status', cell: (i) => <StatusBadge status={i.accepted_at ? 'approved' : i.revoked_at ? 'cancelled' : new Date(i.expires_at) < new Date() ? 'failed' : 'pending'} /> },
          { key: 'exp', header: 'Expires', cell: (i) => formatDate(i.expires_at) },
          { key: 'act', header: '', cell: (i) => !i.accepted_at && !i.revoked_at ? <Button size="sm" variant="ghost" onClick={() => revokeInvitation(i.id).then(() => { toast.success('Invitation revoked'); invites.refetch() }).catch((e) => toast.error(errorMessage(e)))}>Revoke</Button> : null },
        ]} />
      )}

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={`Staff access — ${editing?.full_name || editing?.email}`} description="Granting any permission gives the account the staff role. Removing all permissions removes it."
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={savePerms.isPending} onClick={() => savePerms.mutate()}>Save access</Button></>}>
        <PermissionPicker value={perms} onChange={setPerms} />
        <p className="mt-4 text-[12.5px] text-muted">Doctor access is granted only through professional verification. Administrator access cannot be granted here.</p>
      </Modal>
      <ConfirmationDialog open={!!toggle} onOpenChange={(o) => !o && setToggle(null)} tone={toggle?.is_active ? 'danger' : 'primary'} title={toggle?.is_active ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={toggle?.is_active ? `${toggle?.email} will lose access to all portals. Records are retained.` : `${toggle?.email} will regain access according to their roles.`} confirmLabel={toggle?.is_active ? 'Deactivate' : 'Reactivate'}
        onConfirm={async () => { try { await setUserActive(toggle!.id, !toggle!.is_active); toast.success('Account updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }) } catch (e) { toast.error(errorMessage(e)); throw e } }} />
      <Modal open={inviteOpen} onOpenChange={setInviteOpen} title="Invite a staff member" description="They’ll receive a single-use link valid for 7 days. Only the invited email can accept it."
        footer={link ? <Button onClick={() => setInviteOpen(false)}>Done</Button> : <><Button variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button loading={sendInvite.isPending} disabled={!invite.perms.length} onClick={() => sendInvite.mutate()}>Create invitation</Button></>}>
        {link ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-strong">The invitation email has been queued. You can also share this link directly:</p>
            <div className="flex gap-2"><Input readOnly value={link} /><Button variant="secondary" size="icon" aria-label="Copy link" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Copied'))}><Copy className="h-4 w-4" /></Button></div>
          </div>
        ) : (
          <div className="space-y-5">
            <FormField label="Work email" required><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></FormField>
            <div><p className="mb-2 text-sm font-medium">Permissions</p><PermissionPicker value={invite.perms} onChange={(p) => setInvite({ ...invite, perms: p })} /></div>
          </div>
        )}
      </Modal>
    </>
  )
}
